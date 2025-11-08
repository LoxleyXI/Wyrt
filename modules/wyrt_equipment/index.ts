import { IModule, ModuleContext } from "../../src/module/IModule";
import { EquipmentSystem } from "./systems/EquipmentSystem";
import colors from "colors/safe";

export default class EquipmentModule implements IModule {
    name = "wyrt_equipment";
    version = "0.0.1";
    description = "Generic equipment system with stat aggregation";
    dependencies = ["wyrt_inventory"];

    private context?: ModuleContext;
    private equipmentSystems: Map<string, EquipmentSystem> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        console.log(`[${this.name}] Initialized`);
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.green("+module ") + "wyrt_equipment");
        context.events.emit('equipmentModuleActivated');
    }

    async deactivate(context: ModuleContext): Promise<void> {
        this.equipmentSystems.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    createEquipmentSystem(gameId: string): EquipmentSystem {
        if (this.equipmentSystems.has(gameId)) {
            throw new Error(`EquipmentSystem for game '${gameId}' already exists`);
        }
        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const system = new EquipmentSystem(this.context);
        this.equipmentSystems.set(gameId, system);
        console.log(`[${this.name}] Created equipment system for game: ${gameId}`);
        return system;
    }

    getEquipmentSystem(gameId: string): EquipmentSystem {
        const system = this.equipmentSystems.get(gameId);
        if (!system) {
            throw new Error(`EquipmentSystem for game '${gameId}' not found. Did you call createEquipmentSystem()?`);
        }
        return system;
    }
}
