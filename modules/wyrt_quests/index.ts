//----------------------------------
// Wyrt Quest System Module
//----------------------------------
// Copyright (c) 2025 LoxleyXI
//
// https://github.com/LoxleyXI/Wyrt
//----------------------------------
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see http://www.gnu.org/licenses/
//----------------------------------

import { IModule } from '../../src/module/IModule';
import { ModuleContext } from '../../src/module/ModuleContext';
import { QuestManager, QuestManagerConfig } from './systems/QuestManager';

export default class WyrtQuestsModule implements IModule {
    name = 'wyrt_quests';
    version = '1.0.0';
    description = 'Generic quest system for Wyrt-based games';
    dependencies = [];

    async initialize(context: ModuleContext): Promise<void> {
        context.logger.info('[wyrt_quests] Initializing...');

        // This module provides classes and interfaces
        // Games create their own QuestManager instances with custom config

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
