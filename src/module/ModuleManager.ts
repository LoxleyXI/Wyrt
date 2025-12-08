//----------------------------------
// Wyrt - An MMO Engine
//----------------------------------
// Copyright (c) 2025 LoxleyXI
//
// https://github.com/LoxleyXI/Wyrt
//----------------------------------
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see http://www.gnu.org/licenses/
//----------------------------------
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import colors from "colors/safe";
import { IModule } from "./IModule";
import { ModuleContext } from "./ModuleContext";
import { ModuleLoader } from "./ModuleLoader";
import { FileWatcher } from "./FileWatcher";
import { Logger } from "../server/ConsoleLogger";

export class ModuleManager extends EventEmitter {
    private modules: Map<string, IModule> = new Map();
    private context: ModuleContext;
    private logger: Logger;
    private fileWatcher: FileWatcher;
    private moduleDataPaths: Map<string, string[]> = new Map(); // moduleName -> data paths

    constructor(context: ModuleContext) {
        super();
        this.context = context;
        this.logger = context.logger;
        this.fileWatcher = new FileWatcher(this.logger);

        this.setupFileWatcherEvents();
    }

    private setupFileWatcherEvents(): void {
        this.fileWatcher.on('fileChanged', (filePath: string, dataType: string, moduleName: string) => {
            this.logger.info(`+data reloading: ${path.basename(filePath)} (${dataType})`);
            this.reloadDataFile(filePath, dataType, moduleName);
        });

        this.fileWatcher.on('fileAdded', (filePath: string, dataType: string, moduleName: string) => {
            this.logger.info(`+data added: ${path.basename(filePath)} (${dataType})`);
            this.reloadDataFile(filePath, dataType, moduleName);
        });

        this.fileWatcher.on('fileDeleted', (filePath: string, dataType: string, moduleName: string) => {
            this.logger.info(`-data deleted: ${path.basename(filePath)} (${dataType})`);
            this.reloadAllDataForType(dataType, moduleName);
        });
    }

    private reloadDataFile(filePath: string, dataType: string, moduleName: string): void {
        try {
            const loader = this.context.data.getLoader(dataType);

            if (!loader) {
                this.logger.warn(`No loader found for data type: ${dataType}`);
                return;
            }

            const result = loader.load(this.context.data, filePath);

            if (result) {
                this.logger.info(`+data reloaded: ${path.basename(filePath)}`);

                this.context.events.emit('dataReloaded', {
                    filePath,
                    dataType,
                    moduleName,
                    timestamp: Date.now()
                });
            }

            else {
                this.logger.error(`+data failed: ${path.basename(filePath)}`);
            }
        }

        catch (error) {
            this.logger.error(`Error reloading data file ${filePath}:`, error);
        }
    }

    private reloadAllDataForType(dataType: string, moduleName: string): void {
        const dataPaths = this.moduleDataPaths.get(moduleName);

        if (!dataPaths) return;

        this.logger.info(`+data reloading: ${dataType} (module: ${moduleName})`);

        if (this.context.data[dataType]) {
            this.context.data[dataType] = {};
        }

        for (const dataPath of dataPaths) {
            if (fs.existsSync(dataPath)) {
                ModuleLoader.loadDir(this.context.data, dataType, dataPath);
            }
        }
    }

    async loadModulesFromDirectory(moduleDir: string): Promise<void> {
        if (!fs.existsSync(moduleDir)) {
            this.logger.warn(`Module directory ${moduleDir} does not exist`);

            return;
        }

        // Collect all module paths - supports both flat and nested category structures
        // Nested: modules/wyrt_world/wyrt_2d/package.json
        // Flat: modules/wyrt_2d/package.json (legacy/game modules)
        let modulePaths: { name: string; path: string }[] = [];

        const topLevelDirs = fs.readdirSync(moduleDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory());

        for (const dir of topLevelDirs) {
            const dirPath = path.join(moduleDir, dir.name);
            const packageJsonPath = path.join(dirPath, 'package.json');

            if (fs.existsSync(packageJsonPath)) {
                // Flat structure: this directory IS a module
                modulePaths.push({ name: dir.name, path: dirPath });
            } else if (dir.name.startsWith('wyrt_')) {
                // Category directory (e.g., wyrt_world/) - scan for modules inside
                const categoryDirs = fs.readdirSync(dirPath, { withFileTypes: true })
                    .filter(d => d.isDirectory());

                for (const subDir of categoryDirs) {
                    const subPath = path.join(dirPath, subDir.name);
                    const subPackageJson = path.join(subPath, 'package.json');

                    if (fs.existsSync(subPackageJson)) {
                        modulePaths.push({ name: subDir.name, path: subPath });
                    }
                }
            }
        }

        // Filter modules if enabled list is specified in config
        const enabledModules = this.context.config?.server?.modules?.enabled;
        if (enabledModules && Array.isArray(enabledModules) && enabledModules.length > 0) {
            this.logger.info(`Filtering modules: only loading ${enabledModules.join(', ')}`);
            modulePaths = modulePaths.filter(m => enabledModules.includes(m.name));
        }

        // Sort modules so wyrt_ prefixed modules load first
        modulePaths.sort((a, b) => {
            const aIsWyrt = a.name.startsWith('wyrt_');
            const bIsWyrt = b.name.startsWith('wyrt_');

            if (aIsWyrt && !bIsWyrt) return -1;
            if (!aIsWyrt && bIsWyrt) return 1;
            return a.name.localeCompare(b.name);
        });

        this.logger.info(`Loading modules in order: ${modulePaths.map(m => m.name).join(', ')}`);

        // Phase 1: Load and initialize all modules (but don't activate yet)
        for (const mod of modulePaths) {
            try {
                await this.loadModule(mod.path, false);
            }

            catch (error) {
                this.logger.error(`Failed to load module from ${mod.name}:`, error);
            }
        }

        // Phase 2: Activate all modules (now all dependencies are loaded)
        this.logger.info('Activating modules...');
        for (const [moduleName, module] of this.modules.entries()) {
            try {
                if (module.activate) {
                    await module.activate(this.context);
                    this.logger.debug(`Activated module: ${moduleName}`);
                }
            }

            catch (error) {
                this.logger.error(`Failed to activate module ${moduleName}:`, error);
            }
        }
    }

    async loadModule(modulePath: string, shouldActivate: boolean = true): Promise<void> {
        const packageJsonPath = path.join(modulePath, 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
            throw new Error(`No package.json found at ${modulePath}`);
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const moduleName = packageJson.name;

        if (this.modules.has(moduleName)) {
            throw new Error(`Module ${moduleName} is already loaded`);
        }

        await this.loadModuleDataLoaders(modulePath, moduleName);
        await this.loadModuleCommands(modulePath, moduleName);
        await this.loadModuleRequests(modulePath, moduleName);
        await this.loadModuleData(modulePath, moduleName);

        const indexPath = path.join(modulePath, "index.ts");

        if (fs.existsSync(indexPath)) {
            try {
                const moduleClass = await import(`file://${path.resolve(indexPath)}`);
                const ModuleClass = moduleClass.default || moduleClass[moduleName];

                if (ModuleClass) {
                    const module: IModule = new ModuleClass();

                    if (module.initialize) {
                        await module.initialize(this.context);
                    }

                    // Add to Map BEFORE activation so other modules can find it
                    this.modules.set(moduleName, module);

                    // Only activate if requested (for two-phase loading)
                    if (shouldActivate && module.activate) {
                        await module.activate(this.context);
                    }
                }
            }

            catch (error) {
                this.logger.error(`Failed to load main module file for ${moduleName}:`, error);
            }
        }

        this.logger.info(`Loaded module: ${moduleName} v${packageJson.version}`);
        this.emit('moduleLoaded', moduleName);
    }

    private async loadModuleDataLoaders(modulePath: string, moduleName: string): Promise<void> {
        const loadersPath = path.join(modulePath, 'loaders');

        if (!fs.existsSync(loadersPath)) return;

        const loaderFiles = fs.readdirSync(loadersPath)
            .filter(file => file.endsWith('.ts') || file.endsWith('.js'));

        for (const file of loaderFiles) {
            try {
                const loaderModule = await import(`file://${path.resolve(loadersPath, file)}`);
                const dataType = path.basename(file, path.extname(file));

                if (loaderModule.default) {
                    this.context.data.registerLoader(dataType, loaderModule.default);
                    this.logger.debug(colors.green("+loader ") + colors.magenta(`{${dataType}}`) + ` (module: ${moduleName})`);
                }
            }

            catch (error) {
                this.logger.error(`Failed to load data loader ${file} from module ${moduleName}:`, error);
            }
        }
    }

    private async loadModuleCommands(modulePath: string, moduleName: string): Promise<void> {
        const commandsPath = path.join(modulePath, 'commands');

        if (!fs.existsSync(commandsPath)) return;

        const commandFiles = fs.readdirSync(commandsPath)
            .filter(file => file.endsWith('.ts') || file.endsWith('.js'));

        for (const file of commandFiles) {
            try {
                const commandModule = await import(`file://${path.resolve(commandsPath, file)}`);
                const commandName = path.basename(file, path.extname(file));

                if (commandModule.default) {
                    this.context.commands.registerCommand(commandName, commandModule.default);
                    this.logger.debug(colors.green("+command ") + colors.yellow(`/${commandName}`) + ` (module: ${moduleName})`);
                }
            }

            catch (error) {
                this.logger.error(`Failed to load command ${file} from module ${moduleName}:`, error);
            }
        }
    }

    private async loadModuleRequests(modulePath: string, moduleName: string): Promise<void> {
        const requestsPath = path.join(modulePath, 'requests');

        if (!fs.existsSync(requestsPath)) return;

        const requestFiles = fs.readdirSync(requestsPath)
            .filter(file => file.endsWith('.ts') || file.endsWith('.js'));

        // Determine if this is a game module or a core module
        // Game modules don't start with 'wyrt_', core modules do
        const isGameModule = !moduleName.startsWith('wyrt_');

        for (const file of requestFiles) {
            try {
                const requestModule = await import(`file://${path.resolve(requestsPath, file)}`);
                const requestType = path.basename(file, path.extname(file));

                if (requestModule.default) {
                    if (isGameModule) {
                        // Game modules: register with game-scoped handlers
                        this.context.requestTypes.registerGameHandler(moduleName, requestType, requestModule.default);
                        this.logger.debug(colors.green("+handler ") + colors.cyan(`<${requestType}>`) + ` (game: ${moduleName})`);
                    } else {
                        // Core modules: register globally
                        this.context.requestTypes.registerHandler(requestType, requestModule.default);
                        this.logger.debug(colors.green("+handler ") + colors.cyan(`<${requestType}>`) + ` (module: ${moduleName})`);
                    }
                }
            }

            catch (error) {
                this.logger.error(`Failed to load request ${file} from module ${moduleName}:`, error);
            }
        }
    }

    private async loadModuleData(modulePath: string, moduleName: string): Promise<void> {
        const dataPath = path.join(modulePath, 'data');

        if (!fs.existsSync(dataPath)) return;

        const dataPaths: string[] = [];

        const dataEntries = fs.readdirSync(dataPath, { withFileTypes: true });

        for (const entry of dataEntries) {
            if (entry.isDirectory() && entry.name !== 'loaders') {
                const subDirPath = path.join(dataPath, entry.name);

                dataPaths.push(subDirPath);
                ModuleLoader.loadDir(this.context.data, entry.name, subDirPath);

                this.fileWatcher.watchDirectory(subDirPath, entry.name, moduleName);
            }

            else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
                const filePath = path.join(dataPath, entry.name);
                const dataType = path.basename(entry.name, path.extname(entry.name));

                try {
                    const loader = this.context.data.getLoader(dataType);

                    if (loader) {
                        loader.load(this.context.data, filePath);
                        this.logger.debug(`Loaded data file: ${entry.name}`);
                    }
                }

                catch (error) {
                    this.logger.error(`Failed to load data file ${entry.name} from module ${moduleName}:`, error);
                }
            }
        }

        this.moduleDataPaths.set(moduleName, dataPaths);
    }

    getModule(name: string): IModule | undefined {
        return this.modules.get(name);
    }

    getModules(): Map<string, IModule> {
        return this.modules;
    }

    listModules(): IModule[] {
        return Array.from(this.modules.values());
    }

    stopFileWatchers(): void {
        this.fileWatcher.stopAll();
    }
}
