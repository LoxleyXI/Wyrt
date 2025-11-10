import { IModule } from "../../src/module/IModule";
import { ModuleContext } from "../../src/module/ModuleContext";
import { CraftingManager } from "./systems/CraftingManager";

export default class WyrtCraftingModule implements IModule {
    name = "wyrt_crafting";
    version = "1.0.0";
    description = "Generic crafting system for Wyrt games";
    dependencies = [];

    public craftingManager?: CraftingManager;

    async initialize(context: ModuleContext): Promise<void> {
        context.logger.info(`[${this.name}] Initializing crafting system...`);

        // CraftingManager will be initialized by game modules
        // They need to provide skill manager and player manager
        this.craftingManager = new CraftingManager(context);

        context.logger.info(`[${this.name}] ✓ Crafting system ready`);
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.info(`[${this.name}] Crafting system activated`);
    }

    async deactivate(context: ModuleContext): Promise<void> {
        context.logger.info(`[${this.name}] Crafting system deactivated`);
    }
}
