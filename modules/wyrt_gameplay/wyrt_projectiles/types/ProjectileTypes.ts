/**
 * WYRT PROJECTILES MODULE - TYPE DEFINITIONS
 *
 * Generic projectile physics system for multiplayer games.
 *
 * FEATURES:
 * - Velocity-based movement
 * - Collision detection (circle-circle)
 * - Configurable hit effects via callbacks
 * - Time-to-live (TTL) system
 *
 * USE CASES:
 * - Bullets, arrows, fireballs, grenades
 * - Any game with projectile weapons
 * - Spells with travel time
 */

/**
 * Position in 2D space
 */
export interface Position {
    x: number;
    y: number;
}

/**
 * Velocity vector
 */
export interface Velocity {
    x: number;
    y: number;
}

/**
 * Entity that can be hit by projectiles
 */
export interface HittableEntity {
    id: string;
    position: Position;
    radius?: number;  // Collision radius (default: 16)
}

/**
 * Projectile configuration
 */
export interface ProjectileConfig {
    ownerId: string;           // Who fired it
    position: Position;        // Starting position
    velocity: Velocity;        // Movement speed (pixels per second)
    radius?: number;           // Collision radius (default: 8)
    ttl?: number;              // Time to live in ms (default: 3000)
    hitFilter?: (target: HittableEntity) => boolean;  // Custom hit validation
    onHit?: (projectile: Projectile, target: HittableEntity) => void;  // Hit callback
}

/**
 * Active projectile
 */
export interface Projectile {
    id: string;
    ownerId: string;
    position: Position;
    velocity: Velocity;
    radius: number;
    ttl: number;
    createdAt: number;
    expiresAt: number;
    hitFilter?: (target: HittableEntity) => boolean;
    onHit?: (projectile: Projectile, target: HittableEntity) => void;
}

/**
 * Projectile hit event
 */
export interface ProjectileHitEvent {
    projectileId: string;
    ownerId: string;
    targetId: string;
    position: Position;
    timestamp: number;
}
