/**
 * @module wyrt_items
 * @description Base item system providing item definitions, data storage, and item registry
 * @category Inventory
 *
 * @features
 * - Item definition registry
 * - YAML-based item data loading
 * - Item type categorization (weapon, armor, consumable, etc.)
 * - Item property storage (stats, effects, descriptions)
 * - Item lookup by ID or type
 * - Shared item data across modules
 *
 * @usage
 * ```typescript
 * // Items are typically loaded from YAML data files
 * // Access item definitions through context.data
 * const sword = context.data.items['iron_sword'];
 * console.log(sword.name, sword.damage, sword.type);
 *
 * // Item data is shared with wyrt_inventory, wyrt_equipment, wyrt_loot
 * ```
 *
 * @exports ItemData - Item definition interface
 */
import { IModule, ModuleContext } from "../../src/module/ModuleSystem";
import colors from "colors/safe";

export default class CoreModule implements IModule {
    name = "wyrt_items";
    version = '1.0.0';
    description = "Base item definitions and data registry";

    async initialize(context: ModuleContext): Promise<void> {
        if (!context.data.items) {
            context.data.items = {};
        }

        (globalThis as any).moduleCommands = context.commands;
        (globalThis as any).config = context.config;
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.green("+module ") + "wyrt_items");
        context.events.emit('coreModuleActivated');
    }
}
