/**
 * @module wyrt_loot
 * @description Dropped item management with player instancing, despawn timers, and loot tables
 * @category Inventory
 *
 * @features
 * - Ground item spawning and despawning
 * - Player-instanced loot (personal drops)
 * - Loot table rolling with weighted chances
 * - Automatic cleanup of expired items
 * - Loot pickup radius detection
 * - Broadcasting dropped items to nearby players
 *
 * @usage
 * ```typescript
 * const lootModule = context.getModule('wyrt_loot');
 * const lootSystem = lootModule.createLootSystem('my_game');
 *
 * // Drop loot on mob death
 * lootSystem.dropLoot({
 *   x: mob.x, y: mob.y,
 *   items: [{ itemId: 'gold_coin', quantity: 10 }],
 *   instancedTo: killerId,  // Only this player can pick up
 *   despawnTime: 60000      // 1 minute
 * });
 *
 * // Roll from a loot table
 * const drops = lootSystem.rollLootTable('goblin_loot');
 * ```
 *
 * @exports LootSystem - Manages ground items and loot tables
 */
import { IModule, ModuleContext } from "../../src/module/IModule";
import { LootSystem } from "./systems/LootSystem";
import colors from "colors/safe";

export default class LootModule implements IModule {
    name = "wyrt_loot";
    version = '1.0.0';
    description = "Dropped item management with player instancing";
    dependencies = ["wyrt_inventory"];

    private context?: ModuleContext;
    private lootSystems: Map<string, LootSystem> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        console.log(`[${this.name}] Initialized`);
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.green("+module ") + "wyrt_loot");
        context.events.emit('lootModuleActivated');
    }

    async deactivate(context: ModuleContext): Promise<void> {
        for (const system of this.lootSystems.values()) {
            system.stopCleanup();
        }
        this.lootSystems.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Create a new loot system for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The created loot system
     */
    createLootSystem(gameId: string): LootSystem {
        if (this.lootSystems.has(gameId)) {
            throw new Error(`LootSystem for game '${gameId}' already exists`);
        }
        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const system = new LootSystem(this.context, gameId);
        this.lootSystems.set(gameId, system);
        system.startCleanup();
        console.log(`[${this.name}] Created loot system for game: ${gameId}`);
        return system;
    }

    /**
     * Get a loot system for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The loot system for that game
     */
    getLootSystem(gameId: string): LootSystem {
        const system = this.lootSystems.get(gameId);
        if (!system) {
            throw new Error(`LootSystem for game '${gameId}' not found. Did you call createLootSystem()?`);
        }
        return system;
    }
}
