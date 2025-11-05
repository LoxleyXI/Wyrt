/**
 * PROJECTILE MANAGER - Generic Projectile Physics System
 *
 * A reusable system for games with projectile-based combat.
 *
 * FEATURES:
 * - Velocity-based movement (pixels per second)
 * - Circle-circle collision detection
 * - Configurable hit filters (e.g., can't hit same team)
 * - Hit callbacks for game-specific effects
 * - Automatic cleanup (TTL system)
 * - Event-driven architecture
 *
 * USAGE EXAMPLE:
 * ```typescript
 * const projectileManager = new ProjectileManager(context);
 *
 * // Fire a projectile
 * projectileManager.fireProjectile({
 *     ownerId: player.id,
 *     position: { x: 100, y: 200 },
 *     velocity: { x: 300, y: 0 },  // 300 pixels/second to the right
 *     hitFilter: (target) => target.id !== player.id,  // Can't hit self
 *     onHit: (projectile, target) => {
 *         target.takeDamage(25);
 *     }
 * });
 *
 * // Update in game loop (60 FPS)
 * projectileManager.update(deltaTime);
 * ```
 *
 * EVENTS EMITTED:
 * - wyrt:projectileFired { projectileId, ownerId, position, velocity }
 * - wyrt:projectileHit { projectileId, ownerId, targetId, position }
 * - wyrt:projectileExpired { projectileId }
 */

import { ModuleContext } from '../../../src/module/IModule';
import {
    Projectile,
    ProjectileConfig,
    HittableEntity,
    ProjectileHitEvent,
    Position
} from '../types/ProjectileTypes';

const DEFAULT_RADIUS = 8;
const DEFAULT_TTL = 3000;
const DEFAULT_ENTITY_RADIUS = 16;

export class ProjectileManager {
    private context: ModuleContext;
    private projectiles: Map<string, Projectile>;
    private nextProjectileId: number = 0;

    constructor(context: ModuleContext) {
        this.context = context;
        this.projectiles = new Map();
    }

    /**
     * Fire a projectile
     *
     * @param config - Projectile configuration
     * @returns The created projectile
     */
    fireProjectile(config: ProjectileConfig): Projectile {
        const projectileId = `proj_${this.nextProjectileId++}`;
        const now = Date.now();

        const projectile: Projectile = {
            id: projectileId,
            ownerId: config.ownerId,
            position: { ...config.position },
            velocity: { ...config.velocity },
            radius: config.radius || DEFAULT_RADIUS,
            ttl: config.ttl || DEFAULT_TTL,
            createdAt: now,
            expiresAt: now + (config.ttl || DEFAULT_TTL),
            hitFilter: config.hitFilter,
            onHit: config.onHit
        };

        this.projectiles.set(projectileId, projectile);

        // Emit event
        this.context.events.emit('wyrt:projectileFired', {
            projectileId,
            ownerId: config.ownerId,
            position: config.position,
            velocity: config.velocity
        });

        console.log(`[ProjectileManager] Projectile ${projectileId} fired by ${config.ownerId}`);

        return projectile;
    }

    /**
     * Update all projectiles
     *
     * Call this in your game loop with deltaTime (seconds).
     *
     * @param deltaTime - Time since last update (in seconds)
     * @param entities - Entities that can be hit
     * @returns Array of hit events
     */
    update(deltaTime: number, entities: HittableEntity[] = []): ProjectileHitEvent[] {
        const now = Date.now();
        const hits: ProjectileHitEvent[] = [];
        const toRemove: string[] = [];

        for (const projectile of this.projectiles.values()) {
            // Check TTL expiration
            if (now >= projectile.expiresAt) {
                toRemove.push(projectile.id);
                this.context.events.emit('wyrt:projectileExpired', {
                    projectileId: projectile.id
                });
                continue;
            }

            // Move projectile
            projectile.position.x += projectile.velocity.x * deltaTime;
            projectile.position.y += projectile.velocity.y * deltaTime;

            // Check collisions
            const hitEntity = this.checkCollisions(projectile, entities);

            if (hitEntity) {
                // Create hit event
                const hitEvent: ProjectileHitEvent = {
                    projectileId: projectile.id,
                    ownerId: projectile.ownerId,
                    targetId: hitEntity.id,
                    position: { ...projectile.position },
                    timestamp: now
                };

                hits.push(hitEvent);

                // Call hit callback
                if (projectile.onHit) {
                    projectile.onHit(projectile, hitEntity);
                }

                // Emit event
                this.context.events.emit('wyrt:projectileHit', hitEvent);

                // Remove projectile
                toRemove.push(projectile.id);

                console.log(`[ProjectileManager] Projectile ${projectile.id} hit ${hitEntity.id}`);
            }
        }

        // Clean up expired/hit projectiles
        for (const id of toRemove) {
            this.projectiles.delete(id);
        }

        return hits;
    }

    /**
     * Check if projectile collides with any entity
     *
     * Uses circle-circle collision detection.
     *
     * @returns The entity hit, or null if no collision
     */
    private checkCollisions(projectile: Projectile, entities: HittableEntity[]): HittableEntity | null {
        for (const entity of entities) {
            // Skip if owner (can't hit self by default)
            if (entity.id === projectile.ownerId) {
                continue;
            }

            // Apply custom hit filter
            if (projectile.hitFilter && !projectile.hitFilter(entity)) {
                continue;
            }

            // Circle-circle collision
            const entityRadius = entity.radius || DEFAULT_ENTITY_RADIUS;
            const distance = this.getDistance(projectile.position, entity.position);

            if (distance <= projectile.radius + entityRadius) {
                return entity;
            }
        }

        return null;
    }

    /**
     * Remove a specific projectile
     */
    removeProjectile(projectileId: string): boolean {
        return this.projectiles.delete(projectileId);
    }

    /**
     * Get all active projectiles
     */
    getAllProjectiles(): Projectile[] {
        return Array.from(this.projectiles.values());
    }

    /**
     * Get a specific projectile
     */
    getProjectile(projectileId: string): Projectile | null {
        return this.projectiles.get(projectileId) || null;
    }

    /**
     * Get projectiles owned by a specific entity
     */
    getProjectilesByOwner(ownerId: string): Projectile[] {
        return Array.from(this.projectiles.values()).filter(p => p.ownerId === ownerId);
    }

    /**
     * Clear all projectiles
     */
    clearAll(): void {
        this.projectiles.clear();
        console.log('[ProjectileManager] Cleared all projectiles');
    }

    /**
     * Get projectile count
     */
    getCount(): number {
        return this.projectiles.size;
    }

    // ===== HELPER METHODS =====

    /**
     * Calculate distance between two positions
     */
    private getDistance(pos1: Position, pos2: Position): number {
        return Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y);
    }

    /**
     * Normalize a direction vector
     */
    static normalizeDirection(direction: { x: number; y: number }): { x: number; y: number } {
        const magnitude = Math.hypot(direction.x, direction.y);
        if (magnitude === 0) {
            return { x: 0, y: 0 };
        }
        return {
            x: direction.x / magnitude,
            y: direction.y / magnitude
        };
    }

    /**
     * Create velocity from direction and speed
     */
    static createVelocity(direction: { x: number; y: number }, speed: number): { x: number; y: number } {
        const normalized = ProjectileManager.normalizeDirection(direction);
        return {
            x: normalized.x * speed,
            y: normalized.y * speed
        };
    }
}
