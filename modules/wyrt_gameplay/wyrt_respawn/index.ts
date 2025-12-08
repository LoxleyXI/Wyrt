/**
 * @module wyrt_respawn
 * @description Respawn system with configurable timers, spawn point selection, and team-based spawning
 * @category Gameplay
 *
 * @features
 * - Configurable respawn timers per player or globally
 * - Multiple spawn point configurations
 * - Team-based spawn point assignment
 * - Random or sequential spawn selection
 * - Activity tracking on respawn
 * - Respawn callbacks and events
 *
 * @usage
 * ```typescript
 * const respawnModule = context.getModule('wyrt_respawn');
 * const respawnManager = respawnModule.createRespawnManager('my_game', {
 *   respawnTime: 5000,  // 5 seconds
 *   updateActivityOnRespawn: true
 * });
 *
 * // Add spawn points
 * respawnManager.addSpawnPoint('team_a', { x: 100, y: 100 });
 * respawnManager.addSpawnPoint('team_b', { x: 900, y: 100 });
 *
 * // Queue player for respawn
 * respawnManager.queueRespawn(playerId, 'team_a');
 * ```
 *
 * @exports RespawnManager - Manages spawn points and respawn queues
 */
import { IModule, ModuleContext } from '../../../src/module/IModule.js';
import { RespawnManager } from './systems/RespawnManager.js';

export default class WyrtRespawnModule implements IModule {
    name = 'wyrt_respawn';
    version = '1.0.0';
    description = 'Generic respawn system for multiplayer games';
    dependencies: string[] = [];

    private context?: ModuleContext;
    private respawnManagers: Map<string, RespawnManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        console.log('[wyrt_respawn] Initialized');
    }

    async activate(): Promise<void> {
        console.log('[wyrt_respawn] Module activated');
        console.log('[wyrt_respawn] Respawn system ready');
    }

    async deactivate(): Promise<void> {
        for (const manager of this.respawnManagers.values()) {
            manager.clearSpawnConfigs();
        }
        this.respawnManagers.clear();
        console.log('[wyrt_respawn] Module deactivated');
    }

    createRespawnManager(gameId: string, options?: { respawnTime?: number, updateActivityOnRespawn?: boolean }): RespawnManager {
        if (this.respawnManagers.has(gameId)) {
            throw new Error(`RespawnManager for game '${gameId}' already exists`);
        }

        const manager = new RespawnManager({
            respawnTime: options?.respawnTime || 5000,
            updateActivityOnRespawn: options?.updateActivityOnRespawn !== false
        });
        this.respawnManagers.set(gameId, manager);
        console.log(`[wyrt_respawn] Created respawn manager for game: ${gameId}`);
        return manager;
    }

    getRespawnManager(gameId: string): RespawnManager {
        const manager = this.respawnManagers.get(gameId);
        if (!manager) {
            throw new Error(`RespawnManager for game '${gameId}' not found. Did you call createRespawnManager()?`);
        }
        return manager;
    }
}
