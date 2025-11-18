/**
 * Objective handler interface for Wyrt quest system
 *
 * Games implement this interface to define custom objective types.
 * Examples: 'kill', 'collect', 'discover', 'craft', etc.
 */

import { QuestObjective, QuestProgress } from './Quest';

/**
 * Objective handler interface
 *
 * Games implement this to define custom objectives
 */
export interface ObjectiveHandler {
    /**
     * Objective type identifier (e.g., 'kill', 'collect', 'discover')
     */
    type: string;

    /**
     * Check if objective is complete
     *
     * @param objective - The objective definition
     * @param progress - Current quest progress
     * @param gameContext - Game module instance for accessing game systems
     * @returns true if objective is met
     */
    isComplete(
        objective: QuestObjective,
        progress: QuestProgress,
        gameContext: any
    ): Promise<boolean>;

    /**
     * Update objective progress based on game events
     *
     * @param objective - The objective definition
     * @param progress - Current quest progress (will be modified)
     * @param eventData - Event-specific data (e.g., { mobType: 'wolf' })
     * @param gameContext - Game module instance
     * @returns true if progress was updated
     */
    updateProgress(
        objective: QuestObjective,
        progress: QuestProgress,
        eventData: any,
        gameContext: any
    ): Promise<boolean>;

    /**
     * Get objective display text for UI
     *
     * @param objective - The objective definition
     * @param progress - Current quest progress
     * @param gameContext - Game module instance
     * @returns Display text (e.g., "Kill Wolves: 3/5")
     */
    getDisplayText(
        objective: QuestObjective,
        progress: QuestProgress,
        gameContext: any
    ): Promise<string>;

    /**
     * Initialize objective (called when step starts)
     *
     * Optional - use for setup tasks like spawning quest items
     */
    initialize?(
        objective: QuestObjective,
        progress: QuestProgress,
        gameContext: any
    ): Promise<void>;

    /**
     * Cleanup objective (called when step ends)
     *
     * Optional - use for cleanup tasks like removing quest items
     */
    cleanup?(
        objective: QuestObjective,
        progress: QuestProgress,
        gameContext: any
    ): Promise<void>;
}
