/**
 * wyrt_respawn Module
 *
 * Generic respawn system for multiplayer games
 *
 * Features:
 * - Respawn timers and countdown
 * - Spawn point selection (random, sequential, round-robin)
 * - Death state management
 * - Respawn callbacks for game-specific logic
 * - Support for team-based or group-based spawning
 *
 * Usage:
 * ```typescript
 * const respawn = context.getModule('wyrt_respawn').getRespawnManager();
 *
 * // Register spawn points for a team
 * respawn.registerSpawnPoints('red', {
 *   spawnPoints: [{ x: 100, y: 100 }, { x: 120, y: 100 }],
 *   selectionMode: 'random'
 * });
 *
 * // Mark player as dead
 * const respawnAt = respawn.markDead(playerId);
 * player.respawning = true;
 * player.respawnAt = respawnAt;
 *
 * // In game loop, check for respawn
 * if (respawn.shouldRespawn(player.respawnAt)) {
 *   const spawnPos = respawn.respawn(playerId, player.team);
 *   player.position = spawnPos;
 *   player.respawning = false;
 *   player.respawnAt = null;
 * }
 * ```
 */

import { IModule, ModuleContext } from '../../src/module/IModule.js';
import { RespawnManager } from './systems/RespawnManager.js';

export default class WyrtRespawnModule implements IModule {
    name = 'wyrt_respawn';
    version = '1.0.0';
    description = 'Generic respawn system for multiplayer games';
    dependencies: string[] = [];

    private context?: ModuleContext;
    private respawnManager!: RespawnManager;

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;

        // Create respawn manager with default 5-second respawn time
        this.respawnManager = new RespawnManager({
            respawnTime: 5000,
            updateActivityOnRespawn: true
        });

        console.log('[wyrt_respawn] Initialized');
    }

    async activate(): Promise<void> {
        console.log('[wyrt_respawn] Module activated');
        console.log('[wyrt_respawn] Respawn system ready');
    }

    async deactivate(): Promise<void> {
        this.respawnManager.clearSpawnConfigs();
        console.log('[wyrt_respawn] Module deactivated');
    }

    getRespawnManager(): RespawnManager {
        return this.respawnManager;
    }
}
