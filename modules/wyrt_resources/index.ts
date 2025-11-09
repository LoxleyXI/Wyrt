import { IModule, ModuleContext } from '../../src/module/IModule';
import { ResourceManager } from './systems/ResourceManager';
import colors from 'colors';

/**
 * wyrt_resources - Generic resource node system
 *
 * Provides:
 * - Node HP tracking and depletion
 * - Respawn timers
 * - Loot table rolling
 * - Event-based integration
 *
 * Games use this by:
 * 1. Creating game-scoped manager: createResourceManager(gameId)
 * 2. Registering node types with configs
 * 3. Spawning node instances
 * 4. Listening to events: node:depleted, node:respawned
 * 5. Handling broadcasting, pickups, XP, and other game features
 */
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
