/**
 * Item pickup/spawn system with proximity detection and auto-respawn.
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
import { PickupManager } from './systems/PickupManager';

export default class WyrtPickupsModule implements IModule {
    name = 'wyrt_pickups';
    version = '1.0.0';
    description = 'Generic item pickup/spawn system';
    dependencies = [];

    private context?: ModuleContext;
    private pickupManagers: Map<string, PickupManager> = new Map();
    private updateInterval?: NodeJS.Timeout;

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        console.log(`[${this.name}] Initialized`);
    }

    async activate(): Promise<void> {
        // Start update loop (check respawns every second for ALL game-scoped managers)
        this.updateInterval = setInterval(() => {
            for (const manager of this.pickupManagers.values()) {
                manager.update();
            }
        }, 1000);

        console.log(`[${this.name}] Module activated`);
        console.log(`[${this.name}] Pickup system ready`);
    }

    async deactivate(): Promise<void> {
        // Stop update loop
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.pickupManagers.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Create a new pickup manager for a specific game
     *
     * @param gameId - Unique identifier for the game (e.g., 'my_game', 'ctf')
     * @returns The created pickup manager
     */
    createPickupManager(gameId: string): PickupManager {
        if (this.pickupManagers.has(gameId)) {
            throw new Error(`PickupManager for game '${gameId}' already exists`);
        }

        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const manager = new PickupManager(this.context);
        this.pickupManagers.set(gameId, manager);

        console.log(`[${this.name}] Created pickup manager for game: ${gameId}`);
        return manager;
    }

    /**
     * Get a pickup manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The pickup manager for that game
     */
    getPickupManager(gameId: string): PickupManager {
        const manager = this.pickupManagers.get(gameId);
        if (!manager) {
            throw new Error(`PickupManager for game '${gameId}' not found. Did you call createPickupManager()?`);
        }
        return manager;
    }
}
