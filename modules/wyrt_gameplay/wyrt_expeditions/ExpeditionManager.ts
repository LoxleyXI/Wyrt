/**
 * wyrt_expeditions - Expedition Manager
 *
 * Per-game expedition manager that handles timed expeditions.
 * Games provide configuration; this module provides the state machine.
 */

import { ModuleContext } from '../../../src/module/ModuleContext.js';
import {
  IExpeditionConfig,
  ExpeditionType,
  ActiveExpedition,
  ExpeditionParty,
  ExpeditionResult,
  ExpeditionRewards,
  ExpeditionEvent,
  ExpeditionBonus,
  ExpeditionStatus,
} from './types.js';

export class ExpeditionManager {
  private context: ModuleContext;
  private config: IExpeditionConfig;

  // Registered expedition types
  private expeditionTypes: Map<string, ExpeditionType> = new Map();

  // Active expeditions by ID
  private activeExpeditions: Map<string, ActiveExpedition> = new Map();

  // Active expeditions by party member ID (for quick lookup)
  private expeditionsByMember: Map<string, string> = new Map();

  // Completion timers
  private completionTimers: Map<string, NodeJS.Timeout> = new Map();

  // Cooldowns (typeId -> memberId -> expiresAt)
  private cooldowns: Map<string, Map<string, Date>> = new Map();

  constructor(context: ModuleContext, config: IExpeditionConfig) {
    this.context = context;
    this.config = config;
  }

  // ==========================================================================
  // Expedition Type Registration
  // ==========================================================================

  /**
   * Register an expedition type.
   */
  registerExpeditionType(type: ExpeditionType): void {
    if (this.expeditionTypes.has(type.id)) {
      this.context.logger.warn(
        `[wyrt_expeditions:${this.config.gameId}] Overwriting expedition type '${type.id}'`
      );
    }
    this.expeditionTypes.set(type.id, type);
    this.context.logger.debug(
      `[wyrt_expeditions:${this.config.gameId}] Registered expedition type '${type.id}'`
    );
  }

  /**
   * Register multiple expedition types at once.
   */
  registerExpeditionTypes(types: ExpeditionType[]): void {
    for (const type of types) {
      this.registerExpeditionType(type);
    }
  }

  /**
   * Get an expedition type by ID.
   */
  getExpeditionType(typeId: string): ExpeditionType | undefined {
    return this.expeditionTypes.get(typeId);
  }

  /**
   * Get all registered expedition types.
   */
  getAllExpeditionTypes(): ExpeditionType[] {
    return Array.from(this.expeditionTypes.values());
  }

  // ==========================================================================
  // Expedition Lifecycle
  // ==========================================================================

  /**
   * Start a new expedition.
   */
  startExpedition(
    typeId: string,
    party: ExpeditionParty,
    bonuses: ExpeditionBonus[] = []
  ): ActiveExpedition {
    const type = this.expeditionTypes.get(typeId);
    if (!type) {
      throw new Error(`Unknown expedition type: ${typeId}`);
    }

    // Validate party size
    if (party.memberIds.length < type.minPartySize) {
      throw new Error(
        `Party too small. Minimum: ${type.minPartySize}, provided: ${party.memberIds.length}`
      );
    }
    if (party.memberIds.length > type.maxPartySize) {
      throw new Error(
        `Party too large. Maximum: ${type.maxPartySize}, provided: ${party.memberIds.length}`
      );
    }

    // Check if any member is already on an expedition
    for (const memberId of party.memberIds) {
      if (this.expeditionsByMember.has(memberId)) {
        throw new Error(`Member ${memberId} is already on an expedition`);
      }
    }

    // Check cooldowns
    for (const memberId of party.memberIds) {
      const cooldownExpires = this.getCooldown(typeId, memberId);
      if (cooldownExpires && cooldownExpires > new Date()) {
        const remaining = cooldownExpires.getTime() - Date.now();
        throw new Error(
          `Member ${memberId} on cooldown for ${typeId}. ${Math.ceil(remaining / 1000)}s remaining`
        );
      }
    }

    // Game-specific party validation
    if (this.config.validateParty) {
      const error = this.config.validateParty(party, type);
      if (error) {
        throw new Error(error);
      }
    }

    // Calculate duration
    let duration = type.baseDuration;
    if (this.config.calculateDuration) {
      duration = this.config.calculateDuration({ expeditionType: type, party, bonuses });
    }

    // Apply duration bonuses
    for (const bonus of bonuses) {
      if (bonus.type === 'duration') {
        if (bonus.isMultiplier) {
          duration = Math.floor(duration * bonus.value);
        } else {
          duration = Math.floor(duration + bonus.value);
        }
      }
    }

    const now = new Date();
    const expedition: ActiveExpedition = {
      id: this.generateId(),
      gameId: this.config.gameId,
      typeId,
      party,
      startedAt: now,
      completesAt: new Date(now.getTime() + duration),
      duration,
      status: 'active',
      events: [],
      bonuses,
      gameData: {},
    };

    // Store expedition
    this.activeExpeditions.set(expedition.id, expedition);
    for (const memberId of party.memberIds) {
      this.expeditionsByMember.set(memberId, expedition.id);
    }

    // Set completion timer
    const timer = setTimeout(() => {
      this.completeExpedition(expedition.id);
    }, duration);
    this.completionTimers.set(expedition.id, timer);

    // Emit event
    this.context.events.emit(`${this.config.gameId}:expedition_start`, {
      expedition,
      type,
    });

    // Game callback
    if (this.config.onExpeditionStart) {
      this.config.onExpeditionStart(expedition);
    }

    this.context.logger.info(
      `[wyrt_expeditions:${this.config.gameId}] Started expedition ${expedition.id} ` +
        `(${type.name}) with ${party.memberIds.length} members`
    );

    return expedition;
  }

  /**
   * Complete an expedition (called by timer or manually).
   */
  completeExpedition(expeditionId: string): ExpeditionResult {
    const expedition = this.activeExpeditions.get(expeditionId);
    if (!expedition) {
      throw new Error(`Expedition not found: ${expeditionId}`);
    }

    if (expedition.status !== 'active') {
      throw new Error(`Expedition ${expeditionId} is not active`);
    }

    const type = this.expeditionTypes.get(expedition.typeId)!;

    // Clear timer
    const timer = this.completionTimers.get(expeditionId);
    if (timer) {
      clearTimeout(timer);
      this.completionTimers.delete(expeditionId);
    }

    // Calculate success chance
    let successLevel = 1.0;
    if (this.config.calculateSuccessChance) {
      const successChance = this.config.calculateSuccessChance({
        expeditionType: type,
        party: expedition.party,
        bonuses: expedition.bonuses,
      });
      // Roll for success
      if (Math.random() > successChance) {
        successLevel = 0.3 + Math.random() * 0.4; // Partial success
      }
    }

    // Calculate bonus multiplier
    let bonusMultiplier = 1.0;
    for (const bonus of expedition.bonuses) {
      if (bonus.type === 'rewards') {
        if (bonus.isMultiplier) {
          bonusMultiplier *= bonus.value;
        } else {
          bonusMultiplier += bonus.value;
        }
      }
    }

    // Generate rewards
    const rewards = this.config.generateRewards({
      expedition,
      expeditionType: type,
      successLevel,
      bonusMultiplier,
    });

    // Build result
    const result: ExpeditionResult = {
      expeditionId,
      status: successLevel >= 0.9 ? 'success' : successLevel >= 0.5 ? 'partial' : 'failure',
      successLevel,
      duration: Date.now() - expedition.startedAt.getTime(),
      rewards,
      events: expedition.events,
      stats: {
        encounters: expedition.events.filter(e => e.type === 'encounter').length,
        discoveries: expedition.events.filter(e => e.type === 'discovery').length,
        hazards: expedition.events.filter(e => e.type === 'hazard').length,
        bonusMultiplier,
      },
    };

    // Update expedition status
    expedition.status = result.status === 'failure' ? 'failed' : 'completed';

    // Set cooldowns
    if (type.cooldown) {
      for (const memberId of expedition.party.memberIds) {
        this.setCooldown(type.id, memberId, type.cooldown);
      }
    }

    // Cleanup
    this.cleanupExpedition(expeditionId);

    // Emit event
    this.context.events.emit(`${this.config.gameId}:expedition_complete`, {
      expedition,
      result,
    });

    // Game callback
    if (this.config.onExpeditionComplete) {
      this.config.onExpeditionComplete(expedition, result);
    }

    this.context.logger.info(
      `[wyrt_expeditions:${this.config.gameId}] Completed expedition ${expeditionId} ` +
        `(${result.status}, ${Math.round(successLevel * 100)}% success)`
    );

    return result;
  }

  /**
   * Cancel an active expedition.
   */
  cancelExpedition(expeditionId: string): void {
    const expedition = this.activeExpeditions.get(expeditionId);
    if (!expedition) {
      throw new Error(`Expedition not found: ${expeditionId}`);
    }

    if (expedition.status !== 'active') {
      throw new Error(`Expedition ${expeditionId} is not active`);
    }

    // Clear timer
    const timer = this.completionTimers.get(expeditionId);
    if (timer) {
      clearTimeout(timer);
      this.completionTimers.delete(expeditionId);
    }

    expedition.status = 'cancelled';

    // Cleanup
    this.cleanupExpedition(expeditionId);

    // Emit event
    this.context.events.emit(`${this.config.gameId}:expedition_cancel`, {
      expedition,
    });

    // Game callback
    if (this.config.onExpeditionCancel) {
      this.config.onExpeditionCancel(expedition);
    }

    this.context.logger.info(
      `[wyrt_expeditions:${this.config.gameId}] Cancelled expedition ${expeditionId}`
    );
  }

  /**
   * Add an event to an active expedition (for story/log).
   */
  addExpeditionEvent(expeditionId: string, event: ExpeditionEvent): void {
    const expedition = this.activeExpeditions.get(expeditionId);
    if (!expedition) {
      throw new Error(`Expedition not found: ${expeditionId}`);
    }

    expedition.events.push(event);

    this.context.events.emit(`${this.config.gameId}:expedition_event`, {
      expedition,
      event,
    });
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get an active expedition by ID.
   */
  getExpedition(expeditionId: string): ActiveExpedition | undefined {
    return this.activeExpeditions.get(expeditionId);
  }

  /**
   * Get the active expedition for a member.
   */
  getMemberExpedition(memberId: string): ActiveExpedition | undefined {
    const expeditionId = this.expeditionsByMember.get(memberId);
    if (!expeditionId) return undefined;
    return this.activeExpeditions.get(expeditionId);
  }

  /**
   * Check if a member is on an expedition.
   */
  isOnExpedition(memberId: string): boolean {
    return this.expeditionsByMember.has(memberId);
  }

  /**
   * Get all active expeditions.
   */
  getAllActiveExpeditions(): ActiveExpedition[] {
    return Array.from(this.activeExpeditions.values()).filter(
      e => e.status === 'active'
    );
  }

  /**
   * Get time remaining for an expedition in milliseconds.
   */
  getTimeRemaining(expeditionId: string): number {
    const expedition = this.activeExpeditions.get(expeditionId);
    if (!expedition || expedition.status !== 'active') return 0;
    return Math.max(0, expedition.completesAt.getTime() - Date.now());
  }

  /**
   * Get progress percentage (0-100) for an expedition.
   */
  getProgress(expeditionId: string): number {
    const expedition = this.activeExpeditions.get(expeditionId);
    if (!expedition) return 0;
    if (expedition.status !== 'active') return 100;

    const elapsed = Date.now() - expedition.startedAt.getTime();
    return Math.min(100, Math.floor((elapsed / expedition.duration) * 100));
  }

  /**
   * Get available expedition types for a player (uses game config).
   */
  getAvailableExpeditions(
    playerId: string,
    level: number,
    partyId?: string,
    unlockedRegions?: string[]
  ): ExpeditionType[] {
    if (this.config.getAvailableExpeditions) {
      return this.config.getAvailableExpeditions({
        playerId,
        level,
        partyId,
        unlockedRegions,
      });
    }

    // Default: filter by level
    return this.getAllExpeditionTypes().filter(type => level >= type.minLevel);
  }

  // ==========================================================================
  // Cooldown Management
  // ==========================================================================

  /**
   * Set cooldown for a member on an expedition type.
   */
  setCooldown(typeId: string, memberId: string, durationMs: number): void {
    let typeCooldowns = this.cooldowns.get(typeId);
    if (!typeCooldowns) {
      typeCooldowns = new Map();
      this.cooldowns.set(typeId, typeCooldowns);
    }
    typeCooldowns.set(memberId, new Date(Date.now() + durationMs));
  }

  /**
   * Get cooldown expiry for a member on an expedition type.
   */
  getCooldown(typeId: string, memberId: string): Date | undefined {
    return this.cooldowns.get(typeId)?.get(memberId);
  }

  /**
   * Check if a member is on cooldown for an expedition type.
   */
  isOnCooldown(typeId: string, memberId: string): boolean {
    const expires = this.getCooldown(typeId, memberId);
    return expires !== undefined && expires > new Date();
  }

  /**
   * Clear cooldown for a member on an expedition type.
   */
  clearCooldown(typeId: string, memberId: string): void {
    this.cooldowns.get(typeId)?.delete(memberId);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private cleanupExpedition(expeditionId: string): void {
    const expedition = this.activeExpeditions.get(expeditionId);
    if (expedition) {
      for (const memberId of expedition.party.memberIds) {
        this.expeditionsByMember.delete(memberId);
      }
    }
    // Note: We keep the expedition in activeExpeditions for history
    // Games should persist results and clean up as needed
  }

  private generateId(): string {
    return `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clean up all active timers (call on shutdown).
   */
  cleanup(): void {
    for (const timer of this.completionTimers.values()) {
      clearTimeout(timer);
    }
    this.completionTimers.clear();
  }
}
