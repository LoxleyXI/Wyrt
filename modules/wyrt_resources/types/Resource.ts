/**
 * Generic resource node type definitions
 * Used for gathering nodes, mining deposits, fishing spots, etc.
 */

export interface ResourceNodeConfig {
    name: string;           // Node identifier
    maxHp: number;          // Maximum hit points
    respawnTime: number;    // Respawn delay in milliseconds
    items: Array<[number, string]>;  // Loot table: [[weight, itemId], ...]
}

export interface ResourceNodeState {
    id: string;             // Unique instance ID
    type: string;           // Node type (references config)
    hp: number;             // Current hit points
    maxHp: number;          // Maximum hit points
    position: { x: number; y: number };  // World position
    respawnTime?: number;   // Timestamp when node will respawn
}

export interface GatherResult {
    success: boolean;
    item: string | null;    // Item ID from loot table
    nodeId: string;
    position: { x: number; y: number };
    depleted: boolean;      // Did this action deplete the node?
}

export interface DamageResult {
    damage: number;
    remaining: number;      // HP remaining
    depleted: boolean;      // Did the node deplete?
    item: string | null;    // Loot item if depleted
}
