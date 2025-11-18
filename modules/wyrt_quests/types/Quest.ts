/**
 * Generic quest type definitions for Wyrt quest system
 *
 * This module provides generic, reusable quest types that work for any game.
 * Games can extend these types with custom data using the `custom` field.
 */

/**
 * Generic quest definition
 */
export interface QuestDefinition {
    id: string;
    name: string;
    description: string;
    type: string;                    // Game-defined types: 'main', 'side', 'daily', etc.
    level?: number;                  // Minimum level (optional)

    // Prerequisites (optional)
    prerequisites?: {
        level?: number;
        quests?: string[];           // Must complete these first
        custom?: Record<string, any>; // Game-specific prerequisites
    };

    // Steps (quest progression)
    steps: QuestStep[];

    // Repeatability
    repeatable: boolean;
    repeat_type?: 'none' | 'daily' | 'weekly' | 'manual';
    cooldown_seconds?: number;       // For manual repeats

    // Custom game data
    custom?: Record<string, any>;
}

/**
 * Quest step definition
 */
export interface QuestStep {
    id: string;                      // Step identifier

    // Objectives (what player must do)
    objectives?: QuestObjective[];

    // Rewards (what player gets)
    rewards?: QuestReward[];

    // Events (things that happen)
    events?: QuestEvent[];

    // Custom step data
    custom?: Record<string, any>;
}

/**
 * Quest objective definition
 */
export interface QuestObjective {
    type: string;                    // Registered objective type
    data: Record<string, any>;       // Objective-specific data
}

/**
 * Quest reward definition
 */
export interface QuestReward {
    type: string;                    // Registered reward type
    data: Record<string, any>;       // Reward-specific data
}

/**
 * Quest event definition
 */
export interface QuestEvent {
    type: string;                    // Event type: 'dialog', 'cutscene', 'spawn', etc.
    data: Record<string, any>;       // Event-specific data
}

/**
 * Player's quest progress
 */
export interface QuestProgress {
    characterId: number;             // Or string, game-defined
    questId: string;
    currentStep: number;
    status: 'available' | 'active' | 'completed' | 'failed' | 'abandoned';

    // Progress tracking
    objectiveProgress: Record<string, any>;  // Objective-specific progress

    // Timestamps
    acceptedAt: Date;
    completedAt?: Date;
    lastCompleted?: Date;            // For repeatables
    completionCount: number;

    // Custom progress data
    custom?: Record<string, any>;
}
