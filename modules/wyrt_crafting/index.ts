import { IModule } from "../../src/module/IModule";
import { ModuleContext } from "../../src/module/ModuleContext";
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
