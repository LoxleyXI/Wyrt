/**
 * @module wyrt_combat
 * @description Combat system for RPG gameplay with turn-based and real-time support
 * @category Gameplay
 *
 * @features
 * - Flexible damage calculation system
 * - Support for turn-based and real-time combat
 * - Stat-based combat modifiers (STR, DEX, INT, etc.)
 * - Critical hit system
 * - Damage types (physical, magical, elemental)
 * - Combat log broadcasting
 *
 * @usage
 * ```typescript
 * // In your game module:
 * const combatModule = context.getModule('wyrt_combat');
 * const combatManager = combatModule.createCombatManager({
 *   gameId: 'mygame',
 *   mode: 'real_time',
 *   calculateDamage: (params) => ({ amount: 10, isCritical: false, damageType: 'physical' }),
 *   calculateHealing: (params) => 20,
 * });
 *
 * // Start combat
 * const session = combatManager.startCombat([attacker, defender]);
 * ```
 */

import { IModule } from '../../../src/module/IModule.js';
import { ModuleContext } from '../../../src/module/ModuleContext.js';
import {
  ICombatConfig,
  CombatManager,
  CombatSession,
  CombatParticipant,
  CombatAction,
  ActionResult,
  CombatStatus,
  FleeResult,
  StartCombatOptions,
  CombatLogEntry,
} from './types.js';

// =============================================================================
// Combat Manager Implementation
// =============================================================================

class CombatManagerImpl implements CombatManager {
  public config: ICombatConfig;
  private sessions: Map<string, CombatSession> = new Map();
  private participantSessions: Map<string, string> = new Map();
  private combatLoopInterval: ReturnType<typeof setInterval> | null = null;
  private tickRate: number;

  constructor(config: ICombatConfig) {
    this.config = config;
    this.tickRate = config.tickInterval || 2000;
  }

  // Check if participant is in combat
  isInCombat(participantId: string): boolean {
    return this.participantSessions.has(participantId);
  }

  // Get session for a participant
  getParticipantSession(participantId: string): CombatSession | null {
    const sessionId = this.participantSessions.get(participantId);
    if (!sessionId) return null;
    return this.sessions.get(sessionId) || null;
  }

  // Get session by ID
  getSession(sessionId: string): CombatSession | null {
    return this.sessions.get(sessionId) || null;
  }

  // Start a new combat session
  startCombat(participants: CombatParticipant[], options?: StartCombatOptions): CombatSession {
    const sessionId = `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mode = options?.mode || this.config.mode || 'turn_based';

    // Calculate initial turn order
    const turnOrder = this.config.calculateTurnOrder
      ? this.config.calculateTurnOrder(participants)
      : participants
          .filter(p => p.isAlive)
          .sort((a, b) => b.stats.speed - a.stats.speed)
          .map(p => p.id);

    const session: CombatSession = {
      id: sessionId,
      gameId: this.config.gameId,
      mode,
      participants: [...participants],
      turnOrder,
      currentTurnIndex: 0,
      round: 1,
      status: 'active',
      startedAt: new Date(),
      lastActionAt: new Date(),
      log: [],
      gameData: options?.gameData || {},
    };

    // For real-time mode, initialize attack tracking
    if (mode === 'real_time') {
      session.lastAttacks = new Map();
      session.autoAttackEnabled = new Map();
      for (const p of participants) {
        session.lastAttacks.set(p.id, { player: Date.now(), mob: Date.now() });
        session.autoAttackEnabled.set(p.id, this.config.autoAttackEnabled !== false);
      }
    }

    // Store session
    this.sessions.set(sessionId, session);
    for (const p of participants) {
      this.participantSessions.set(p.id, sessionId);
    }

    // Add combat start log
    session.log.push({
      timestamp: new Date(),
      round: 1,
      type: 'combat_start',
      data: { participants: participants.map(p => ({ id: p.id, name: p.name, team: p.team })) },
      message: 'Combat has started!',
    });

    // Call onCombatStart hook
    if (this.config.onCombatStart) {
      this.config.onCombatStart(session);
    }

    // Start combat loop for real-time mode
    if (mode === 'real_time' && !this.combatLoopInterval) {
      this.startCombatLoop();
    }

    return session;
  }

  // Start the combat loop for real-time mode
  private startCombatLoop(): void {
    if (this.combatLoopInterval) return;

    this.combatLoopInterval = setInterval(() => {
      this.processCombatTick();
    }, Math.min(this.tickRate / 4, 500)); // Tick 4x per attack interval, max 500ms

    console.log('[wyrt_combat] Combat loop started');
  }

  // Stop the combat loop
  private stopCombatLoop(): void {
    if (this.combatLoopInterval) {
      clearInterval(this.combatLoopInterval);
      this.combatLoopInterval = null;
      console.log('[wyrt_combat] Combat loop stopped');
    }
  }

  // Process all active combat sessions
  private processCombatTick(): void {
    for (const [sessionId, session] of this.sessions) {
      if (session.status !== 'active') continue;
      if (session.mode !== 'real_time') continue;

      // Call game-specific tick handler
      if (this.config.onCombatTick) {
        this.config.onCombatTick(session);
      }
    }

    // Stop loop if no active real-time sessions
    const hasActiveRealTime = Array.from(this.sessions.values()).some(
      s => s.status === 'active' && s.mode === 'real_time'
    );
    if (!hasActiveRealTime) {
      this.stopCombatLoop();
    }
  }

  // Perform a combat action (turn-based or manual ability)
  async performAction(sessionId: string, action: CombatAction): Promise<ActionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        action,
        success: false,
        effects: [],
        statusEffects: [],
        error: 'Session not found',
      };
    }

    if (session.status !== 'active') {
      return {
        action,
        success: false,
        effects: [],
        statusEffects: [],
        error: 'Combat has ended',
      };
    }

    const source = session.participants.find(p => p.id === action.sourceId);
    if (!source || !source.isAlive) {
      return {
        action,
        success: false,
        effects: [],
        statusEffects: [],
        error: 'Invalid source',
      };
    }

    const result: ActionResult = {
      action,
      success: true,
      effects: [],
      statusEffects: [],
    };

    switch (action.type) {
      case 'attack':
      case 'ability':
        for (const targetId of action.targetIds) {
          const target = session.participants.find(p => p.id === targetId);
          if (!target || !target.isAlive) continue;

          // Calculate damage
          const damageResult = this.config.calculateDamage({
            attacker: source,
            defender: target,
            isBasicAttack: action.type === 'attack',
            comboMultiplier: 1,
          });

          // Apply damage
          target.hp = Math.max(0, target.hp - damageResult.amount);
          if (target.hp <= 0) {
            target.isAlive = false;
            target.inCombat = false;
          }

          result.effects.push({
            targetId,
            type: 'damage',
            amount: damageResult.amount,
            isCritical: damageResult.isCritical,
            element: damageResult.element,
            overkill: target.hp < 0 ? Math.abs(target.hp) : 0,
          });

          // Log damage
          session.log.push({
            timestamp: new Date(),
            round: session.round,
            type: 'damage',
            sourceId: source.id,
            targetId,
            data: damageResult,
            message: `${source.name} dealt ${damageResult.amount} damage to ${target.name}`,
          });

          // Check for death
          if (!target.isAlive && this.config.onParticipantDeath) {
            this.config.onParticipantDeath(session, target, [source.id]);
          }
        }
        break;

      case 'flee':
        return this.attemptFlee(sessionId, action.sourceId);

      case 'skip':
        // Do nothing
        break;
    }

    session.lastActionAt = new Date();

    // Check for combat end
    this.checkCombatEnd(session);

    return result;
  }

  // Get current turn participant
  getCurrentTurnParticipant(session: CombatSession): CombatParticipant | null {
    if (session.turnOrder.length === 0) return null;
    const currentId = session.turnOrder[session.currentTurnIndex];
    return session.participants.find(p => p.id === currentId) || null;
  }

  // End combat
  endCombat(sessionId: string, status: CombatStatus): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = status;

    // Calculate final result
    const winners = session.participants.filter(p => p.isAlive);
    const losers = session.participants.filter(p => !p.isAlive);

    // Log combat end
    session.log.push({
      timestamp: new Date(),
      round: session.round,
      type: 'combat_end',
      data: { status, winners: winners.map(w => w.id), losers: losers.map(l => l.id) },
      message: `Combat ended: ${status}`,
    });

    // Call onCombatEnd hook
    if (this.config.onCombatEnd) {
      this.config.onCombatEnd(session, {
        sessionId,
        status,
        duration: Date.now() - session.startedAt.getTime(),
        rounds: session.round,
        winners: winners.map(w => w.id),
        losers: losers.map(l => l.id),
        rewards: { experience: 0, currency: 0, items: [] },
        log: session.log,
      });
    }

    // Clean up
    for (const p of session.participants) {
      this.participantSessions.delete(p.id);
    }
    this.sessions.delete(sessionId);
  }

  // Attempt to flee from combat
  attemptFlee(sessionId: string, participantId: string): FleeResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, message: 'Session not found' };
    }

    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) {
      return { success: false, message: 'Participant not found' };
    }

    // Calculate flee chance based on speed differential
    const enemies = session.participants.filter(
      p => p.team !== participant.team && p.isAlive
    );
    const avgEnemySpeed = enemies.reduce((sum, e) => sum + e.stats.speed, 0) / enemies.length;
    const fleeChance = 0.5 + (participant.stats.speed - avgEnemySpeed) * 0.05;
    const success = Math.random() < Math.max(0.1, Math.min(0.9, fleeChance));

    if (success) {
      // Remove participant from combat
      participant.inCombat = false;
      this.participantSessions.delete(participantId);

      // Check if all players have fled
      const playersRemaining = session.participants.filter(
        p => p.type === 'player' && p.inCombat
      );
      if (playersRemaining.length === 0) {
        this.endCombat(sessionId, 'fled');
      }

      return { success: true, message: 'You escaped!' };
    }

    return {
      success: false,
      message: 'Failed to escape!',
      penalty: { hpLost: Math.floor(participant.maxHp * 0.1) },
    };
  }

  // Check if combat should end
  private checkCombatEnd(session: CombatSession): void {
    const aliveTeams = new Set(
      session.participants.filter(p => p.isAlive).map(p => p.team)
    );

    if (aliveTeams.size <= 1) {
      const winners = session.participants.filter(p => p.isAlive);
      const status = winners.some(w => w.type === 'player') ? 'victory' : 'defeat';
      this.endCombat(session.id, status);
    }
  }
}

// =============================================================================
// Module
// =============================================================================

export default class CombatModule implements IModule {
  name = 'wyrt_combat';
  version = '2.0.0';
  description = 'Combat system for RPG gameplay with turn-based and real-time support';
  dependencies = [];

  private context?: ModuleContext;
  private managers: Map<string, CombatManager> = new Map();

  async initialize(context: ModuleContext) {
    this.context = context;
    context.logger.info('[wyrt_combat] Initializing Combat module...');
  }

  async activate(context: ModuleContext) {
    context.logger.info('[wyrt_combat] Activating Combat module...');
  }

  async deactivate(context: ModuleContext) {
    // Stop all combat loops
    for (const manager of this.managers.values()) {
      // The manager handles its own cleanup
    }
    this.managers.clear();
    context.logger.info('[wyrt_combat] Combat module deactivated');
  }

  /**
   * Create a combat manager for a game.
   * Games provide their own damage formulas and hooks via ICombatConfig.
   */
  createCombatManager(config: ICombatConfig): CombatManager {
    const manager = new CombatManagerImpl(config);
    this.managers.set(config.gameId, manager);
    this.context?.logger.info(`[wyrt_combat] Created combat manager for ${config.gameId}`);
    return manager;
  }

  /**
   * Get an existing combat manager for a game.
   */
  getCombatManager(gameId: string): CombatManager | undefined {
    return this.managers.get(gameId);
  }
}

// Export types for consumers
export * from './types.js';
