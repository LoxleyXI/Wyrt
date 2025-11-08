import { IModule, ModuleContext } from "../../src/module/IModule";
import { InventorySystem } from "./systems/InventorySystem";
import colors from "colors/safe";

export default class InventoryModule implements IModule {
    name = "wyrt_inventory";
    version = "0.0.1";
    description = "Generic inventory management system";
    dependencies = [];

    private context?: ModuleContext;
    private inventorySystems: Map<string, InventorySystem> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        console.log(`[${this.name}] Initialized`);
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.green("+module ") + "wyrt_inventory");
        context.events.emit('inventoryModuleActivated');
    }

    async deactivate(context: ModuleContext): Promise<void> {
        for (const system of this.inventorySystems.values()) {
            system.stopCleanup();
        }
        this.inventorySystems.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    createInventorySystem(gameId: string): InventorySystem {
        if (this.inventorySystems.has(gameId)) {
            throw new Error(`InventorySystem for game '${gameId}' already exists`);
        }
        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const system = new InventorySystem(this.context);
        this.inventorySystems.set(gameId, system);
        system.startCleanup();
        console.log(`[${this.name}] Created inventory system for game: ${gameId}`);
        return system;
    }

    getInventorySystem(gameId: string): InventorySystem {
        const system = this.inventorySystems.get(gameId);
        if (!system) {
            throw new Error(`InventorySystem for game '${gameId}' not found. Did you call createInventorySystem()?`);
        }
        return system;
    }
}
