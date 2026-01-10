/**
 * wyrt_combat - Type Definitions
 *
 * Generic combat system supporting both turn-based and real-time modes.
 * Games provide their own damage formulas and content via ICombatConfig.
 */

// ============================================================================
// Combat Modes
// ============================================================================

export type CombatMode = 'turn_based' | 'real_time';

// ============================================================================
// Configuration Interface (Games implement this)
// ============================================================================

/**
 * Configuration interface that games must provide to customize combat.
 * This is the primary extension point for game-specific combat mechanics.
 */
export interface ICombatConfig {
  /** Unique game identifier */
  gameId: string;

  /**
   * Combat mode: turn-based or real-time
   * Default: 'turn_based'
   */
  mode?: CombatMode;

  // ==========================================================================
  // Real-Time Mode Configuration (only used when mode='real_time')
  // ==========================================================================

  /**
   * Milliseconds between combat ticks (real-time mode only)
   * Default: 2000 (2 seconds)
   */
  tickInterval?: number;

  /**
   * Enable auto-attacks for players (real-time mode only)
   * Default: true
   */
  autoAttackEnabled?: boolean;

  /**
   * Delay before mob attacks after player (real-time mode only)
   * Default: 1500 (1.5 seconds)
   */
  mobAttackDelay?: number;

  // ==========================================================================
  // Turn-Based Mode Configuration (only used when mode='turn_based')
  // ==========================================================================

  /**
   * How turn order is determined
   * Default: 'speed'
   */
  turnOrderType?: 'speed' | 'initiative' | 'round_robin';

  /**
   * AP (Action Points) system configuration
   */
  apSystem?: APConfig;

  // ==========================================================================
  // Shared Hooks (both modes use these)
  // ==========================================================================

  /**
   * Calculate damage for an attack/ability.
   * Games provide their own formula here.
   */
  calculateDamage(params: DamageCalculationParams): DamageResult;

  /**
   * Calculate healing amount.
   * Games provide their own formula here.
   */
  calculateHealing(params: HealingCalculationParams): number;

  /**
   * Calculate turn order for participants (turn-based mode).
   * Default: sort by speed descending.
   */
  calculateTurnOrder?(participants: CombatParticipant[]): string[];

  /**
   * Calculate if an attack is a critical hit.
   * Returns multiplier (1.0 = no crit, >1.0 = crit).
   */
  calculateCritical?(attacker: CombatParticipant): { isCrit: boolean; multiplier: number };

  /**
   * Calculate if an attack misses/is evaded.
   * Returns true if attack hits.
   */
  calculateHitChance?(attacker: CombatParticipant, defender: CombatParticipant): boolean;

  /**
   * Generate rewards for defeating an enemy.
   * Called when an enemy dies in combat.
   */
  generateRewards?(enemy: CombatParticipant, killers: string[]): CombatRewards;

  /**
   * Get AI action for an NPC/mob participant.
   * Turn-based: called when it's an AI's turn
   * Real-time: called each tick for AI participants
   */
  getAIAction?(participant: CombatParticipant, session: CombatSession): CombatAction;

  /**
   * Called when combat starts. Can modify session state.
   */
  onCombatStart?(session: CombatSession): void;

  /**
   * Called when combat ends. Handle cleanup, rewards distribution.
   */
  onCombatEnd?(session: CombatSession, result: CombatResult): void;

  /**
   * Called when a participant dies.
   */
  onParticipantDeath?(session: CombatSession, participant: CombatParticipant, killers: string[]): void;

  // ==========================================================================
  // Real-Time Mode Hooks
  // ==========================================================================

  /**
   * Called each combat tick (real-time mode only).
   * Process auto-attacks, DoTs, regeneration, etc.
   */
  onCombatTick?(session: CombatSession): void;

  /**
   * Calculate stat modifier from active effects (real-time mode).
   * Returns percentage modifier for the given stat.
   */
  getStatModifier?(participantId: string, stat: string): number;
}

/**
 * Action Points system configuration (turn-based mode)
 */
export interface APConfig {
  /** Maximum AP a participant can have */
  maxAp: number;

  /** AP gained at start of each turn */
  apPerTurn: number;

  /** Passive AP regeneration rate (per second, for idle games) */
  apRegenRate?: number;
}

// ============================================================================
// Damage Calculation
// ============================================================================

export interface DamageCalculationParams {
  attacker: CombatParticipant;
  defender: CombatParticipant;
  ability?: Ability;
  isBasicAttack: boolean;
  comboMultiplier?: number;
  elementMultiplier?: number;
}

export interface DamageResult {
  amount: number;
  isCritical: boolean;
  damageType: DamageType;
  element?: string;
  blocked?: number;
  absorbed?: number;
}

export interface HealingCalculationParams {
  healer: CombatParticipant;
  target: CombatParticipant;
  ability: Ability;
}

export type DamageType = 'physical' | 'magical' | 'true' | 'healing';

// ============================================================================
// Combat Session
// ============================================================================

export interface CombatSession {
  /** Unique session ID */
  id: string;

  /** Game this session belongs to */
  gameId: string;

  /** Combat mode for this session */
  mode: CombatMode;

  /** Optional party ID for party combat */
  partyId?: string;

  /** All participants in combat */
  participants: CombatParticipant[];

  /** Turn order (participant IDs) - turn-based mode */
  turnOrder: string[];

  /** Index into turnOrder for current turn - turn-based mode */
  currentTurnIndex: number;

  /** Current round number (increments when turnOrder cycles) - turn-based mode */
  round: number;

  /** Combat status */
  status: CombatStatus;

  /** When combat started */
  startedAt: Date;

  /** Last action timestamp */
  lastActionAt: Date;

  /** Combat log for this session */
  log: CombatLogEntry[];

  /** Game-specific data (games can store custom state here) */
  gameData: Record<string, any>;

  // ==========================================================================
  // Real-Time Mode Fields
  // ==========================================================================

  /** Last tick timestamp (real-time mode) */
  lastTickAt?: Date;

  /** Per-participant last attack timestamps (real-time mode) */
  lastAttacks?: Map<string, { player: number; mob: number }>;

  /** Auto-attack enabled per participant (real-time mode) */
  autoAttackEnabled?: Map<string, boolean>;
}

export type CombatStatus = 'active' | 'paused' | 'victory' | 'defeat' | 'fled' | 'timeout';

// ============================================================================
// Participants
// ============================================================================

export interface CombatParticipant {
  /** Unique ID (player ID or entity ID) */
  id: string;

  /** Display name */
  name: string;

  /** Is this a player or NPC/mob? */
  type: 'player' | 'enemy' | 'ally';

  /** Which team/side (for determining targets) */
  team: number;

  /** Current HP */
  hp: number;

  /** Maximum HP */
  maxHp: number;

  /** Current resource (mana, AP, energy, etc.) */
  resource: number;

  /** Maximum resource */
  maxResource: number;

  /** Base stats - games define what these mean */
  stats: CombatStats;

  /** Active buffs */
  buffs: ActiveBuff[];

  /** Active debuffs */
  debuffs: ActiveDebuff[];

  /** Ability cooldowns (abilityId -> turnsRemaining) */
  cooldowns: Map<string, number>;

  /** Threat table for AI targeting */
  threat: Map<string, number>;

  /** Is this participant still in combat? */
  inCombat: boolean;

  /** Is this participant alive? */
  isAlive: boolean;

  /** Available abilities */
  abilities: string[];

  /** Game-specific data */
  gameData: Record<string, any>;
}

export interface CombatStats {
  /** Base attack power (physical) */
  attack: number;

  /** Base defense */
  defense: number;

  /** Magic attack power */
  magicAttack: number;

  /** Magic defense */
  magicDefense: number;

  /** Speed (affects turn order) */
  speed: number;

  /** Any additional stats games need */
  [key: string]: number;
}

// ============================================================================
// Actions
// ============================================================================

export interface CombatAction {
  /** Type of action */
  type: 'attack' | 'ability' | 'item' | 'defend' | 'flee' | 'skip';

  /** Who is performing the action */
  sourceId: string;

  /** Target(s) of the action */
  targetIds: string[];

  /** Ability ID if using an ability */
  abilityId?: string;

  /** Item ID if using an item */
  itemId?: string;
}

export interface ActionResult {
  /** The action that was performed */
  action: CombatAction;

  /** Whether the action succeeded */
  success: boolean;

  /** Damage/healing results per target */
  effects: ActionEffect[];

  /** Error message if failed */
  error?: string;

  /** Any buffs/debuffs applied */
  statusEffects: AppliedStatusEffect[];
}

export interface ActionEffect {
  targetId: string;
  type: 'damage' | 'heal' | 'miss' | 'blocked' | 'immune';
  amount: number;
  isCritical: boolean;
  element?: string;
  overkill?: number;
}

export interface AppliedStatusEffect {
  targetId: string;
  effectId: string;
  effectType: 'buff' | 'debuff';
  duration: number;
  stacks?: number;
}

// ============================================================================
// Abilities
// ============================================================================

export interface Ability {
  /** Unique ability ID */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Resource cost */
  cost: number;

  /** Cooldown in turns */
  cooldown: number;

  /** Target type */
  targetType: TargetType;

  /** Damage type */
  damageType: DamageType;

  /** Base power (used in damage calculation) */
  basePower: number;

  /** Element (optional) */
  element?: string;

  /** Status effects to apply */
  effects?: AbilityEffect[];

  /** Tags for combo system, etc. */
  tags?: string[];
}

export type TargetType =
  | 'self'
  | 'single_enemy'
  | 'single_ally'
  | 'all_enemies'
  | 'all_allies'
  | 'all'
  | 'random_enemy';

export interface AbilityEffect {
  type: 'buff' | 'debuff' | 'dot' | 'hot';
  stat?: string;
  value: number;
  duration: number;
  chance?: number;
}

// ============================================================================
// Buffs & Debuffs
// ============================================================================

export interface ActiveBuff {
  id: string;
  name: string;
  sourceId: string;
  turnsRemaining: number;
  stacks: number;
  statModifiers: StatModifier[];
  effects?: string[];
}

export interface ActiveDebuff extends ActiveBuff {
  /** Damage per turn (DoT) */
  damagePerTurn?: number;

  /** Damage type for DoT */
  dotType?: DamageType;
}

export interface StatModifier {
  stat: string;
  type: 'flat' | 'percent';
  value: number;
}

// ============================================================================
// Rewards
// ============================================================================

export interface CombatRewards {
  experience: number;
  currency: number;
  items: RewardItem[];
}

export interface RewardItem {
  itemId: string;
  quantity: number;
}

// ============================================================================
// Results
// ============================================================================

export interface CombatResult {
  sessionId: string;
  status: CombatStatus;
  duration: number;
  rounds: number;
  winners: string[];
  losers: string[];
  rewards: CombatRewards;
  log: CombatLogEntry[];
}

// ============================================================================
// Logging
// ============================================================================

export interface CombatLogEntry {
  timestamp: Date;
  round: number;
  type: LogEntryType;
  sourceId?: string;
  targetId?: string;
  data: Record<string, any>;
  message: string;
}

export type LogEntryType =
  | 'combat_start'
  | 'round_start'
  | 'turn_start'
  | 'action'
  | 'damage'
  | 'heal'
  | 'miss'
  | 'critical'
  | 'buff_applied'
  | 'debuff_applied'
  | 'buff_expired'
  | 'death'
  | 'combat_end';

// ============================================================================
// Combat Manager Interface
// ============================================================================

/**
 * CombatManager handles combat sessions and actions.
 * Games get instances via createCombatManager().
 */
export interface CombatManager {
  /** The config used to create this manager */
  config: ICombatConfig;

  /** Check if a participant is currently in combat */
  isInCombat(participantId: string): boolean;

  /** Get the combat session for a participant */
  getParticipantSession(participantId: string): CombatSession | null;

  /** Get a combat session by ID */
  getSession(sessionId: string): CombatSession | null;

  /** Start a new combat session */
  startCombat(participants: CombatParticipant[], options?: StartCombatOptions): CombatSession;

  /** Perform a combat action */
  performAction(sessionId: string, action: CombatAction): Promise<ActionResult>;

  /** Get the current turn participant */
  getCurrentTurnParticipant(session: CombatSession): CombatParticipant | null;

  /** End a combat session */
  endCombat(sessionId: string, status: CombatStatus): void;

  /** Flee from combat (success based on speed differential) */
  attemptFlee(sessionId: string, participantId: string): FleeResult;
}

export interface StartCombatOptions {
  mode?: CombatMode;
  gameData?: Record<string, any>;
}

export interface FleeResult {
  success: boolean;
  message?: string;
  penalty?: {
    goldLost?: number;
    hpLost?: number;
  };
}
