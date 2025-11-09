/**
 * Generic skill progression system with quadratic XP scaling
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
import { SkillManager } from './systems/SkillManager';

export default class WyrtSkillsModule implements IModule {
    name = 'wyrt_skills';
    version = '1.0.0';
    description = 'Generic skill/progression system with quadratic XP scaling';
    dependencies = [];

    private context?: ModuleContext;
    private skillManagers: Map<string, SkillManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        context.logger.info(`[${this.name}] Initialized`);
    }

    async activate(): Promise<void> {
        console.log(`[${this.name}] Module activated`);
        console.log(`[${this.name}] Skill progression system ready (quadratic scaling)`);
    }

    async deactivate(): Promise<void> {
        this.skillManagers.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Create a new skill manager for a specific game
     *
     * @param gameId - Unique identifier for the game (e.g., 'my_game', 'my_rpg')
     * @returns The created skill manager
     */
    createSkillManager(gameId: string): SkillManager {
        if (this.skillManagers.has(gameId)) {
            throw new Error(`SkillManager for game '${gameId}' already exists`);
        }

        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const manager = new SkillManager(this.context, gameId);
        this.skillManagers.set(gameId, manager);

        console.log(`[${this.name}] Created skill manager for game: ${gameId}`);
        return manager;
    }

    /**
     * Get a skill manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The skill manager for that game
     */
    getSkillManager(gameId: string): SkillManager {
        const manager = this.skillManagers.get(gameId);
        if (!manager) {
            throw new Error(`SkillManager for game '${gameId}' not found. Did you call createSkillManager()?`);
        }
        return manager;
    }
}
