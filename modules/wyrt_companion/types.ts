/**
 * Companion System Types
 * Generic types for AI companion functionality
 */

// Events that trigger proactive companion commentary
export type MilestoneEvent =
  | { type: 'level_up'; newLevel: number }
  | { type: 'boss_kill'; bossName: string }
  | { type: 'dungeon_enter'; dungeonName: string }
  | { type: 'rare_loot'; itemName: string; rarity: string }
  | { type: 'party_wipe' }
  | { type: 'quest_complete'; questName: string }
  | { type: 'player_death' }
  | { type: 'first_kill'; mobName: string }
  | { type: 'companion_join' }
  | { type: 'custom'; description: string };

// Regular events for context (no API call, just logged)
export interface GameEvent {
  type: 'kill' | 'loot' | 'move' | 'talk' | 'combat_start' | 'combat_end' | 'use_ability' | 'custom';
  description: string;
  timestamp: number;
}

export interface CompanionProfile {
  name: string;
  personality: string;
  background: string;
  speechStyle: string;
  relationshipLevel: number; // 0-100
}

export interface CompanionStats {
  level: number;
  xp: number;
  xpToLevel: number;
}

export interface CompanionMemory {
  playerId: string;
  playerName: string;
  longTermMemory: string[];
  recentSummary: string;
  conversationWindow: Message[];
  recentEvents: GameEvent[];
  stats: CompanionStats;
}

export interface Message {
  role: 'player' | 'companion' | 'system';
  content: string;
  timestamp: number;
}

export interface GameContext {
  roomName: string;
  roomDescription: string;
  nearbyNpcs: string[];
  nearbyMobs: string[];
  nearbyPlayers: string[];
  playerHealth: number;
  playerMaxHealth: number;
  inCombat: boolean;
  currentTarget?: string;
  exits: { direction: string; destination: string }[];
}

export interface CompanionConfig {
  maxConversationWindow: number;
  maxLongTermMemories: number;
  summarizeAfterMessages: number;
  modelQuick: string;
  modelDeep: string;
}

export const DEFAULT_CONFIG: CompanionConfig = {
  maxConversationWindow: 15,
  maxLongTermMemories: 20,
  summarizeAfterMessages: 10,
  modelQuick: 'claude-3-5-haiku-latest',
  modelDeep: 'claude-sonnet-4-20250514'
};

// Tier-based companion settings
export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'unlimited';

export interface TierCompanionConfig {
  model: string;              // Model to use for responses
  canDeepThink: boolean;      // Can use larger model for complex questions
  hasMemory: boolean;         // Long-term memory enabled
  dailyMessageLimit: number;  // 0 = unlimited
  maxCompanions: number;      // Number of companions allowed
}

export const DEFAULT_TIER_CONFIG: Record<SubscriptionTier, TierCompanionConfig> = {
  free: {
    model: 'claude-3-5-haiku-latest',
    canDeepThink: false,
    hasMemory: true,
    dailyMessageLimit: 50,
    maxCompanions: 1,
  },
  basic: {
    model: 'claude-3-5-haiku-latest',
    canDeepThink: true,
    hasMemory: true,
    dailyMessageLimit: 200,
    maxCompanions: 2,
  },
  premium: {
    model: 'claude-3-5-haiku-latest',
    canDeepThink: true,
    hasMemory: true,
    dailyMessageLimit: 0,
    maxCompanions: 3,
  },
  unlimited: {
    model: 'claude-3-5-haiku-latest',
    canDeepThink: true,
    hasMemory: true,
    dailyMessageLimit: 0,
    maxCompanions: 5,
  },
};

// Module configuration interface
export interface CompanionModuleConfig {
  enabled: boolean;
  maxCompanions?: number;
  aiProvider?: 'anthropic' | 'openai' | 'none';
  aiModel?: string;
  combatEnabled?: boolean;
  healingEnabled?: boolean;
  personalitySystem?: boolean;
  maxMessagesPerMinute?: number;
  dataDir?: string;
  tierConfig?: Record<string, TierCompanionConfig>;
}

// Default companion profile
export const DEFAULT_COMPANION_PROFILE: CompanionProfile = {
  name: 'Companion',
  personality: 'Friendly, helpful, and supportive. Always ready to assist in adventures.',
  background: 'A traveling companion who helps adventurers on their quests.',
  speechStyle: 'Conversational and encouraging. Uses adventure-themed language.',
  relationshipLevel: 10
};

// Default companion stats
export const DEFAULT_COMPANION_STATS: CompanionStats = {
  level: 1,
  xp: 0,
  xpToLevel: 100
};

// Combat-related types
export interface CompanionCombatConfig {
  attackInterval: number;      // ms between auto-attacks
  abilityChance: number;       // 0-1 chance to use ability on attack
  damageMultiplier: number;    // Multiplier of player attack (e.g., 0.6 = 60%)
  abilities: CompanionAbility[];
}

export interface CompanionAbility {
  id: string;
  name: string;
  description: string;
  effect: 'buff' | 'debuff' | 'heal' | 'damage' | 'none';
  effectValue?: number;
}

export const DEFAULT_COMBAT_CONFIG: CompanionCombatConfig = {
  attackInterval: 3000,
  abilityChance: 0.3,
  damageMultiplier: 0.6,
  abilities: [
    { id: 'encourage', name: 'Encourages you', description: 'Boosts morale', effect: 'buff' },
    { id: 'tactics', name: 'Provides tactical advice', description: 'Strategic insight', effect: 'none' },
    { id: 'spot', name: 'Spots an opening', description: 'Critical opportunity', effect: 'damage' },
    { id: 'distract', name: 'Distracts the enemy', description: 'Enemy debuff', effect: 'debuff' },
  ]
};

// XP calculation functions
export function getXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return (level - 1) * (level - 1) * 100;
}

export function getXpToNextLevel(level: number): number {
  return getXpForLevel(level + 1) - getXpForLevel(level);
}
