/**
 * @module wyrt_equipment
 * @description Equipment system with slot management, stat aggregation, and item requirements
 * @category Inventory
 *
 * Uses wyrt_data's generic Equipment table for persistence.
 * Each equipped item is a row with characterId, slot, and itemSlug.
 *
 * @features
 * - Configurable equipment slots (head, chest, weapon, etc.)
 * - Automatic stat aggregation from equipped items
 * - Item requirement validation (level, class, stats)
 * - Equip/unequip callbacks
 *
 * @usage
 * ```typescript
 * const equipModule = context.getModule('wyrt_equipment');
 * const equipSystem = equipModule.createEquipmentSystem('my_game');
 *
 * // Equip an item to a slot (characterId is a string UUID)
 * await equipSystem.equip(characterId, 'mainhand', 'iron_sword');
 *
 * // Get aggregated stats
 * const stats = await equipSystem.getStats(characterId);
 * console.log(stats.attack, stats.defense);
 *
 * // Unequip
 * await equipSystem.unequip(characterId, 'mainhand');
 * ```
 *
 * @exports EquipmentSystem - Manages equipment slots and stat calculation
 */
import { IModule, ModuleContext } from "../../../../src/module/IModule.js";
import { EquipmentSystem } from "./systems/EquipmentSystem.js";
import type DataModule from "../../../wyrt_data/index.js";
import colors from "colors/safe";

export default class EquipmentModule implements IModule {
    name = "wyrt_equipment";
    version = '2.0.0';
    description = "Generic equipment system using wyrt_data";
    dependencies = ["wyrt_data"];

    private context?: ModuleContext;
    private dataModule?: DataModule;
    private equipmentSystems: Map<string, EquipmentSystem> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;

        // Get wyrt_data module for database access
        this.dataModule = context.getModule?.('wyrt_data') as DataModule;
        if (!this.dataModule) {
            throw new Error('[wyrt_equipment] wyrt_data module is required');
        }

        console.log(`[${this.name}] Initialized with wyrt_data backend`);
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
            return this.equipmentSystems.get(gameId)!;
        }
        if (!this.context || !this.dataModule) {
            throw new Error('Module not initialized');
        }

        const system = new EquipmentSystem(this.context, this.dataModule, gameId);
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
