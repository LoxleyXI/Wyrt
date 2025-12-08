/**
 * WYRT BUFFS MODULE - TYPE DEFINITIONS
 *
 * Generic buff/debuff system for multiplayer games.
 *
 * FEATURES:
 * - Temporary status effects
 * - Duration-based timers
 * - Stack multiple buffs
 * - Buff categories (buff/debuff/neutral)
 * - Expiration callbacks
 *
 * USE CASES:
 * - Speed boosts, slows
 * - Damage over time, healing over time
 * - Shields, invulnerability
 * - Stuns, freezes, roots
 * - Stat modifiers
 */

/**
 * Buff type identifier (game-defined)
 */
export type BuffType = string;

/**
 * Buff category
 */
export type BuffCategory = 'buff' | 'debuff' | 'neutral';

/**
 * Buff configuration
 */
export interface BuffConfig {
    type: BuffType;
    category?: BuffCategory;
    duration: number;          // Milliseconds (0 = permanent until manually removed)
    stackable?: boolean;       // Can multiple of same type exist (default: false)
    maxStacks?: number;        // Maximum stacks (default: 1)
    modifiers?: Record<string, any>;  // Game-specific stat modifiers
    onApply?: (targetId: string, buff: Buff) => void;
    onExpire?: (targetId: string, buff: Buff) => void;
    onTick?: (targetId: string, buff: Buff) => void;  // Called every second
}

/**
 * Active buff instance
 */
export interface Buff extends BuffConfig {
    id: string;
    targetId: string;
    appliedAt: number;
    expiresAt: number | null;  // null = permanent
    stacks: number;
}

/**
 * Buff application result
 */
export interface BuffResult {
    success: boolean;
    buff?: Buff;
    message: string;
}

/**
 * Buff expiration event
 */
export interface BuffExpiredEvent {
    buffId: string;
    buffType: BuffType;
    targetId: string;
    timestamp: number;
}
