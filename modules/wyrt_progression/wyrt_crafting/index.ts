/**
 * @module wyrt_crafting
 * @description Generic crafting system with recipe management and skill requirements
 * @category Progression
 *
 * @features
 * - YAML-based recipe definitions
 * - Skill level requirements for recipes
 * - Material consumption validation
 * - Crafting time/cooldowns
 * - Success chance modifiers
 * - Recipe discovery system
 *
 * @usage
 * ```typescript
 * // In your game module's initialize():
 * const craftModule = context.getModule('wyrt_crafting');
 * this.crafting = craftModule.createCraftingManager('my_game');
 *
 * // Load recipes from YAML
 * await this.crafting.loadRecipes('./data/recipes.yaml');
 *
 * // Craft an item
 * const result = await this.crafting.craft(playerId, 'iron_sword');
 * if (result.success) {
 *   // Add crafted item to inventory
 * }
 * ```
 *
 * @exports CraftingManager - Main crafting management class
 */

import { IModule } from "../../../src/module/IModule";
import { ModuleContext } from "../../../src/module/ModuleContext";
import { CraftingManager } from "./systems/CraftingManager";

export default class WyrtCraftingModule implements IModule {
    name = "wyrt_crafting";
    version = "1.0.0";
    description = "Generic crafting system for Wyrt games";
    dependencies = [];

    private context?: ModuleContext;
    private craftingManagers: Map<string, CraftingManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        context.logger.info(`[${this.name}] Initializing crafting system...`);
        context.logger.info(`[${this.name}] ✓ Crafting system ready`);
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.info(`[${this.name}] Crafting system activated`);
    }

    async deactivate(context: ModuleContext): Promise<void> {
        this.craftingManagers.clear();
        context.logger.info(`[${this.name}] Crafting system deactivated`);
    }

    /**
     * Create a new crafting manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The created crafting manager
     */
    createCraftingManager(gameId: string): CraftingManager {
        if (this.craftingManagers.has(gameId)) {
            throw new Error(`CraftingManager for game '${gameId}' already exists`);
        }

        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const manager = new CraftingManager(this.context, gameId);
        this.craftingManagers.set(gameId, manager);

        console.log(`[${this.name}] Created crafting manager for game: ${gameId}`);
        return manager;
    }

    /**
     * Get a crafting manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The crafting manager for that game
     */
    getCraftingManager(gameId: string): CraftingManager {
        const manager = this.craftingManagers.get(gameId);
        if (!manager) {
            throw new Error(`CraftingManager for game '${gameId}' not found. Did you call createCraftingManager()?`);
        }
        return manager;
    }
}
