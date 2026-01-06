/**
 * wyrt_expeditions - Type Definitions
 *
 * Generic timed expedition system types.
 * Games provide their own reward generation and content via IExpeditionConfig.
 */

// ============================================================================
// Configuration Interface (Games implement this)
// ============================================================================

/**
 * Configuration interface that games must provide to customize expeditions.
 * This is the primary extension point for game-specific expedition mechanics.
 */
export interface IExpeditionConfig {
  /** Unique game identifier */
  gameId: string;

  /**
   * Generate rewards for a completed expedition.
   * Games provide their own loot tables and formulas here.
   */
  generateRewards(params: RewardGenerationParams): ExpeditionRewards;

  /**
   * Calculate expedition duration based on base duration and modifiers.
   * Default: just returns baseDuration.
   */
  calculateDuration?(params: DurationCalculationParams): number;

  /**
   * Calculate success chance for expedition completion.
   * Returns value 0-1. Default: 1.0 (always succeeds).
   */
  calculateSuccessChance?(params: SuccessCalculationParams): number;

  /**
   * Get available expedition types for a player/party.
   * Games can filter by level, unlocks, etc.
   */
  getAvailableExpeditions?(params: AvailabilityParams): ExpeditionType[];

  /**
   * Validate if a party can start an expedition.
   * Returns error message if invalid, undefined if valid.
   */
  validateParty?(party: ExpeditionParty, expeditionType: ExpeditionType): string | undefined;

  /**
   * Called when an expedition starts.
   */
  onExpeditionStart?(expedition: ActiveExpedition): void;

  /**
   * Called when an expedition completes (success or failure).
   */
  onExpeditionComplete?(expedition: ActiveExpedition, result: ExpeditionResult): void;

  /**
   * Called when an expedition is cancelled.
   */
  onExpeditionCancel?(expedition: ActiveExpedition): void;
}

// ============================================================================
// Expedition Types
// ============================================================================

/**
 * Definition of an expedition type that players can undertake.
 */
export interface ExpeditionType {
  /** Unique expedition type ID */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Region/location this expedition is in */
  region?: string;

  /** Minimum level requirement */
  minLevel: number;

  /** Maximum level (for scaling) */
  maxLevel?: number;

  /** Base duration in milliseconds */
  baseDuration: number;

  /** Cooldown after completion in milliseconds */
  cooldown?: number;

  /** Minimum party size */
  minPartySize: number;

  /** Maximum party size */
  maxPartySize: number;

  /** Expedition tier (games define meaning) */
  tier: string;

  /** Resource cost to start (optional) */
  cost?: ExpeditionCost;

  /** Difficulty rating (1-10) */
  difficulty: number;

  /** Potential reward tiers */
  rewardTiers: string[];

  /** Tags for filtering/categorization */
  tags?: string[];

  /** Game-specific data */
  gameData?: Record<string, any>;
}

export interface ExpeditionCost {
  /** Currency amount */
  currency?: number;

  /** Item costs */
  items?: { itemId: string; quantity: number }[];

  /** Resource costs (energy, stamina, etc.) */
  resources?: { type: string; amount: number }[];
}

// ============================================================================
// Active Expeditions
// ============================================================================

/**
 * An expedition currently in progress.
 */
export interface ActiveExpedition {
  /** Unique expedition instance ID */
  id: string;

  /** Game this expedition belongs to */
  gameId: string;

  /** Expedition type ID */
  typeId: string;

  /** Party undertaking the expedition */
  party: ExpeditionParty;

  /** When the expedition started */
  startedAt: Date;

  /** When the expedition will complete */
  completesAt: Date;

  /** Duration in milliseconds */
  duration: number;

  /** Current status */
  status: ExpeditionStatus;

  /** Progress events that occurred (for log/story) */
  events: ExpeditionEvent[];

  /** Bonus modifiers applied */
  bonuses: ExpeditionBonus[];

  /** Game-specific data */
  gameData: Record<string, any>;
}

export type ExpeditionStatus = 'active' | 'completed' | 'failed' | 'cancelled';

export interface ExpeditionParty {
  /** Party/character IDs participating */
  memberIds: string[];

  /** Combined party stats (games calculate this) */
  stats: Record<string, number>;

  /** Party bonuses (synergies, etc.) */
  bonuses: string[];

  /** Average level */
  averageLevel: number;
}

export interface ExpeditionEvent {
  /** When this event occurred (as % of expedition) */
  progressPercent: number;

  /** Event type */
  type: 'encounter' | 'discovery' | 'hazard' | 'rest' | 'bonus';

  /** Event description */
  description: string;

  /** Outcome of the event */
  outcome: 'success' | 'failure' | 'neutral';

  /** Game-specific data */
  data?: Record<string, any>;
}

export interface ExpeditionBonus {
  /** Bonus source (item, buff, synergy) */
  source: string;

  /** Bonus type */
  type: 'duration' | 'rewards' | 'success' | 'xp';

  /** Bonus value (multiplier or flat) */
  value: number;

  /** Is this a multiplier or flat bonus? */
  isMultiplier: boolean;
}

// ============================================================================
// Calculation Params
// ============================================================================

export interface RewardGenerationParams {
  expedition: ActiveExpedition;
  expeditionType: ExpeditionType;
  successLevel: number; // 0-1, how successful
  bonusMultiplier: number;
}

export interface DurationCalculationParams {
  expeditionType: ExpeditionType;
  party: ExpeditionParty;
  bonuses: ExpeditionBonus[];
}

export interface SuccessCalculationParams {
  expeditionType: ExpeditionType;
  party: ExpeditionParty;
  bonuses: ExpeditionBonus[];
}

export interface AvailabilityParams {
  playerId: string;
  partyId?: string;
  level: number;
  unlockedRegions?: string[];
}

// ============================================================================
// Results & Rewards
// ============================================================================

export interface ExpeditionResult {
  /** The completed expedition */
  expeditionId: string;

  /** Final status */
  status: 'success' | 'partial' | 'failure';

  /** Success level (0-1) */
  successLevel: number;

  /** Total duration */
  duration: number;

  /** Rewards earned */
  rewards: ExpeditionRewards;

  /** Events that occurred */
  events: ExpeditionEvent[];

  /** Statistics for this run */
  stats: ExpeditionStats;
}

export interface ExpeditionRewards {
  /** Experience points */
  experience: number;

  /** Currency earned */
  currency: number;

  /** Items found */
  items: RewardItem[];

  /** Resources gathered */
  resources?: { type: string; amount: number }[];

  /** Special rewards (recipes, unlocks, etc.) */
  special?: SpecialReward[];
}

export interface RewardItem {
  itemId: string;
  quantity: number;
  quality?: string;
}

export interface SpecialReward {
  type: string;
  id: string;
  data?: Record<string, any>;
}

export interface ExpeditionStats {
  /** Encounters faced */
  encounters: number;

  /** Discoveries made */
  discoveries: number;

  /** Hazards avoided/overcome */
  hazards: number;

  /** Total bonus multiplier achieved */
  bonusMultiplier: number;
}

// ============================================================================
// Logging
// ============================================================================

export interface ExpeditionLogEntry {
  timestamp: Date;
  expeditionId: string;
  type: LogEntryType;
  message: string;
  data?: Record<string, any>;
}

export type LogEntryType =
  | 'expedition_start'
  | 'expedition_event'
  | 'expedition_complete'
  | 'expedition_cancel'
  | 'rewards_granted';
