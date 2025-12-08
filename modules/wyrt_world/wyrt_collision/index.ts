/**
 * @module wyrt_collision
 * @description Collision detection system with circle/rectangle tests, layers, and wall sliding
 * @category World
 *
 * @features
 * - Circle-to-circle collision detection
 * - Circle-to-rectangle collision detection
 * - Rectangle-to-rectangle collision detection
 * - Collision layers for filtering (players, projectiles, walls)
 * - Wall sliding for smooth movement along obstacles
 * - Spatial partitioning for performance
 * - TILED map collision layer support
 *
 * @usage
 * ```typescript
 * const collisionModule = context.getModule('wyrt_collision');
 * const collision = collisionModule.createCollisionManager('my_game');
 *
 * // Add collision layers
 * collision.addLayer('walls', wallRectangles);
 * collision.addLayer('players', []);
 *
 * // Check collision with wall sliding
 * const result = collision.moveWithSliding(
 *   { x: 100, y: 100, radius: 16 },
 *   { x: 105, y: 102 },
 *   'walls'
 * );
 * player.x = result.x;
 * player.y = result.y;
 * ```
 *
 * @exports CollisionManager - Handles collision detection and resolution
 */
import { IModule, ModuleContext } from '../../../src/module/IModule.js';
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
