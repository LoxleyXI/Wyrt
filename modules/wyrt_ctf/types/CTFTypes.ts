/**
 * CAPTURE THE FLAG - TYPE DEFINITIONS
 *
 * This file defines all the TypeScript types used in the CTF demo game.
 * These types ensure type safety and provide clear documentation of data structures.
 *
 * LEARNING POINTS:
 * - How to structure game data types
 * - Union types for state management ('red' | 'blue')
 * - Optional vs required fields (? operator)
 * - Using Maps for entity storage
 */

// Import position/direction types from wyrt_2d module (shared across all 2D games)
import { Position, Direction, Velocity } from '../../wyrt_2d/types/Position2D';

// Re-export for convenience
export { Position, Direction, Velocity };

/**
 * Team identifier
 */
export type Team = 'red' | 'blue';

/**
 * Game match status
 */
export type MatchStatus = 'waiting' | 'playing' | 'ended';

/**
 * Flag state
 */
export type FlagState = 'at_base' | 'carried' | 'dropped';

/**
 * Weapon types available in the game
 */
export type WeaponType = 'stun_gun' | 'speed_boost' | 'shield';

/**
 * Active boost type (for speed/shield power-ups)
 */
export type BoostType = 'speed' | 'shield';

/**
 * Player state in the CTF game
 *
 * Contains all information about a player including:
 * - Identity (id, name, team)
 * - Position and movement
 * - Flag carrying status
 * - Combat state (stunned)
 * - Items and boosts
 */
export interface CTFPlayer {
    // Identity
    id: string;
    name: string;
    team: Team;

    // Position
    position: Position;
    direction: Direction;

    // Flag
    carryingFlag: boolean;

    // Combat
    stunned: boolean;
    stunnedUntil: number | null;  // Timestamp when stun ends

    // Death/Respawn
    respawning: boolean;
    respawnAt: number | null;  // Timestamp when player respawns

    // Items
    weapon: WeaponType | null;
    weaponCharges: number;  // How many shots/uses left

    activeBoost: BoostType | null;
    boostEndsAt: number | null;  // Timestamp when boost ends

    // Disconnect detection
    lastActivityTime: number;  // Timestamp of last activity (for disconnect detection)
}

/**
 * Flag state
 *
 * A flag can be:
 * - At base (ready to be captured)
 * - Carried by a player
 * - Dropped on the ground (can be returned or captured)
 */
export interface Flag {
    team: Team;
    state: FlagState;
    position: Position;
    carriedBy: string | null;  // Player ID
    droppedAt: number | null;   // Timestamp when dropped
}

/**
 * Weapon spawn point
 *
 * Weapons spawn at fixed locations and respawn after being picked up.
 */
export interface WeaponSpawn {
    id: string;
    type: WeaponType;
    spawnPosition: Position;
    respawnTime: number;  // Milliseconds

    // Current state
    pickedUpBy: string | null;  // Player ID
    respawnAt: number | null;   // Timestamp when respawns
}

/**
 * Projectile (for stun gun shots)
 *
 * Projectiles move in a straight line and stun on collision.
 */
export interface Projectile {
    id: string;
    playerId: string;  // Who fired it
    team: Team;

    position: Position;
    velocity: Velocity;

    createdAt: number;  // Timestamp
}

/**
 * Match score
 */
export interface Score {
    red: number;
    blue: number;
}

/**
 * Complete game state
 *
 * This is the master state object that contains everything
 * about the current match.
 */
export interface CTFGameState {
    matchId: string;
    status: MatchStatus;

    // Scoring
    scores: Score;
    captureLimit: number;  // First team to reach this wins

    // Flags
    flags: {
        red: Flag;
        blue: Flag;
    };

    // Entities (using Maps for O(1) lookup)
    players: Map<string, CTFPlayer>;
    weapons: Map<string, WeaponSpawn>;
    projectiles: Map<string, Projectile>;

    // Match timing
    startedAt: number | null;
    endedAt: number | null;
    winnerId: Team | null;
}

/**
 * Base configuration (from map data)
 */
export interface TeamBase {
    team: Team;
    position: Position;
    spawnPoints: Position[];  // Where players spawn
}

/**
 * Map configuration
 */
export interface MapConfig {
    id: string;
    name: string;
    width: number;
    height: number;
    tileSize: number;

    // Team bases
    bases: {
        red: TeamBase;
        blue: TeamBase;
    };

    // Weapon spawn locations
    weaponSpawns: Array<{
        position: Position;
        type: WeaponType;
    }>;

    // Collision data (array of rectangles that block movement)
    collisionLayer: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
}
