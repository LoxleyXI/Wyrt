/**
 * @module wyrt_resources
 * @description Resource node system with HP tracking, depletion, respawn timers, and loot tables
 * @category World
 *
 * @features
 * - Node HP tracking and depletion mechanics
 * - Configurable respawn timers per node type
 * - Loot table rolling for resource yields
 * - Event-based integration (node:depleted, node:respawned)
 * - Node type registration with custom configs
 * - Gathering skill integration hooks
 * - Multiple resource types (ore, wood, herbs, fish)
 *
 * @usage
 * ```typescript
 * const resourcesModule = context.getModule('wyrt_resources');
 * const resourceManager = resourcesModule.createResourceManager('my_game');
 *
 * // Register a node type
 * resourceManager.registerNodeType('copper_ore', {
 *   hp: 3,
 *   respawnTime: 30000,
 *   lootTable: [
 *     { itemId: 'copper_ore', chance: 1.0, quantity: [1, 3] }
 *   ]
 * });
 *
 * // Spawn a node instance
 * resourceManager.spawnNode('copper_ore', { x: 100, y: 200, zoneId: 'mines' });
 *
 * // Handle gathering
 * resourceManager.on('node:depleted', (node, playerId) => {
 *   const loot = resourceManager.rollLoot(node);
 *   // Grant items and XP to player
 * });
 * ```
 *
 * @exports ResourceManager - Manages resource nodes and gathering
 */
import { IModule, ModuleContext } from '../../../src/module/IModule';
import { ResourceManager } from './systems/ResourceManager';
import colors from 'colors';

export default class WyrtResourcesModule implements IModule {
    name = 'wyrt_resources';
    version = '1.0.0';
    description = 'Generic resource node system with HP, depletion, and respawn mechanics';
    dependencies: string[] = [];

    private context!: ModuleContext;
    private resourceManagers: Map<string, ResourceManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.green('+module ') + 'wyrt_resources');
    }

    async deactivate(): Promise<void> {
        // Cleanup all managers
        for (const manager of this.resourceManagers.values()) {
            manager.cleanup();
        }
        this.resourceManagers.clear();
    }

    /**
     * Create a game-scoped resource manager
     * Each game gets its own isolated instance
     */
    createResourceManager(gameId: string): ResourceManager {
        let manager = this.resourceManagers.get(gameId);

        if (!manager) {
            manager = new ResourceManager(gameId);
            this.resourceManagers.set(gameId, manager);
            this.context.logger.debug(`[wyrt_resources] Created manager for game: ${gameId}`);
        }

        return manager;
    }

    /**
     * Get existing resource manager for a game
     */
    getResourceManager(gameId: string): ResourceManager | undefined {
        return this.resourceManagers.get(gameId);
    }
}
