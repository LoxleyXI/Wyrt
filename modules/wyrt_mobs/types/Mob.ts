/**
 * Mob Type Definitions
 *
 * Generic mob/NPC types for any Wyrt game.
 * Games can extend these types with game-specific properties.
 */

import { Position, Direction } from '../../wyrt_2d/types/Position2D';

/**
 * Mob template definition (loaded from YAML/JSON data)
 */
export interface MobTemplate {
    id: string;
    name: string;
    description?: string;

    // Level configuration
    level?: number;      // Fixed level
    min?: number;        // Min level (for random range)
    max?: number;        // Max level (for random range)

    // Stats
    stats?: {
        str?: number;
        dex?: number;
        con?: number;
        int?: number;
        wis?: number;
        cha?: number;
        [key: string]: number | undefined; // Allow game-specific stats
    };

    // Combat
    baseHp?: number;     // Base HP (before level scaling)
    hpPerLevel?: number; // HP gained per level
    damage?: number;     // Base damage

    // Behavior
    respawn?: number;    // Respawn time in seconds
    hostile?: boolean;   // Automatically hostile to players
    aggressive?: boolean; // Attacks on sight
    roaming?: boolean;   // Randomly moves around

    // Loot (game-specific, can be any structure)
    loot?: any;

    // Spawn configuration
    spawnPositions?: Array<{ x: number; y: number }>;

    // Game-specific properties
    [key: string]: any;
}

/**
 * Mob instance (spawned in the game world)
 */
export interface MobInstance {
    // Identity
    id: string;
    templateId: string;
    name: string;
    level: number;

    // Health
    hp: number;
    maxHp: number;

    // Location
    zone: string;
    room: string;
    position?: Position;
    direction?: Direction;

    // Combat state
    target: string | null;           // Current target (player ID)
    hostileToPlayers: Set<string>;   // Set of player IDs this mob is hostile to
    lastCombatTime: number;          // Timestamp of last combat action

    // Respawn
    respawnTime: number;             // Time in seconds to respawn
    lastKilled?: number;             // Timestamp when killed

    // Stats (game-specific)
    stats: any;

    // Game-specific properties
    [key: string]: any;
}

/**
 * Mob spawn configuration
 */
export interface MobSpawn {
    id: string;          // Template ID
    x?: number;          // Spawn X position
    y?: number;          // Spawn Y position
    level?: number;      // Level override
}

/**
 * Mob broadcast data (sent to clients)
 */
export interface MobBroadcastData {
    id: string;
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    position?: Position;
    direction?: Direction;
    isHostile?: boolean;
    [key: string]: any;
}

/**
 * Callback for mob events
 */
export interface MobEventCallbacks {
    onMobSpawned?: (mob: MobInstance) => void;
    onMobKilled?: (mob: MobInstance, killerId?: string) => void;
    onMobRespawned?: (mob: MobInstance) => void;
    onMobUpdate?: (mob: MobInstance) => void;
    onMobMoved?: (mob: MobInstance) => void;
    onBroadcastToRoom?: (roomPath: string, message: any, excludePlayerId?: string) => void;
}
