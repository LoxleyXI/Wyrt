/**
 * @module wyrt_quests
 * @description Generic quest system with objectives, rewards, and progress tracking
 * @category Progression
 *
 * Uses wyrt_data's QuestProgress table for persistence.
 *
 * @features
 * - Database-backed quest definitions via wyrt_data
 * - Multiple objective types (kill, collect, talk, explore)
 * - Automatic progress tracking
 * - Quest chains and prerequisites
 * - Reward distribution (XP, items, currency)
 * - Quest log with active/completed states
 * - Custom objective handlers via registry
 *
 * @usage
 * ```typescript
 * // In your game module's initialize():
 * const questModule = context.getModule('wyrt_quests');
 * this.questManager = questModule.createQuestManager('my_game');
 *
 * // Start a quest (characterId is a string UUID)
 * await this.questManager.acceptQuest(characterId, 'first_steps');
 *
 * // Update objective progress
 * await this.questManager.updateProgress(characterId, 'first_steps', 'kill', { target: 'goblin' });
 * ```
 *
 * @exports QuestManager - Main quest management class
 * @exports ObjectiveRegistry - Register custom objective types
 * @exports RewardRegistry - Register custom reward handlers
 */

import { IModule } from '../../../src/module/IModule.js';
import { ModuleContext } from '../../../src/module/ModuleContext.js';
import { QuestManager } from './systems/QuestManager.js';
import type DataModule from '../../wyrt_data/index.js';

export default class WyrtQuestsModule implements IModule {
    name = 'wyrt_quests';
    version = '2.0.0';
    description = 'Generic quest system using wyrt_data';
    dependencies = ['wyrt_data'];

    private context?: ModuleContext;
    private dataModule?: DataModule;
    private questManagers: Map<string, QuestManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;

        // Get wyrt_data module for database access
        this.dataModule = context.getModule?.('wyrt_data') as DataModule;
        if (!this.dataModule) {
            throw new Error('[wyrt_quests] wyrt_data module is required');
        }

        context.logger.info('[wyrt_quests] ✓ Initialized with wyrt_data backend');
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.info('[wyrt_quests] ✓ Activated');
    }

    async deactivate(): Promise<void> {
        this.questManagers.clear();
    }

    /**
     * Factory method for games to create quest manager
     *
     * @param gameId - Game identifier for loading quest definitions
     * @returns Configured QuestManager instance
     */
    createQuestManager(gameId: string): QuestManager {
        if (this.questManagers.has(gameId)) {
            return this.questManagers.get(gameId)!;
        }

        if (!this.context || !this.dataModule) {
            throw new Error('Module not initialized');
        }

        const manager = new QuestManager(this.context, this.dataModule, gameId);
        this.questManagers.set(gameId, manager);

        console.log(`[wyrt_quests] Created quest manager for game: ${gameId}`);
        return manager;
    }

    getQuestManager(gameId: string): QuestManager {
        const manager = this.questManagers.get(gameId);
        if (!manager) {
            throw new Error(`QuestManager for game '${gameId}' not found. Did you call createQuestManager()?`);
        }
        return manager;
    }
}

// Export types for games to use
export * from './types/Quest.js';
export * from './types/Objective.js';
export * from './types/Reward.js';
export { QuestManager } from './systems/QuestManager.js';
export { ObjectiveRegistry } from './systems/ObjectiveRegistry.js';
export { RewardRegistry } from './systems/RewardRegistry.js';
export { YAMLQuestLoader } from './loaders/YAMLQuestLoader.js';
export type { QuestFormatAdapter } from './loaders/YAMLQuestLoader.js';
