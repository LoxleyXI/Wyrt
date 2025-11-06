import { ModuleContext } from "../../../src/module/ModuleContext";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AssetManifest {
    module: string;
    assets: {
        [category: string]: string[];
    };
    totalSize: number;
    assetCount: number;
}

export class AssetManager {
    private context: ModuleContext;
    private manifests: Map<string, AssetManifest> = new Map();

    constructor(context: ModuleContext) {
        this.context = context;
    }

    /**
     * Scan a module's asset directory and build manifest
     */
    public scanModuleAssets(moduleName: string): AssetManifest | null {
        const moduleAssetsPath = path.join(
            process.cwd(),
            "modules",
            moduleName,
            "www",
            "public",
            "assets"
        );

        if (!fs.existsSync(moduleAssetsPath)) {
            this.context.logger.debug(`No assets directory for module: ${moduleName}`);
            return null;
        }

        const manifest: AssetManifest = {
            module: moduleName,
            assets: {},
            totalSize: 0,
            assetCount: 0
        };

        this.scanDirectory(moduleAssetsPath, moduleAssetsPath, manifest);
        this.manifests.set(moduleName, manifest);

        this.context.logger.debug(
            `Scanned ${manifest.assetCount} assets (${this.formatBytes(manifest.totalSize)}) for ${moduleName}`
        );

        return manifest;
    }

    /**
     * Recursively scan directory for assets
     */
    private scanDirectory(basePath: string, currentPath: string, manifest: AssetManifest): void {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
            const fullPath = path.join(currentPath, item);
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
                // Recursively scan subdirectory
                this.scanDirectory(basePath, fullPath, manifest);
            } else if (stats.isFile()) {
                // Get relative path from base assets directory
                const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

                // Get category (first directory in path)
                const category = relativePath.split('/')[0] || 'root';

                if (!manifest.assets[category]) {
                    manifest.assets[category] = [];
                }

                manifest.assets[category].push(relativePath);
                manifest.totalSize += stats.size;
                manifest.assetCount++;
            }
        }
    }

    /**
     * Get asset manifest for a module
     */
    public getManifest(moduleName: string): AssetManifest | null {
        // Return cached manifest or scan if not cached
        if (this.manifests.has(moduleName)) {
            return this.manifests.get(moduleName)!;
        }

        return this.scanModuleAssets(moduleName);
    }

    /**
     * Get all manifests
     */
    public getAllManifests(): AssetManifest[] {
        return Array.from(this.manifests.values());
    }

    /**
     * Check if an asset exists for a module
     */
    public assetExists(moduleName: string, assetPath: string): boolean {
        const fullPath = path.join(
            process.cwd(),
            "modules",
            moduleName,
            "www",
            "public",
            "assets",
            assetPath
        );

        return fs.existsSync(fullPath);
    }

    /**
     * Get asset metadata
     */
    public getAssetMetadata(moduleName: string, assetPath: string): any {
        const fullPath = path.join(
            process.cwd(),
            "modules",
            moduleName,
            "www",
            "public",
            "assets",
            assetPath
        );

        if (!fs.existsSync(fullPath)) {
            return null;
        }

        const stats = fs.statSync(fullPath);
        const ext = path.extname(assetPath).toLowerCase();

        return {
            path: assetPath,
            size: stats.size,
            sizeFormatted: this.formatBytes(stats.size),
            type: this.getAssetType(ext),
            extension: ext,
            modified: stats.mtime
        };
    }

    /**
     * Get assets by category for a module
     */
    public getAssetsByCategory(moduleName: string, category: string): string[] {
        const manifest = this.getManifest(moduleName);
        if (!manifest || !manifest.assets[category]) {
            return [];
        }

        return manifest.assets[category];
    }

    /**
     * Determine asset type from extension
     */
    private getAssetType(ext: string): string {
        const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a'];
        const videoExts = ['.mp4', '.webm', '.ogv'];
        const dataExts = ['.json', '.yaml', '.yml', '.xml'];

        if (imageExts.includes(ext)) return 'image';
        if (audioExts.includes(ext)) return 'audio';
        if (videoExts.includes(ext)) return 'video';
        if (dataExts.includes(ext)) return 'data';

        return 'other';
    }

    /**
     * Format bytes to human-readable string
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}
