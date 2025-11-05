/**
 * WYRT PROJECTILES MODULE
 *
 * Generic projectile physics system for multiplayer games.
 *
 * PROVIDES:
 * - ProjectileManager class
 * - Velocity-based movement
 * - Collision detection
 * - Hit callbacks
 * - Event-driven architecture
 *
 * USAGE IN OTHER MODULES:
 * ```typescript
 * const projectileManager = context.getModule('wyrt_projectiles').getProjectileManager();
 *
 * // Fire projectile
 * projectileManager.fireProjectile({
 *     ownerId: player.id,
 *     position: player.position,
 *     velocity: { x: 300, y: 0 },
 *     onHit: (projectile, target) => {
 *         // Apply damage or effects
 *     }
 * });
 * ```
 *
 * EVENTS:
 * - wyrt:projectileFired
 * - wyrt:projectileHit
 * - wyrt:projectileExpired
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
import { ProjectileManager } from './systems/ProjectileManager';

export default class WyrtProjectilesModule implements IModule {
    name = 'wyrt_projectiles';
    version = '1.0.0';
    description = 'Generic projectile physics system';
    dependencies = [];

    private context?: ModuleContext;
    private projectileManager?: ProjectileManager;

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;

        // Create projectile manager
        this.projectileManager = new ProjectileManager(context);

        // Store globally for easy access
        (globalThis as any).wyrtProjectileManager = this.projectileManager;

        console.log(`[${this.name}] Initialized`);
    }

    async activate(): Promise<void> {
        console.log(`[${this.name}] Module activated`);
        console.log(`[${this.name}] Projectile system ready`);
    }

    async deactivate(): Promise<void> {
        // Clean up all projectiles
        this.projectileManager?.clearAll();

        delete (globalThis as any).wyrtProjectileManager;
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Get the projectile manager instance
     */
    getProjectileManager(): ProjectileManager {
        if (!this.projectileManager) {
            throw new Error('ProjectileManager not initialized');
        }
        return this.projectileManager;
    }
}
