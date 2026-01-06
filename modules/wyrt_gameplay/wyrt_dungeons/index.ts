/**
 * @module wyrt_dungeons
 * @description Generic room-graph dungeon system for RPG games
 * @category Gameplay
 *
 * @features
 * - Room-graph based dungeon progression
 * - Multiple room types (combat, treasure, rest, event, boss, etc.)
 * - Party dungeon support with checkpoints
 * - Speed run medals and timing
 * - Death/wipe handling with revives
 * - Game-specific encounter and loot generation via config hooks
 * - Event system with branching choices
 *
 * @usage
 * ```typescript
 * // In your game module's activate():
 * const dungeonsModule = context.getModule('wyrt_dungeons');
 * const dungeonManager = dungeonsModule.createDungeonManager({
 *   gameId: 'mygame',
 *   generateEncounter: (params) => {
 *     // Your encounter generation here
 *     return {
 *       type: 'normal',
 *       enemies: [{ enemyId: 'goblin', level: params.partyLevel }],
 *     };
 *   },
 *   generateLoot: (params) => {
 *     // Your loot generation here
 *     return {
 *       currency: 100,
 *       experience: 50,
 *       items: [{ itemId: 'gold_coin', quantity: 10 }],
 *     };
 *   },
 * });
 *
 * // Register dungeon types
 * dungeonManager.registerDungeonType({
 *   id: 'goblin_cave',
 *   name: 'Goblin Cave',
 *   description: 'A cave infested with goblins.',
 *   minLevel: 5,
 *   recommendedLevel: 8,
 *   minPartySize: 1,
 *   maxPartySize: 4,
 *   difficulty: 'normal',
 *   floorCount: 3,
 *   layout: {
 *     rooms: [...],
 *     entryRoomId: 'entry',
 *     bossRoomId: 'boss',
 *     isLinear: true,
 *   },
 * });
 *
 * // Start a dungeon run
 * const run = dungeonManager.startRun('goblin_cave', {
 *   memberIds: ['player1'],
 *   memberStates: new Map([...]),
 *   averageLevel: 8,
 *   bonuses: [],
 * });
 *
 * // Enter rooms
 * dungeonManager.enterRoom(run.id, 'room_1');
 * ```
 *
 * @exports DungeonManager - Per-game dungeon manager instance
 * @exports IDungeonConfig - Configuration interface for games
 */

import { IModule } from '../../../src/module/IModule.js';
import { ModuleContext } from '../../../src/module/ModuleContext.js';
import { DungeonManager } from './DungeonManager.js';
import { IDungeonConfig } from './types.js';

// Re-export types for consumers
export * from './types.js';
export { DungeonManager } from './DungeonManager.js';

export default class DungeonsModule implements IModule {
  name = 'wyrt_dungeons';
  version = '1.0.0';
  description = 'Generic room-graph dungeon system for RPG games';
  dependencies = [];

  private context?: ModuleContext;
  private managers: Map<string, DungeonManager> = new Map();

  async initialize(context: ModuleContext): Promise<void> {
    this.context = context;
    context.logger.info('[wyrt_dungeons] Initializing dungeons module...');
  }

  async activate(context: ModuleContext): Promise<void> {
    context.logger.info('[wyrt_dungeons] Dungeons module activated');
  }

  async deactivate(context: ModuleContext): Promise<void> {
    // Clean up all dungeon managers
    for (const manager of this.managers.values()) {
      manager.cleanup();
    }
    this.managers.clear();
    context.logger.info('[wyrt_dungeons] Dungeons module deactivated');
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a game-scoped dungeon manager.
   * Each game should call this once during activation.
   *
   * @param config - Game-specific dungeon configuration
   * @returns DungeonManager instance for the game
   */
  createDungeonManager(config: IDungeonConfig): DungeonManager {
    if (!this.context) {
      throw new Error('Dungeons module not initialized');
    }

    if (this.managers.has(config.gameId)) {
      throw new Error(`DungeonManager for game '${config.gameId}' already exists`);
    }

    const manager = new DungeonManager(this.context, config);
    this.managers.set(config.gameId, manager);

    this.context.logger.info(
      `[wyrt_dungeons] Created DungeonManager for game '${config.gameId}'`
    );

    return manager;
  }

  /**
   * Get an existing dungeon manager for a game.
   *
   * @param gameId - The game's unique identifier
   * @returns DungeonManager instance or undefined
   */
  getDungeonManager(gameId: string): DungeonManager | undefined {
    return this.managers.get(gameId);
  }

  /**
   * Check if a dungeon manager exists for a game.
   *
   * @param gameId - The game's unique identifier
   */
  hasDungeonManager(gameId: string): boolean {
    return this.managers.has(gameId);
  }
}
