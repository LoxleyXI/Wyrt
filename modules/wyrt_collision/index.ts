/**
 * wyrt_collision Module
 *
 * Reusable collision detection system for multiplayer games
 *
 * Features:
 * - Circle-rectangle collision detection
 * - Circle-circle collision detection
 * - Wall sliding for smooth movement
 * - Collision layers for organized level design
 * - Detailed collision results for physics
 *
 * Usage:
 * ```typescript
 * const collision = context.getModule('wyrt_collision').collision;
 * const blocked = collision.isPositionInCollisionBlock(position, radius, walls);
 * ```
 */

import { IModule, ModuleContext } from '../../src/module/IModule.js';
import { CollisionManager } from './systems/CollisionManager.js';

export default class WyrtCollisionModule implements IModule {
    name = 'wyrt_collision';
    version = '1.0.0';
    description = 'Reusable collision detection system';
    dependencies: string[] = [];

    private context?: ModuleContext;
    public collision!: CollisionManager;

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        this.collision = new CollisionManager();

        console.log('[wyrt_collision] Initialized');
    }

    async activate(): Promise<void> {
        console.log('[wyrt_collision] Module activated');
        console.log('[wyrt_collision] Collision detection system ready');
    }

    async deactivate(): Promise<void> {
        this.collision.clearLayers();
        console.log('[wyrt_collision] Module deactivated');
    }

    getCollisionManager(): CollisionManager {
        return this.collision;
    }
}
