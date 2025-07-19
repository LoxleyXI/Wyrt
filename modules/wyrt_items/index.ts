import { IModule, ModuleContext } from "../../src/module/ModuleSystem";
import colors from "colors/safe";

export default class CoreModule implements IModule {
    name = "wyrt_items";
    version = "0.0.1";
    description = "";

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
