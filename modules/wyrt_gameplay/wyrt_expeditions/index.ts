/**
 * @module wyrt_expeditions
 * @description Generic timed expedition system for RPG games
 * @category Gameplay
 *
 * @features
 * - Timed expeditions with configurable durations
 * - Party-based expedition support
 * - Cooldown system per expedition type
 * - Bonus modifiers (duration, rewards, success chance)
 * - Event system for expedition progress/story
 * - Game-specific reward generation via config hooks
 * - Availability filtering by level/region/unlocks
 *
 * @usage
 * ```typescript
 * // In your game module's activate():
 * const expeditionsModule = context.getModule('wyrt_expeditions');
 * const expeditionManager = expeditionsModule.createExpeditionManager({
 *   gameId: 'mygame',
 *   generateRewards: (params) => {
 *     // Your reward generation here
 *     return {
 *       experience: 100 * params.successLevel,
 *       currency: 50,
 *       items: [{ itemId: 'ore', quantity: 5 }],
 *     };
 *   },
 * });
 *
 * // Register expedition types
 * expeditionManager.registerExpeditionType({
 *   id: 'forest_patrol',
 *   name: 'Forest Patrol',
 *   description: 'Scout the nearby forest for resources.',
 *   minLevel: 1,
 *   baseDuration: 30 * 60 * 1000, // 30 minutes
 *   minPartySize: 1,
 *   maxPartySize: 4,
 *   tier: 'quick',
 *   difficulty: 1,
 *   rewardTiers: ['common', 'uncommon'],
 * });
 *
 * // Start an expedition
 * const expedition = expeditionManager.startExpedition('forest_patrol', {
 *   memberIds: ['player1', 'player2'],
 *   stats: { attack: 50, defense: 30 },
 *   bonuses: ['forest_bonus'],
 *   averageLevel: 5,
 * });
 *
 * // Check progress
 * const progress = expeditionManager.getProgress(expedition.id);
 * ```
 *
 * @exports ExpeditionManager - Per-game expedition manager instance
 * @exports IExpeditionConfig - Configuration interface for games
 */

import { IModule } from '../../../src/module/IModule.js';
import { ModuleContext } from '../../../src/module/ModuleContext.js';
import { ExpeditionManager } from './ExpeditionManager.js';
import { IExpeditionConfig } from './types.js';

// Re-export types for consumers
export * from './types.js';
export { ExpeditionManager } from './ExpeditionManager.js';

export default class ExpeditionsModule implements IModule {
  name = 'wyrt_expeditions';
  version = '1.0.0';
  description = 'Generic timed expedition system for RPG games';
  dependencies = [];

  private context?: ModuleContext;
  private managers: Map<string, ExpeditionManager> = new Map();

  async initialize(context: ModuleContext): Promise<void> {
    this.context = context;
    context.logger.info('[wyrt_expeditions] Initializing expeditions module...');
  }

  async activate(context: ModuleContext): Promise<void> {
    context.logger.info('[wyrt_expeditions] Expeditions module activated');
  }

  async deactivate(context: ModuleContext): Promise<void> {
    // Clean up all expedition managers
    for (const manager of this.managers.values()) {
      manager.cleanup();
    }
    this.managers.clear();
    context.logger.info('[wyrt_expeditions] Expeditions module deactivated');
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a game-scoped expedition manager.
   * Each game should call this once during activation.
   *
   * @param config - Game-specific expedition configuration
   * @returns ExpeditionManager instance for the game
   */
  createExpeditionManager(config: IExpeditionConfig): ExpeditionManager {
    if (!this.context) {
      throw new Error('Expeditions module not initialized');
    }

    if (this.managers.has(config.gameId)) {
      throw new Error(`ExpeditionManager for game '${config.gameId}' already exists`);
    }

    const manager = new ExpeditionManager(this.context, config);
    this.managers.set(config.gameId, manager);

    this.context.logger.info(
      `[wyrt_expeditions] Created ExpeditionManager for game '${config.gameId}'`
    );

    return manager;
  }

  /**
   * Get an existing expedition manager for a game.
   *
   * @param gameId - The game's unique identifier
   * @returns ExpeditionManager instance or undefined
   */
  getExpeditionManager(gameId: string): ExpeditionManager | undefined {
    return this.managers.get(gameId);
  }

  /**
   * Check if an expedition manager exists for a game.
   *
   * @param gameId - The game's unique identifier
   */
  hasExpeditionManager(gameId: string): boolean {
    return this.managers.has(gameId);
  }
}
