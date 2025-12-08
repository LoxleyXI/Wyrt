/**
 * Reward Registry for Wyrt Quest System
 *
 * Manages pluggable reward handlers.
 * Games register handlers for custom reward types (gold, xp, item, title, etc.)
 */

import { RewardHandler } from '../types/Reward';
import { QuestReward } from '../types/Quest';

export class RewardRegistry {
    private handlers: Map<string, RewardHandler> = new Map();

    /**
     * Register a reward type handler
     *
     * @param handler - Reward handler implementation
     * @throws Error if type already registered
     */
    register(handler: RewardHandler): void {
        if (this.handlers.has(handler.type)) {
            throw new Error(`Reward type already registered: ${handler.type}`);
        }
        this.handlers.set(handler.type, handler);
    }

    /**
     * Get handler for reward type
     *
     * @param type - Reward type (e.g., 'gold', 'xp', 'item')
     * @returns Handler or undefined if not found
     */
    getHandler(type: string): RewardHandler | undefined {
        return this.handlers.get(type);
    }

    /**
     * Give all rewards in a list to player
     *
     * Validates player can receive each reward before giving.
     * If any reward fails validation, throws error without giving rewards.
     *
     * @param rewards - List of quest rewards
     * @param characterId - Player's character ID
     * @param gameContext - Game module instance
     * @throws Error if handler not found or player cannot receive reward
     */
    async giveRewards(
        rewards: QuestReward[],
        characterId: number | string,
        gameContext: any
    ): Promise<void> {
        // First, validate player can receive all rewards
        for (const reward of rewards) {
            const handler = this.getHandler(reward.type);
            if (!handler) {
                throw new Error(`No handler for reward type: ${reward.type}`);
            }

            // Check if player can receive (optional validation)
            if (handler.canReceive) {
                const canReceive = await handler.canReceive(reward, characterId, gameContext);
                if (!canReceive) {
                    throw new Error(`Cannot receive reward: ${reward.type}`);
                }
            }
        }

        // Then, give all rewards
        for (const reward of rewards) {
            const handler = this.getHandler(reward.type)!; // Already validated above
            await handler.giveReward(reward, characterId, gameContext);
        }
    }

    /**
     * Get display text for all rewards
     *
     * @param rewards - List of quest rewards
     * @param gameContext - Game module instance
     * @returns Array of display strings (e.g., ["500 Gold", "Iron Sword"])
     */
    async getRewardDisplayTexts(
        rewards: QuestReward[],
        gameContext: any
    ): Promise<string[]> {
        const texts: string[] = [];

        for (const reward of rewards) {
            const handler = this.getHandler(reward.type);
            if (handler) {
                const text = await handler.getDisplayText(reward, gameContext);
                texts.push(text);
            }
        }

        return texts;
    }
}
