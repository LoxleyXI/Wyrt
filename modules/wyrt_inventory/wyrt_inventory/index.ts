/**
 * @module wyrt_inventory
 * @description Core inventory management system with slots, stacking, and persistence
 * @category Inventory
 *
 * Uses wyrt_data's generic InventoryItem table for persistence.
 * All operations are scoped by characterId.
 *
 * @features
 * - Configurable inventory slots and capacity
 * - Item stacking with max stack sizes
 * - Database persistence via wyrt_data
 * - Add/remove/move item operations
 * - Inventory full detection
 * - Automatic cleanup of empty stacks
 *
 * @usage
 * ```typescript
 * const invModule = context.getModule('wyrt_inventory');
 * const invSystem = invModule.createInventorySystem('my_game');
 *
 * // Add item to inventory (characterId is now a string UUID)
 * const success = await invSystem.addItem(characterId, 'iron_ore', 5);
 *
 * // Remove items
 * await invSystem.removeItem(characterId, 'iron_ore', 3);
 *
 * // Get full inventory
 * const inventory = await invSystem.getInventory(characterId);
 * ```
 *
 * @exports InventorySystem - Manages player inventories
 */
import { IModule, ModuleContext } from "../../../src/module/IModule";
import { InventorySystem } from "./systems/InventorySystem";
import type DataModule from "../../wyrt_data/index.js";
import colors from "colors/safe";

export default class InventoryModule implements IModule {
    name = "wyrt_inventory";
    version = '2.0.0';
    description = "Generic inventory management system using wyrt_data";
    dependencies = ['wyrt_data'];

    private context?: ModuleContext;
    private dataModule?: DataModule;
    private inventorySystems: Map<string, InventorySystem> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;

        // Get wyrt_data module for database access
        this.dataModule = context.getModule?.('wyrt_data') as DataModule;
        if (!this.dataModule) {
            throw new Error('[wyrt_inventory] wyrt_data module is required');
        }

        console.log(`[${this.name}] Initialized with wyrt_data backend`);
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.green("+module ") + "wyrt_inventory");
        context.events.emit('inventoryModuleActivated');
    }

    async deactivate(context: ModuleContext): Promise<void> {
        this.inventorySystems.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    createInventorySystem(gameId: string): InventorySystem {
        if (this.inventorySystems.has(gameId)) {
            return this.inventorySystems.get(gameId)!;
        }
        if (!this.context || !this.dataModule) {
            throw new Error('Module not initialized');
        }

        const system = new InventorySystem(this.context, this.dataModule);
        this.inventorySystems.set(gameId, system);
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
