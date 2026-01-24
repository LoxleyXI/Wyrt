/**
 * @module wyrt_companion
 * @description AI companion system with conversation, memory, and combat support
 * @category Companions
 *
 * Provides AI-powered companions for games using the Claude API.
 * Supports conversation memory, relationship tracking, combat assistance,
 * and tier-based access control.
 *
 * @features
 * - AI-powered conversations with Claude
 * - Persistent memory (long-term and session)
 * - Relationship tracking (0-100 scale)
 * - Companion leveling and XP
 * - Combat auto-attacks and abilities
 * - Milestone event responses
 * - Tier-based access control
 * - Configurable personality system
 *
 * @usage
 * ```typescript
 * const companionModule = context.getModule('wyrt_companion');
 *
 * // Create companion system for a game
 * const companion = companionModule.createCompanionSystem('my_game', {
 *   gameName: 'My Adventure',
 *   gameDescription: 'a fantasy role-playing game',
 *   dataDir: './data/companions',
 *   apiKey: process.env.ANTHROPIC_API_KEY
 * });
 *
 * // Connect player
 * await companion.service.onPlayerConnect(playerId, playerName);
 *
 * // Handle player message
 * const response = await companion.service.onPlayerMessage(
 *   playerId,
 *   'Hello companion!',
 *   gameContext,
 *   'basic'
 * );
 *
 * // Award XP from combat
 * const result = companion.service.awardXp(playerId, 25);
 * if (result.leveledUp) {
 *   console.log(`Companion leveled up to ${result.newLevel}!`);
 * }
 * ```
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
import { join } from 'path';
import colors from 'colors/safe';

// Import systems
import { MemoryManager, MemoryManagerConfig } from './systems/MemoryManager';
import { CompanionService, CompanionServiceConfig } from './systems/CompanionService';
import { CompanionCombatManager, CompanionCombatCallbacks, CompanionAttackResult, CombatParticipant } from './systems/CompanionCombat';

// Import and re-export types
import {
  MilestoneEvent,
  GameEvent,
  CompanionProfile,
  CompanionStats,
  CompanionMemory,
  Message,
  GameContext,
  CompanionConfig,
  SubscriptionTier,
  TierCompanionConfig,
  CompanionModuleConfig,
  CompanionCombatConfig,
  CompanionAbility,
  DEFAULT_CONFIG,
  DEFAULT_TIER_CONFIG,
  DEFAULT_COMPANION_PROFILE,
  DEFAULT_COMPANION_STATS,
  DEFAULT_COMBAT_CONFIG,
  getXpForLevel,
  getXpToNextLevel,
} from './types';

// Re-export all types
export {
  MilestoneEvent,
  GameEvent,
  CompanionProfile,
  CompanionStats,
  CompanionMemory,
  Message,
  GameContext,
  CompanionConfig,
  SubscriptionTier,
  TierCompanionConfig,
  CompanionModuleConfig,
  CompanionCombatConfig,
  CompanionAbility,
  DEFAULT_CONFIG,
  DEFAULT_TIER_CONFIG,
  DEFAULT_COMPANION_PROFILE,
  DEFAULT_COMPANION_STATS,
  DEFAULT_COMBAT_CONFIG,
  getXpForLevel,
  getXpToNextLevel,
  // Systems
  MemoryManager,
  MemoryManagerConfig,
  CompanionService,
  CompanionServiceConfig,
  CompanionCombatManager,
  CompanionCombatCallbacks,
  CompanionAttackResult,
  CombatParticipant,
};

export interface CompanionSystemConfig {
  gameName?: string;
  gameDescription?: string;
  dataDir?: string;
  apiKey?: string;
  tierConfig?: Record<string, TierCompanionConfig>;
  defaultProfile?: CompanionProfile;
  combatConfig?: Partial<CompanionCombatConfig>;
  combatCallbacks?: CompanionCombatCallbacks;
}

export interface CompanionSystem {
  service: CompanionService;
  memory: MemoryManager;
  combat?: CompanionCombatManager;
}

export default class CompanionModule implements IModule {
  name = 'wyrt_companion';
  version = '1.0.0';
  description = 'AI companion system with conversation, memory, and combat support';
  dependencies: string[] = [];

  private context?: ModuleContext;
  private companionSystems: Map<string, CompanionSystem> = new Map();

  async initialize(context: ModuleContext): Promise<void> {
    this.context = context;
    console.log(`[${this.name}] Module initialized`);
  }

  async activate(context: ModuleContext): Promise<void> {
    context.logger.debug(colors.green('+module ') + 'wyrt_companion');
    context.events.emit('companionModuleActivated');
  }

  async deactivate(context: ModuleContext): Promise<void> {
    // Shutdown all combat managers
    for (const system of this.companionSystems.values()) {
      system.combat?.shutdown();
    }
    this.companionSystems.clear();
    console.log(`[${this.name}] Module deactivated`);
  }

  /**
   * Create a companion system for a specific game.
   *
   * @param gameId - The game identifier
   * @param config - Companion system configuration
   * @returns The companion system instance
   */
  createCompanionSystem(gameId: string, config: CompanionSystemConfig = {}): CompanionSystem {
    if (this.companionSystems.has(gameId)) {
      return this.companionSystems.get(gameId)!;
    }

    // Create memory manager
    const dataDir = config.dataDir || join(process.cwd(), 'data', 'companions', gameId);
    const memoryManager = new MemoryManager({
      dataDir,
      defaultProfile: config.defaultProfile,
    });

    // Create companion service
    const service = new CompanionService({
      memoryManager,
      apiKey: config.apiKey,
      gameName: config.gameName,
      gameDescription: config.gameDescription,
      tierConfig: config.tierConfig,
    });

    // Create combat manager if callbacks provided
    let combat: CompanionCombatManager | undefined;
    if (config.combatCallbacks) {
      combat = new CompanionCombatManager(config.combatConfig || {}, config.combatCallbacks);
      combat.initialize();
    }

    const system: CompanionSystem = {
      service,
      memory: memoryManager,
      combat,
    };

    this.companionSystems.set(gameId, system);
    console.log(`[${this.name}] Created companion system for game: ${gameId}`);

    return system;
  }

  /**
   * Get an existing companion system for a game.
   *
   * @param gameId - The game identifier
   * @returns The companion system instance or undefined
   */
  getCompanionSystem(gameId: string): CompanionSystem | undefined {
    return this.companionSystems.get(gameId);
  }

  /**
   * Destroy a companion system for a game.
   *
   * @param gameId - The game identifier
   */
  destroyCompanionSystem(gameId: string): void {
    const system = this.companionSystems.get(gameId);
    if (system) {
      system.combat?.shutdown();
      this.companionSystems.delete(gameId);
      console.log(`[${this.name}] Destroyed companion system for game: ${gameId}`);
    }
  }
}
