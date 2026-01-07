import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { spawn, execSync, ChildProcess } from 'child_process';
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
  private basePort: number = 8000;
  private maxPort: number = 8099;
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

  private async killPortProcess(port: number): Promise<void> {
    if (process.platform === 'win32') {
      try {
        // Find process using the port
        const { execSync } = await import('child_process');
        const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });

        // Parse PID from netstat output
        const lines = output.split('\n').filter(line => line.includes('LISTENING'));
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            console.log(`[WebManager] Killing process ${pid} on port ${port}`);
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          }
        }
      } catch (error) {
        // Port might not be in use, or process already killed
      }
    } else {
      try {
        const { execSync } = await import('child_process');
        const output = execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
        const pid = output.trim();
        if (pid) {
          console.log(`[WebManager] Killing process ${pid} on port ${port}`);
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        }
      } catch (error) {
        // Port might not be in use
      }
    }
  }

  private async findModuleWebApps(): Promise<ModuleWebApp[]> {
    const webApps: ModuleWebApp[] = [];

    if (!fs.existsSync(this.modulesDir)) {
      console.log(`[WebManager] No modules directory found at: ${this.modulesDir}`);
      return webApps;
    }

    let modules = fs.readdirSync(this.modulesDir);

    // Filter modules by environment variable or config
    // WYRT_MODULES env var takes precedence (comma-separated list of game modules)
    // WYRT_MODULES_EXCLUDE excludes specific modules (including wyrt_* core modules)
    const envModules = process.env.WYRT_MODULES?.split(',').map(m => m.trim()).filter(Boolean);
    const envExclude = process.env.WYRT_MODULES_EXCLUDE?.split(',').map(m => m.trim()).filter(Boolean) || [];
    const configModules = this.config?.server?.modules?.enabled;
    const configExclude = this.config?.server?.modules?.exclude || [];
    const enabledGames = envModules || (Array.isArray(configModules) ? configModules : null);
    const excludedModules = [...envExclude, ...configExclude];

    // First, filter by exclusion list
    if (excludedModules.length > 0) {
      console.log(`[WebManager] Excluding modules: ${excludedModules.join(', ')}`);
      modules = modules.filter(module => !excludedModules.includes(module));
    }

    // Then, filter by enabled games (if specified)
    if (enabledGames && enabledGames.length > 0) {
      console.log(`[WebManager] Loading frontends for games: ${enabledGames.join(', ')}`);
      modules = modules.filter(module =>
        module.startsWith('wyrt_') || enabledGames.includes(module)
      );
    }

    console.log(`[WebManager] Scanning ${modules.length} modules for web apps...`);
    let nextPort = this.basePort;

    for (const module of modules) {
      if (module === 'wyrt_demo' && this.config?.server?.options?.demo === false) {
        console.log('[WebManager] Skipping wyrt_demo module (demo disabled in config)');
        continue;
      }

      if (module === 'wyrt_ctf' && this.config?.server?.options?.ctf === false) {
        console.log('[WebManager] Skipping wyrt_ctf module (ctf disabled in config)');
        continue;
      }

      const wwwPath = path.join(this.modulesDir, module, 'www');
      const packageJsonPath = path.join(wwwPath, 'package.json');

      if (fs.existsSync(wwwPath) && fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

          // Check if dev script exists
          if (!packageJson.scripts || !packageJson.scripts.dev) {
            console.log(`[WebManager] Module ${module} has www/ but no 'dev' script in package.json`);
            continue;
          }

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

  private installDependencies(webApp: ModuleWebApp): boolean {
    const nodeModulesPath = path.join(webApp.path, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.log(`[WebManager] Installing dependencies for ${webApp.name}...`);
      const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      
      try {
        execSync(`${npm} install`, {
          cwd: webApp.path,
          stdio: 'inherit'
        });
        console.log(`[WebManager] Dependencies installed for ${webApp.name}`);
        return true;
      } catch (error: any) {
        console.error(`[WebManager] Failed to install dependencies for ${webApp.name}:`, error.message);
        return false;
      }
    }
    return true;
  }

  private startWebApp(webApp: ModuleWebApp): ChildProcess | null {
    console.log(`[WebManager] Starting web app for module: ${webApp.name} on port ${webApp.port}`);

    // Check and install dependencies if needed
    if (!this.installDependencies(webApp)) {
      console.error(`[WebManager] Cannot start ${webApp.name} without dependencies`);
      return null;
    }

    // Check if we're in production mode
    const isProduction = process.env.NODE_ENV === 'production' || this.config?.options?.production;

    // For Next.js apps, we need to pass the port differently
    const env = {
      ...process.env,
      PORT: String(webApp.port),
      NODE_ENV: isProduction ? 'production' : 'development'
    };
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    // Detect framework type
    const isNextApp = webApp.packageJson.dependencies?.next || webApp.packageJson.devDependencies?.next;
    const isViteApp = webApp.packageJson.dependencies?.vite || webApp.packageJson.devDependencies?.vite;

    // Build for production if needed
    if (isProduction && webApp.packageJson.scripts?.build) {
      const buildDir = isNextApp ? path.join(webApp.path, '.next') : path.join(webApp.path, 'dist');
      if (!fs.existsSync(buildDir)) {
        console.log(`[WebManager] Building ${webApp.name} for production...`);
        try {
          execSync(`${npm} run build`, {
            cwd: webApp.path,
            stdio: 'inherit'
          });
        } catch (error: any) {
          console.error(`[WebManager] Failed to build ${webApp.name}:`, error.message);
          return null;
        }
      }
    }

    // Choose script based on environment
    const script = isProduction && webApp.packageJson.scripts?.start ? 'start' : 'dev';

    if (!webApp.packageJson.scripts?.[script]) {
      console.error(`[WebManager] Module ${webApp.name} has no '${script}' script`);
      return null;
    }

    let args: string[];
    if (isNextApp) {
      // For Next.js, pass the port and hostname as arguments
      args = ['run', script, '--', '-p', String(webApp.port), '--hostname', '0.0.0.0'];
    } else if (isViteApp && script === 'dev') {
      // For Vite dev mode, use --port flag
      args = ['run', script, '--', '--port', String(webApp.port), '--host', '0.0.0.0'];
    } else {
      // For other frameworks or production builds, try PORT env var
      args = ['run', script];
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
  }

  private setupShutdownHandlers(): void {
    process.on('SIGINT', () => {
      this.shutdownInternal('SIGINT');
    });

    process.on('SIGTERM', () => {
      this.shutdownInternal('SIGTERM');
    });
  }

  private shutdownInternal(signal: string): void {
    console.log(`\n[WebManager] Shutting down module web apps (${signal})...`);
    this.processes.forEach(p => {
      if (p) {
        try {
          p.kill(signal as any);
        } catch (error: any) {
          console.error(`[WebManager] Error killing process:`, error.message);
        }
      }
    });
    // Don't call process.exit() - let the main server handle that
  }

  /**
   * Public shutdown method (called by main server)
   */
  public shutdown(): void {
    this.shutdownInternal('SIGTERM');
  }

  public async start(): Promise<void> {
    // Skip web apps if disabled in config
    if (this.config?.server?.options?.web === false) {
      console.log('[WebManager] Module web apps disabled in config');
      return;
    }

    this.webApps = await this.findModuleWebApps();

    if (this.webApps.length === 0) {
      console.log('[WebManager] No module web apps found');
      return;
    }

    console.log(`[WebManager] Found ${this.webApps.length} module web app(s):`);
    this.webApps.forEach(app => {
      console.log(`  - ${app.name} (port ${app.port})`);
    });

    // Kill any processes that might be using the assigned ports
    console.log('[WebManager] Checking for processes on assigned ports...');
    for (const webApp of this.webApps) {
      await this.killPortProcess(webApp.port);
    }

    // Wait a moment for ports to be released
    await new Promise(resolve => setTimeout(resolve, 1000));

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