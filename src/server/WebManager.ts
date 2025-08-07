import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ModuleWebApp {
  name: string;
  path: string;
  packageJson: any;
  port: number;
  process?: ChildProcess | null;
}

export class WebManager {
  private modulesDir: string;
  private webApps: ModuleWebApp[] = [];
  private basePort: number = 3000;
  private maxPort: number = 3099;
  private processes: (ChildProcess | null)[] = [];
  private config: any;

  constructor(modulesPath?: string, config?: any) {
    this.modulesDir = modulesPath || path.join(__dirname, '..', '..', 'modules');
    this.config = config;
    this.setupShutdownHandlers();
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', () => {
        resolve(false);
      });
      
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      
      server.listen(port);
    });
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    for (let port = startPort; port <= this.maxPort; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`No available ports found between ${startPort} and ${this.maxPort}`);
  }

  private async findModuleWebApps(): Promise<ModuleWebApp[]> {
    const webApps: ModuleWebApp[] = [];
    
    if (!fs.existsSync(this.modulesDir)) {
      console.log('[WebManager] No modules directory found');
      return webApps;
    }

    const modules = fs.readdirSync(this.modulesDir);
    let nextPort = this.basePort;
    
    for (const module of modules) {
      if (module === 'wyrt_demo' && this.config?.server?.options?.demo === false) {
        console.log('[WebManager] Skipping wyrt_demo module (demo disabled in config)');
        continue;
      }
      
      const wwwPath = path.join(this.modulesDir, module, 'www');
      const packageJsonPath = path.join(wwwPath, 'package.json');
      
      if (fs.existsSync(wwwPath) && fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          
          // Find an available port
          const port = await this.findAvailablePort(nextPort);
          nextPort = port + 1;
          
          webApps.push({
            name: module,
            path: wwwPath,
            packageJson,
            port
          });
        } catch (error: any) {
          console.error(`[WebManager] Error reading package.json for module ${module}:`, error.message);
        }
      }
    }
    
    return webApps;
  }

  private startWebApp(webApp: ModuleWebApp): ChildProcess | null {
    console.log(`[WebManager] Starting web app for module: ${webApp.name} on port ${webApp.port}`);
    
    // For Next.js apps, we need to pass the port differently
    const env = { ...process.env, PORT: String(webApp.port) };
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    
    if (webApp.packageJson.scripts && webApp.packageJson.scripts.dev) {
      // Check if it's a Next.js app
      const isNextApp = webApp.packageJson.dependencies?.next || webApp.packageJson.devDependencies?.next;
      
      let args: string[];
      if (isNextApp) {
        // For Next.js, pass the port as an argument
        args = ['run', 'dev', '--', '-p', String(webApp.port)];
      } else {
        // For other frameworks (like Vite), use PORT env var
        args = ['run', 'dev'];
      }
      
      const child = spawn(npm, args, {
        cwd: webApp.path,
        env,
        stdio: 'inherit',
        shell: true
      });
      
      child.on('error', (error) => {
        console.error(`[WebManager] Error starting ${webApp.name} web app:`, error.message);
      });
      
      child.on('exit', (code) => {
        if (code !== 0) {
          console.error(`[WebManager] ${webApp.name} web app exited with code ${code}`);
        }
      });
      
      return child;
    } else {
      console.log(`[WebManager] No 'dev' script found for ${webApp.name} web app`);
      return null;
    }
  }

  private setupShutdownHandlers(): void {
    process.on('SIGINT', () => {
      this.shutdown('SIGINT');
    });
    
    process.on('SIGTERM', () => {
      this.shutdown('SIGTERM');
    });
  }

  private shutdown(signal: string): void {
    console.log(`\n[WebManager] Shutting down module web apps (${signal})...`);
    this.processes.forEach(p => {
      if (p) p.kill(signal as any);
    });
    process.exit(0);
  }

  public async start(): Promise<void> {
    this.webApps = await this.findModuleWebApps();
    
    if (this.webApps.length === 0) {
      console.log('[WebManager] No module web apps found');
      return;
    }
    
    console.log(`[WebManager] Found ${this.webApps.length} module web app(s):`);
    this.webApps.forEach(app => {
      console.log(`  - ${app.name} (port ${app.port})`);
    });
    
    for (const webApp of this.webApps) {
      const process = this.startWebApp(webApp);
      if (process) {
        webApp.process = process;
        this.processes.push(process);
      }
    }
  }

  public getWebApps(): ModuleWebApp[] {
    return this.webApps;
  }

  public stopWebApp(moduleName: string): boolean {
    const webApp = this.webApps.find(app => app.name === moduleName);
    if (webApp && webApp.process) {
      webApp.process.kill('SIGTERM');
      return true;
    }
    return false;
  }

  public restartWebApp(moduleName: string): boolean {
    const webApp = this.webApps.find(app => app.name === moduleName);
    if (webApp) {
      if (webApp.process) {
        webApp.process.kill('SIGTERM');
      }
      const newProcess = this.startWebApp(webApp);
      if (newProcess) {
        webApp.process = newProcess;
        const index = this.processes.findIndex(p => p === webApp.process);
        if (index !== -1) {
          this.processes[index] = newProcess;
        } else {
          this.processes.push(newProcess);
        }
        return true;
      }
    }
    return false;
  }
}

// Main execution when run directly
if (process.argv[1] === __filename) {
  const manager = new WebManager();
  manager.start().catch(console.error);
}