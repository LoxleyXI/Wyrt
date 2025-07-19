import { IModule, ModuleContext } from "../../src/module/ModuleSystem";
import colors from "colors/safe";

export default class CoreModule implements IModule {
    name = "wyrt_core";
    version = "0.0.1";
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
