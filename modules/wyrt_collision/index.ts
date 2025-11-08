/**
 * Collision detection with circle/rectangle tests and wall sliding.
 */

import { IModule, ModuleContext } from '../../src/module/IModule.js';
import { CollisionManager } from './systems/CollisionManager.js';

export default class WyrtCollisionModule implements IModule {
    name = 'wyrt_collision';
    version = '1.0.0';
    description = 'Reusable collision detection system';
    dependencies: string[] = [];

    private context?: ModuleContext;
    private collisionManagers: Map<string, CollisionManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        console.log('[wyrt_collision] Initialized');
    }

    async activate(): Promise<void> {
        console.log('[wyrt_collision] Module activated');
        console.log('[wyrt_collision] Collision detection system ready');
    }

    async deactivate(): Promise<void> {
        for (const manager of this.collisionManagers.values()) {
            manager.clearLayers();
        }
        this.collisionManagers.clear();
        console.log('[wyrt_collision] Module deactivated');
    }

    createCollisionManager(gameId: string): CollisionManager {
        if (this.collisionManagers.has(gameId)) {
            throw new Error(`CollisionManager for game '${gameId}' already exists`);
        }

        const manager = new CollisionManager();
        this.collisionManagers.set(gameId, manager);
        console.log(`[wyrt_collision] Created collision manager for game: ${gameId}`);
        return manager;
    }

    getCollisionManager(gameId: string): CollisionManager {
        const manager = this.collisionManagers.get(gameId);
        if (!manager) {
            throw new Error(`CollisionManager for game '${gameId}' not found. Did you call createCollisionManager()?`);
        }
        return manager;
    }
}
