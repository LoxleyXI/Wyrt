/**
 * Reward handler interface for Wyrt quest system
 *
 * Games implement this interface to define custom reward types.
 * Examples: 'gold', 'xp', 'item', 'title', 'faction', etc.
 */

import { QuestReward } from './Quest';

/**
 * Reward handler interface
 *
 * Games implement this to define custom rewards
 */
export interface RewardHandler {
    /**
     * Reward type identifier (e.g., 'gold', 'xp', 'item')
     */
    type: string;

    /**
     * Give reward to player
     *
     * @param reward - The reward definition
     * @param characterId - Player's character ID
     * @param gameContext - Game module instance for accessing game systems
     */
    giveReward(
        reward: QuestReward,
        characterId: number | string,
        gameContext: any
    ): Promise<void>;

    /**
     * Get reward display text for UI
     *
     * @param reward - The reward definition
     * @param gameContext - Game module instance
     * @returns Display text (e.g., "500 Gold", "Iron Sword")
     */
    getDisplayText(
        reward: QuestReward,
        gameContext: any
    ): Promise<string>;

    /**
     * Validate player can receive reward
     *
     * Optional - use for checks like inventory space, level requirements, etc.
     *
     * @param reward - The reward definition
     * @param characterId - Player's character ID
     * @param gameContext - Game module instance
     * @returns true if player can receive reward
     */
    canReceive?(
        reward: QuestReward,
        characterId: number | string,
        gameContext: any
    ): Promise<boolean>;
}
