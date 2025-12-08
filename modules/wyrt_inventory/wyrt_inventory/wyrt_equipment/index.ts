/**
 * @module wyrt_equipment
 * @description Equipment system with slot management, stat aggregation, and item requirements
 * @category Inventory
 *
 * @features
 * - Configurable equipment slots (head, chest, weapon, etc.)
 * - Automatic stat aggregation from equipped items
 * - Item requirement validation (level, class, stats)
 * - Equipment set bonuses
 * - Durability tracking
 * - Equip/unequip callbacks
 *
 * @usage
 * ```typescript
 * const equipModule = context.getModule('wyrt_equipment');
 * const equipSystem = equipModule.createEquipmentSystem('my_game');
 *
 * // Equip an item to a slot
 * await equipSystem.equip(playerId, 'weapon', ironSwordItem);
 *
 * // Get aggregated stats
 * const stats = equipSystem.getEquipmentStats(playerId);
 * console.log(stats.attack, stats.defense);
 *
 * // Unequip
 * const item = await equipSystem.unequip(playerId, 'weapon');
 * ```
 *
 * @exports EquipmentSystem - Manages equipment slots and stat calculation
 */
import { IModule, ModuleContext } from "../../src/module/IModule";
import { EquipmentSystem } from "./systems/EquipmentSystem";
import colors from "colors/safe";

export default class EquipmentModule implements IModule {
    name = "wyrt_equipment";
    version = '1.0.0';
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

    /**
     * Create a new equipment system for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The created equipment system
     */
    createEquipmentSystem(gameId: string): EquipmentSystem {
        if (this.equipmentSystems.has(gameId)) {
            throw new Error(`EquipmentSystem for game '${gameId}' already exists`);
        }
        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const system = new EquipmentSystem(this.context, gameId);
        this.equipmentSystems.set(gameId, system);
        console.log(`[${this.name}] Created equipment system for game: ${gameId}`);
        return system;
    }

    /**
     * Get an equipment system for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The equipment system for that game
     */
    getEquipmentSystem(gameId: string): EquipmentSystem {
        const system = this.equipmentSystems.get(gameId);
        if (!system) {
            throw new Error(`EquipmentSystem for game '${gameId}' not found. Did you call createEquipmentSystem()?`);
        }
        return system;
    }
}
