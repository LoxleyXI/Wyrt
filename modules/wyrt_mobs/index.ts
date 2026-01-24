/**
 * @module wyrt_mobs
 * @description Mob spawning and management system
 * @category Combat
 *
 * Uses Entity table from wyrt_data for mob definitions (type='mob').
 * Manages mob instances, spawning, respawning, and combat state.
 *
 * @features
 * - Load mob templates from database
 * - Spawn/despawn mob instances
 * - Room-based mob tracking
 * - Respawn queue with configurable timers
 * - Threat tables for AI targeting
 * - Combat damage/healing integration
 * - Spawn point configuration
 *
 * @usage
 * ```typescript
 * const mobModule = context.getModule('wyrt_mobs');
 * const mobs = mobModule.createMobSystem('my_game', {
 *   defaultRespawnTime: 30000,
 *   maxMobsPerRoom: 10,
 * });
 *
 * // Initialize (loads templates, starts respawn timer)
 * await mobs.initialize();
 *
 * // Register spawn points
 * mobs.registerSpawnPoint('forest_1', 'goblin', { maxCount: 3, respawnTime: 60000 });
 * mobs.registerSpawnPoint('forest_1', 'wolf', { maxCount: 2 });
 *
 * // Spawn initial mobs
 * mobs.spawnAllInitial();
 *
 * // Get mobs in a room
 * const roomMobs = mobs.getMobsInRoom('forest_1');
 *
 * // Find mob by name
 * const goblin = mobs.findMobInRoom('forest_1', 'goblin');
 *
 * // Combat
 * const result = mobs.damageMob(goblin.instanceId, 25, characterId);
 * if (result.killed) {
 *   // mob:killed event has been emitted with loot info
 * }
 * ```
 *
 * @events
 * - `mob:spawned` - { instanceId, mobSlug, roomId, name, level }
 * - `mob:despawned` - { instanceId, mobSlug, roomId }
 * - `mob:killed` - { instanceId, mobSlug, name, level, roomId, killerId, killers, expReward, goldReward, lootTable, lootInline }
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
import { MobSystem, MobSystemConfig, MobInstance, MobTemplate, SpawnPoint, MobAPI } from './systems/MobSystem';
import type DataModule from '../wyrt_data/index.js';
import colors from 'colors/safe';

// Re-export types
export { MobSystem, MobSystemConfig, MobInstance, MobTemplate, SpawnPoint, MobAPI };

export default class MobModule implements IModule {
  name = 'wyrt_mobs';
  version = '1.0.0';
  description = 'Mob spawning and management system';
  dependencies = ['wyrt_data'];

  private context?: ModuleContext;
  private dataModule?: DataModule;
  private mobSystems: Map<string, MobSystem> = new Map();

  async initialize(context: ModuleContext): Promise<void> {
    this.context = context;
    // Note: wyrt_data is retrieved in activate() to handle load order
    console.log(`[${this.name}] Initialized`);
  }

  async activate(context: ModuleContext): Promise<void> {
    // Get wyrt_data module for database access (done in activate to handle load order)
    this.dataModule = context.getModule?.('wyrt_data') as DataModule;
    if (!this.dataModule) {
      throw new Error('[wyrt_mobs] wyrt_data module is required');
    }

    context.logger.debug(colors.green('+module ') + 'wyrt_mobs');
    context.events.emit('mobModuleActivated');
    console.log(`[${this.name}] Activated with wyrt_data backend`);
  }

  async deactivate(context: ModuleContext): Promise<void> {
    // Shutdown all mob systems
    for (const system of this.mobSystems.values()) {
      system.shutdown();
    }
    this.mobSystems.clear();
    console.log(`[${this.name}] Module deactivated`);
  }

  /**
   * Create a mob system for a specific game.
   *
   * @param gameId - The game identifier
   * @param config - Mob system configuration
   * @returns The mob system instance
   */
  createMobSystem(gameId: string, config?: MobSystemConfig): MobSystem {
    if (this.mobSystems.has(gameId)) {
      return this.mobSystems.get(gameId)!;
    }

    if (!this.context || !this.dataModule) {
      throw new Error('Module not initialized');
    }

    const system = new MobSystem(this.context, this.dataModule, gameId, config);
    this.mobSystems.set(gameId, system);
    console.log(`[${this.name}] Created mob system for game: ${gameId}`);
    return system;
  }

  /**
   * Get an existing mob system for a game.
   *
   * @param gameId - The game identifier
   * @returns The mob system instance
   * @throws Error if the system hasn't been created
   */
  getMobSystem(gameId: string): MobSystem {
    const system = this.mobSystems.get(gameId);
    if (!system) {
      throw new Error(`MobSystem for game '${gameId}' not found. Did you call createMobSystem()?`);
    }
    return system;
  }
}
