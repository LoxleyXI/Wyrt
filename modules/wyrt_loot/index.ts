import { IModule, ModuleContext } from "../../src/module/IModule";
import { LootSystem, LootSystemConfig } from "./systems/LootSystem";
import colors from "colors/safe";

export default class LootModule implements IModule {
    name = "wyrt_loot";
    version = "0.0.1";
    description = "Dropped item management with player instancing";
    dependencies = ["wyrt_inventory"];

    private context?: ModuleContext;
    private lootSystems: Map<string, LootSystem> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        console.log(`[${this.name}] Initialized`);
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.green("+module ") + "wyrt_loot");
        context.events.emit('lootModuleActivated');
    }

    async deactivate(context: ModuleContext): Promise<void> {
        for (const system of this.lootSystems.values()) {
            system.stopCleanup();
        }
        this.lootSystems.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    createLootSystem(gameId: string, config: LootSystemConfig): LootSystem {
        if (this.lootSystems.has(gameId)) {
            throw new Error(`LootSystem for game '${gameId}' already exists`);
        }
        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const system = new LootSystem(this.context, config);
        this.lootSystems.set(gameId, system);
        system.startCleanup();
        console.log(`[${this.name}] Created loot system for game: ${gameId}`);
        return system;
    }

    getLootSystem(gameId: string): LootSystem {
        const system = this.lootSystems.get(gameId);
        if (!system) {
            throw new Error(`LootSystem for game '${gameId}' not found. Did you call createLootSystem()?`);
        }
        return system;
    }
}
