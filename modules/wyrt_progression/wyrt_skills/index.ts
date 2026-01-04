/**
 * @module wyrt_skills
 * @description Generic skill progression system with quadratic XP scaling
 * @category Progression
 *
 * Uses wyrt_data's CharacterSkill table for persistence.
 *
 * @features
 * - Quadratic XP scaling (level² × 100 base XP per level)
 * - Per-game skill managers (isolated skill data per game)
 * - Database-backed persistence via wyrt_data
 * - Real-time XP gain notifications
 * - Level-up event broadcasting
 *
 * @usage
 * ```typescript
 * // In your game module's initialize():
 * const skillsModule = context.getModule('wyrt_skills');
 * this.skillManager = skillsModule.createSkillManager('my_game');
 *
 * // Grant XP to a player (characterId is a string UUID)
 * await this.skillManager.grantXP(characterId, 'mining', 50);
 *
 * // Get player's skill level
 * const level = await this.skillManager.getLevel(characterId, 'mining');
 * ```
 *
 * @exports SkillManager - Main skill management class
 */

import { IModule, ModuleContext } from '../../../src/module/IModule.js';
import { SkillManager } from './systems/SkillManager.js';
import type DataModule from '../../wyrt_data/index.js';

export default class WyrtSkillsModule implements IModule {
    name = 'wyrt_skills';
    version = '2.0.0';
    description = 'Generic skill/progression system using wyrt_data';
    dependencies = ['wyrt_data'];

    private context?: ModuleContext;
    private dataModule?: DataModule;
    private skillManagers: Map<string, SkillManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;

        // Get wyrt_data module for database access
        this.dataModule = context.getModule?.('wyrt_data') as DataModule;
        if (!this.dataModule) {
            throw new Error('[wyrt_skills] wyrt_data module is required');
        }

        context.logger.info(`[${this.name}] Initialized with wyrt_data backend`);
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
            return this.skillManagers.get(gameId)!;
        }

        if (!this.context || !this.dataModule) {
            throw new Error('Module not initialized');
        }

        const manager = new SkillManager(this.context, this.dataModule, gameId);
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
