import { IModule } from "../../src/module/IModule";
import { ModuleContext } from "../../src/module/ModuleContext";
import { CombatManager } from "./CombatManager";
import { SkillManager } from "./SkillManager";
import { DamageCalculator } from "./DamageCalculator";

export default class CombatModule implements IModule {
    name = "combat";
    version = "1.0.0";
    description = "Combat and skills system for RPG gameplay";
    dependencies = ["rooms"];
    
    private combatManager!: CombatManager;
    private skillManager!: SkillManager;
    private damageCalculator!: DamageCalculator;
    
    async initialize(context: ModuleContext) {
        context.logger.info("Initializing Combat module...");

        // Initialize managers (commented out until these files exist)
        // this.damageCalculator = new DamageCalculator(context);
        // this.skillManager = new SkillManager(context);
        // this.combatManager = new CombatManager(context, this.skillManager, this.damageCalculator);

        // Register data loaders
        // context.data.registerLoader("skills", {
        //     load: (data, filePath) => this.skillManager.loadSkills(filePath)
        // });

        // context.data.registerLoader("combatFormulas", {
        //     load: (data, filePath) => this.damageCalculator.loadFormulas(filePath)
        // });
    }

    // Public API for other modules
    getCombatManager() {
        return this.combatManager;
    }

    getSkillManager() {
        return this.skillManager;
    }

    getDamageCalculator() {
        return this.damageCalculator;
    }
    
    async activate(context: ModuleContext) {
        context.logger.info("Activating Combat module...");

        // Load commands and requests (commented out until combat system is implemented)
        // await context.commands.loadFromDirectory(__dirname + "/commands");
        // await context.requests.loadFromDirectory(__dirname + "/requests");

        // Setup event listeners
        // this.setupEventListeners(context);

        // Start combat processing
        // this.combatManager.startCombatLoop();
    }

    async deactivate(context: ModuleContext) {
        // this.combatManager.stopCombatLoop();
        // this.combatManager.cleanup();
        // this.skillManager.cleanup();
    }

    private setupEventListeners(context: ModuleContext) {
        // Listen for combat initiation
        // context.events.on("startCombat", (data) => {
        //     this.combatManager.startCombat(data.attacker, data.target);
        // });

        // Listen for skill use
        // context.events.on("useSkill", (data) => {
        //     this.combatManager.useSkill(data.userId, data.skillId, data.targetId);
        // });

        // Listen for entity death
        // context.events.on("entityDeath", (data) => {
        //     this.combatManager.handleEntityDeath(data.entityId);
        // });
    }
}