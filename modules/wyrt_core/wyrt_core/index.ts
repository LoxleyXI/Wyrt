/**
 * @module wyrt_core
 * @description Essential engine functionality providing shared configuration and command registration
 * @category Core
 *
 * @features
 * - Global configuration management
 * - Module command registration
 * - Event bus for module communication
 * - Core lifecycle hooks
 *
 * @usage
 * ```typescript
 * // wyrt_core is auto-loaded as a dependency
 * // Access config and commands through context
 * const config = context.config;
 * const commands = context.commands;
 * ```
 *
 * @exports ModuleContext - Context passed to all modules
 * @exports ModuleCommands - Command registration system
 */
import { IModule, ModuleContext } from "../../../src/module/ModuleSystem";
import colors from "colors/safe";

export default class CoreModule implements IModule {
    name = "wyrt_core";
    version = '1.0.0';
    description = "";

    async initialize(context: ModuleContext): Promise<void> {
        (globalThis as any).moduleCommands = context.commands;
        (globalThis as any).config = context.config;
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.green("+module ") + "wyrt_core");
        context.events.emit('itemsModuleActivated');
    }
}
