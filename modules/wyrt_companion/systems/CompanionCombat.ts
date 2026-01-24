/**
 * Companion Combat System
 * Generic companion combat assistance with callbacks for game-specific logic
 */

import {
  CompanionCombatConfig,
  CompanionAbility,
  DEFAULT_COMBAT_CONFIG
} from '../types';

export interface CombatParticipant {
  id: string;
  name: string;
  attack: number;
  defense: number;
  currentHp: number;
  maxHp: number;
}

export interface CompanionCombatState {
  playerId: string;
  lastAttack: number;
  lastAbility: number;
  companionName: string;
  targetId?: string;
}

export interface CompanionAttackResult {
  damage: number;
  ability?: CompanionAbility;
  killed: boolean;
  message: string;
  targetHp: number;
  targetMaxHp: number;
}

export interface CompanionCombatCallbacks {
  // Get player's attack stat
  getPlayerAttack: (playerId: string) => number | null;
  // Get current target info
  getTarget: (playerId: string) => CombatParticipant | null;
  // Apply damage to target
  applyDamage: (targetId: string, damage: number) => { currentHp: number; killed: boolean };
  // Calculate damage based on attack vs defense
  calculateDamage: (attack: number, defense: number) => number;
  // Check if player is in combat
  isInCombat: (playerId: string) => boolean;
  // Get companion name for player
  getCompanionName: (playerId: string) => string;
  // Send combat message to player
  sendMessage: (playerId: string, result: CompanionAttackResult) => void;
}

export class CompanionCombatManager {
  private companionStates: Map<string, CompanionCombatState> = new Map();
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private config: CompanionCombatConfig;
  private callbacks: CompanionCombatCallbacks;

  constructor(config: Partial<CompanionCombatConfig> = {}, callbacks: CompanionCombatCallbacks) {
    this.config = { ...DEFAULT_COMBAT_CONFIG, ...config };
    this.callbacks = callbacks;
  }

  initialize(): void {
    // Start companion combat tick
    this.tickInterval = setInterval(() => this.tick(), 2000);
    console.log('[wyrt_companion] Combat system initialized');
  }

  shutdown(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.companionStates.clear();
  }

  // Called when player enters combat with companion active
  enterCombat(playerId: string, companionName?: string): void {
    const name = companionName || this.callbacks.getCompanionName(playerId);

    this.companionStates.set(playerId, {
      playerId,
      lastAttack: 0,
      lastAbility: 0,
      companionName: name
    });

    console.log(`[wyrt_companion] ${name} joined combat for ${playerId}`);
  }

  // Called when player leaves combat
  leaveCombat(playerId: string): void {
    this.companionStates.delete(playerId);
  }

  // Check if companion is in combat
  isInCombat(playerId: string): boolean {
    return this.companionStates.has(playerId);
  }

  // Get companion state
  getState(playerId: string): CompanionCombatState | null {
    return this.companionStates.get(playerId) || null;
  }

  private tick(): void {
    const now = Date.now();

    for (const [playerId, state] of this.companionStates) {
      // Check if player is still in combat
      if (!this.callbacks.isInCombat(playerId)) {
        this.companionStates.delete(playerId);
        continue;
      }

      // Check if enough time has passed since last attack
      if (now - state.lastAttack < this.config.attackInterval) continue;

      const playerAttack = this.callbacks.getPlayerAttack(playerId);
      const target = this.callbacks.getTarget(playerId);

      if (playerAttack === null || !target) continue;

      // Companion attacks
      const result = this.companionAttack(state, playerAttack, target);
      state.lastAttack = now;

      // Send message to player
      this.callbacks.sendMessage(playerId, result);
    }
  }

  private companionAttack(
    state: CompanionCombatState,
    playerAttack: number,
    target: CombatParticipant
  ): CompanionAttackResult {
    // Companion damage based on player attack
    const companionAttack = Math.floor(playerAttack * this.config.damageMultiplier);
    const damage = this.callbacks.calculateDamage(companionAttack, target.defense);

    // Apply damage
    const { currentHp, killed } = this.callbacks.applyDamage(target.id, damage);

    // Check for ability use
    let ability: CompanionAbility | undefined;
    if (Math.random() < this.config.abilityChance && this.config.abilities.length > 0) {
      ability = this.config.abilities[Math.floor(Math.random() * this.config.abilities.length)];
    }

    // Build message
    let message: string;
    if (killed) {
      message = `${state.companionName} strikes ${target.name} for ${damage} damage, delivering the killing blow!`;
    } else {
      const abilityText = ability ? ` and ${ability.name.toLowerCase()}` : '';
      message = `${state.companionName} strikes ${target.name} for ${damage} damage${abilityText}! (${currentHp}/${target.maxHp} HP)`;
    }

    return {
      damage,
      ability,
      killed,
      message,
      targetHp: currentHp,
      targetMaxHp: target.maxHp
    };
  }

  // Manual attack (for turn-based systems)
  performAttack(playerId: string): CompanionAttackResult | null {
    const state = this.companionStates.get(playerId);
    if (!state) return null;

    const playerAttack = this.callbacks.getPlayerAttack(playerId);
    const target = this.callbacks.getTarget(playerId);

    if (playerAttack === null || !target) return null;

    return this.companionAttack(state, playerAttack, target);
  }

  // Update config at runtime
  updateConfig(config: Partial<CompanionCombatConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Get current config
  getConfig(): CompanionCombatConfig {
    return { ...this.config };
  }
}
