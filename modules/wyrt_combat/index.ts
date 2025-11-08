import { IModule } from "../../src/module/IModule";
import { ModuleContext } from "../../src/module/ModuleContext";

export default class CombatModule implements IModule {
    name = "combat";
    version = "1.0.0";
    description = "Combat and skills system for RPG gameplay";
    dependencies = ["rooms"];

    private context?: ModuleContext;

    async initialize(context: ModuleContext) {
        this.context = context;
        context.logger.info("Initializing Combat module...");
    }
    
    async activate(context: ModuleContext) {
        context.logger.info("Activating Combat module...");
    }

    async deactivate(context: ModuleContext) {
        context.logger.info("Combat module deactivated");
    }
}