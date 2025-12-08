/**
 * RespawnManager
 *
 * Generic respawn system for multiplayer games
 * Handles death, respawn timers, and spawn point selection
 *
 * Extracted from wyrt_ctf for reusability across all game types
 */

import {
    Position,
    SpawnPoint,
    SpawnConfig,
    RespawnConfig,
    RespawnCallback,
    DeathCallback
} from '../types/RespawnTypes.js';

export class RespawnManager {
    private config: RespawnConfig;
    private spawnConfigs: Map<string, SpawnConfig> = new Map(); // keyed by team/group
    private spawnCounters: Map<string, number> = new Map(); // for round-robin

    // Callbacks for game-specific logic
    private onRespawnCallbacks: RespawnCallback[] = [];
    private onDeathCallbacks: DeathCallback[] = [];

    constructor(config: RespawnConfig) {
        this.config = config;
    }

    /**
     * Register spawn points for a team/group
     */
    registerSpawnPoints(groupId: string, spawnConfig: SpawnConfig): void {
        this.spawnConfigs.set(groupId, spawnConfig);
        if (spawnConfig.selectionMode === 'round-robin') {
            this.spawnCounters.set(groupId, 0);
        }
    }

    /**
     * Mark an entity as dead and schedule respawn
     * Returns the respawn timestamp
     */
    markDead(entityId: string, clearStates?: Record<string, any>): number {
        const respawnAt = Date.now() + this.config.respawnTime;

        // Execute death callbacks
        for (const callback of this.onDeathCallbacks) {
            callback(entityId);
        }

        return respawnAt;
    }

    /**
     * Check if an entity should respawn now
     */
    shouldRespawn(respawnAt: number | null): boolean {
        if (!respawnAt) return false;
        return Date.now() >= respawnAt;
    }

    /**
     * Get spawn position for an entity
     */
    getSpawnPosition(groupId: string): Position | null {
        const spawnConfig = this.spawnConfigs.get(groupId);
        if (!spawnConfig || spawnConfig.spawnPoints.length === 0) {
            return null;
        }

        const spawnPoints = spawnConfig.spawnPoints;
        let index: number;

        switch (spawnConfig.selectionMode) {
            case 'random':
                index = Math.floor(Math.random() * spawnPoints.length);
                break;

            case 'sequential':
                // First available spawn point
                index = 0;
                break;

            case 'round-robin':
                const counter = this.spawnCounters.get(groupId) || 0;
                index = counter % spawnPoints.length;
                this.spawnCounters.set(groupId, counter + 1);
                break;

            default:
                index = 0;
        }

        return { ...spawnPoints[index] };
    }

    /**
     * Respawn an entity at the appropriate spawn point
     */
    respawn(entityId: string, groupId: string): Position | null {
        const spawnPosition = this.getSpawnPosition(groupId);
        if (!spawnPosition) {
            console.error(`[RespawnManager] No spawn points registered for group: ${groupId}`);
            return null;
        }

        // Execute respawn callbacks
        for (const callback of this.onRespawnCallbacks) {
            callback(entityId, spawnPosition);
        }

        return spawnPosition;
    }

    /**
     * Register a callback to be called when an entity respawns
     */
    onRespawn(callback: RespawnCallback): void {
        this.onRespawnCallbacks.push(callback);
    }

    /**
     * Register a callback to be called when an entity dies
     */
    onDeath(callback: DeathCallback): void {
        this.onDeathCallbacks.push(callback);
    }

    /**
     * Get respawn time configuration
     */
    getRespawnTime(): number {
        return this.config.respawnTime;
    }

    /**
     * Update respawn time configuration
     */
    setRespawnTime(time: number): void {
        this.config.respawnTime = time;
    }

    /**
     * Clear all spawn configurations
     */
    clearSpawnConfigs(): void {
        this.spawnConfigs.clear();
        this.spawnCounters.clear();
    }

    /**
     * Get all registered spawn groups
     */
    getSpawnGroups(): string[] {
        return Array.from(this.spawnConfigs.keys());
    }
}
