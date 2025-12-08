/**
 * Type definitions for the pickup system.
 */

/**
 * Position in 2D space
 */
export interface Position {
    x: number;
    y: number;
}

/**
 * Item type identifier (game-defined)
 */
export type ItemType = string;

/**
 * Pickup configuration (spawn point)
 */
export interface PickupConfig {
    id: string;
    itemType: ItemType;
    position: Position;
    roomId?: string;           // Optional room identifier (e.g., "zone:room")
    respawnTime: number;      // Milliseconds (0 = never respawns)
    pickupRange?: number;      // Detection radius (default: 32)
    persistent?: boolean;      // If true, doesn't despawn on pickup
    maxUses?: number;          // How many times it can be picked up (null = infinite)
}

/**
 * Active pickup state
 */
export interface Pickup extends PickupConfig {
    available: boolean;         // Can be picked up
    pickedUpBy: string | null;  // Player ID (null if available)
    respawnAt: number | null;   // Timestamp when it respawns
    usesRemaining: number | null;  // null = infinite
    spawnedAt: number;
}

/**
 * Pickup event data (emitted on pickup)
 */
export interface PickupEvent {
    pickupId: string;
    itemType: ItemType;
    playerId: string;
    position: Position;
    timestamp: number;
}

/**
 * Respawn event data
 */
export interface RespawnEvent {
    pickupId: string;
    itemType: ItemType;
    position: Position;
    timestamp: number;
}
