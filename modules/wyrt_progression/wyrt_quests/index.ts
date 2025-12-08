/**
 * @module wyrt_quests
 * @description Generic quest system with objectives, rewards, and progress tracking
 * @category Progression
 *
 * @features
 * - YAML-based quest definitions
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
 * this.questManager = questModule.createQuestManager(context, {
 *   tableName: 'my_game_quests',
 *   characterIdField: 'character_id'
 * });
 *
 * // Start a quest
 * await this.questManager.startQuest(playerId, 'first_steps');
 *
 * // Update objective progress
 * await this.questManager.updateObjective(playerId, 'kill', 'goblin', 1);
 * ```
 *
 * @exports QuestManager - Main quest management class
 * @exports ObjectiveRegistry - Register custom objective types
 * @exports RewardRegistry - Register custom reward handlers
 * @exports YAMLQuestLoader - Load quests from YAML files
 */

import { IModule } from '../../../src/module/IModule';
import { ModuleContext } from '../../../src/module/ModuleContext';
import { QuestManager, QuestManagerConfig } from './systems/QuestManager';

export default class WyrtQuestsModule implements IModule {
    name = 'wyrt_quests';
    version = '1.0.0';
    description = 'Generic quest system for Wyrt-based games';
    dependencies = [];

    async initialize(context: ModuleContext): Promise<void> {
        context.logger.info('[wyrt_quests] Initializing...');
        context.logger.info('[wyrt_quests] ✓ Initialized (factory module)');
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.info('[wyrt_quests] ✓ Activated');
    }

    async deactivate(): Promise<void> {
        // Cleanup if needed
    }

    /**
     * Factory method for games to create quest manager
     *
     * @param context - Module context
     * @param config - Quest manager configuration (table names, field names, etc.)
     * @returns Configured QuestManager instance
     */
    createQuestManager(context: ModuleContext, config: QuestManagerConfig): QuestManager {
        return new QuestManager(context, config);
    }
}

// Export types for games to use
export * from './types/Quest';
export * from './types/Objective';
export * from './types/Reward';
export { QuestManager } from './systems/QuestManager';
export type { QuestManagerConfig } from './systems/QuestManager';
export { ObjectiveRegistry } from './systems/ObjectiveRegistry';
export { RewardRegistry } from './systems/RewardRegistry';
export { YAMLQuestLoader } from './loaders/YAMLQuestLoader';
export type { QuestFormatAdapter } from './loaders/YAMLQuestLoader';
