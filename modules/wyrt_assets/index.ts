import { IModule, ModuleContext } from "../../src/module/ModuleSystem";
import { AssetManager } from "./systems/AssetManager";
import colors from "colors/safe";
import { Request, Response } from 'express';
import * as fs from "fs";
import * as path from "path";

export default class WyrtAssetsModule implements IModule {
    name = "wyrt_assets";
    version = "1.0.0";
    description = "Generic asset serving and management for Wyrt modules";
    dependencies = [];

    public assetManager: AssetManager;

    async initialize(context: ModuleContext): Promise<void> {
        context.logger.info("Initializing Wyrt Assets module...");

        // Initialize asset manager
        this.assetManager = new AssetManager(context);

        // Store in context for other modules to access
        (context as any).assetManager = this.assetManager;
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.green("+module ") + "wyrt_assets");

        // Scan all loaded modules for assets
        this.scanAllModules(context);

        // Register HTTP routes for asset APIs
        this.registerAssetRoutes(context);
    }

    async deactivate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.red("-module ") + "wyrt_assets");
    }

    /**
     * Scan all modules directory for assets
     */
    private scanAllModules(context: ModuleContext): void {
        const modulesPath = path.join(process.cwd(), "modules");

        if (!fs.existsSync(modulesPath)) {
            context.logger.warn("Modules directory not found");
            return;
        }

        let totalAssets = 0;
        const moduleDirectories = fs.readdirSync(modulesPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const moduleName of moduleDirectories) {
            const manifest = this.assetManager.scanModuleAssets(moduleName);
            if (manifest) {
                totalAssets += manifest.assetCount;
            }
        }

        if (totalAssets > 0) {
            context.logger.info(colors.green(`✓ Found ${totalAssets} assets across all modules`));
        }
    }

    /**
     * Register HTTP API routes for asset management
     */
    private registerAssetRoutes(context: ModuleContext): void {
        const httpServer = (context as any).httpServer;
        if (!httpServer || !httpServer.app) {
            context.logger.warn("HTTP server not available, skipping asset routes");
            return;
        }

        const app = httpServer.app;

        // GET /api/assets/:module - Get asset manifest for a module
        app.get('/api/assets/:module', (req: Request, res: Response) => {
            const { module: moduleName } = req.params;

            const manifest = this.assetManager.getManifest(moduleName);
            if (!manifest) {
                return res.status(404).json({
                    success: false,
                    message: `No assets found for module '${moduleName}'`
                });
            }

            res.json({
                success: true,
                manifest
            });
        });

        // GET /api/assets/:module/:category - Get assets by category
        app.get('/api/assets/:module/:category', (req: Request, res: Response) => {
            const { module: moduleName, category } = req.params;

            const assets = this.assetManager.getAssetsByCategory(moduleName, category);
            if (assets.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `No assets found in category '${category}' for module '${moduleName}'`
                });
            }

            res.json({
                success: true,
                module: moduleName,
                category,
                assets
            });
        });

        // GET /api/assets/:module/meta/:assetPath(*) - Get asset metadata
        app.get('/api/assets/:module/meta/*', (req: Request, res: Response) => {
            const { module: moduleName } = req.params;
            const assetPath = req.params[0]; // Wildcard path

            const metadata = this.assetManager.getAssetMetadata(moduleName, assetPath);
            if (!metadata) {
                return res.status(404).json({
                    success: false,
                    message: `Asset '${assetPath}' not found in module '${moduleName}'`
                });
            }

            res.json({
                success: true,
                metadata
            });
        });

        // GET /api/assets - Get all asset manifests
        app.get('/api/assets', (req: Request, res: Response) => {
            const manifests = this.assetManager.getAllManifests();

            res.json({
                success: true,
                modules: manifests.length,
                manifests
            });
        });

        context.logger.debug("Registered asset API routes");
    }
}
