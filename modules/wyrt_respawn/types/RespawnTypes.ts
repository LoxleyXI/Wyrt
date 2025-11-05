/**
 * Respawn System Types
 *
 * Generic respawn system for multiplayer games
 */

export interface Position {
    x: number;
    y: number;
}

export interface RespawnableEntity {
    id: string;
    respawning: boolean;
    respawnAt: number | null;
    position: Position;
    lastActivityTime?: number;
}

export interface SpawnPoint {
    x: number;
    y: number;
}

export interface SpawnConfig {
    spawnPoints: SpawnPoint[];
    selectionMode: 'random' | 'sequential' | 'round-robin';
}

export interface RespawnConfig {
    respawnTime: number;  // Milliseconds
    clearStatesOnDeath?: string[];  // Property names to clear
    updateActivityOnRespawn?: boolean;
}

export interface RespawnEvent {
    entityId: string;
    respawnAt: number;
    position?: Position;
}

export interface DeathEvent {
    entityId: string;
    position?: Position;
}

export type RespawnCallback = (entityId: string, spawnPosition: Position) => void;
export type DeathCallback = (entityId: string) => void;
