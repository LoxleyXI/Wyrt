/**
 * @module wyrt_projectiles
 * @description Projectile physics system with velocity-based movement, collision detection, and damage calculation
 * @category Gameplay
 *
 * @features
 * - Velocity-based projectile movement
 * - Collision detection with players and obstacles
 * - Configurable projectile types (bullets, arrows, spells)
 * - Damage calculation on impact
 * - Projectile lifetime and range limits
 * - Game-scoped manager instances
 *
 * @usage
 * ```typescript
 * const projectilesModule = context.getModule('wyrt_projectiles');
 * const projManager = projectilesModule.createProjectileManager('my_game');
 *
 * // Fire a projectile
 * projManager.spawn({
 *   type: 'arrow',
 *   x: 100, y: 200,
 *   velocityX: 10, velocityY: 0,
 *   ownerId: playerId,
 *   damage: 25
 * });
 *
 * // Update projectiles each tick
 * projManager.update(deltaTime);
 * ```
 *
 * @exports ProjectileManager - Manages projectile lifecycle and physics
 */
import { IModule, ModuleContext } from '../../../src/module/IModule';
import { ProjectileManager } from './systems/ProjectileManager';

export default class WyrtProjectilesModule implements IModule {
    name = 'wyrt_projectiles';
    version = '1.0.0';
    description = 'Generic projectile physics system';
    dependencies = [];

    private context?: ModuleContext;
    private projectileManagers: Map<string, ProjectileManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        console.log(`[${this.name}] Initialized`);
    }

    async activate(): Promise<void> {
        console.log(`[${this.name}] Module activated`);
        console.log(`[${this.name}] Projectile system ready`);
    }

    async deactivate(): Promise<void> {
        // Clean up all projectiles in all games
        for (const manager of this.projectileManagers.values()) {
            manager.clearAll();
        }

        this.projectileManagers.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Create a new projectile manager for a specific game
     *
     * @param gameId - Unique identifier for the game (e.g., 'my_game', 'battle_arena')
     * @returns The created projectile manager
     */
    createProjectileManager(gameId: string): ProjectileManager {
        if (this.projectileManagers.has(gameId)) {
            throw new Error(`ProjectileManager for game '${gameId}' already exists`);
        }

        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const manager = new ProjectileManager(this.context);
        this.projectileManagers.set(gameId, manager);

        console.log(`[${this.name}] Created projectile manager for game: ${gameId}`);
        return manager;
    }

    /**
     * Get a projectile manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The projectile manager for that game
     */
    getProjectileManager(gameId: string): ProjectileManager {
        const manager = this.projectileManagers.get(gameId);
        if (!manager) {
            throw new Error(`ProjectileManager for game '${gameId}' not found. Did you call createProjectileManager()?`);
        }
        return manager;
    }
}
