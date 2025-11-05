/**
 * WYRT PICKUPS MODULE
 *
 * Generic item pickup/spawn system for multiplayer games.
 *
 * PROVIDES:
 * - PickupManager class
 * - Spawn point registration
 * - Proximity-based pickup detection
 * - Auto-respawn system
 * - Event-driven architecture (games implement effects)
 *
 * USAGE IN OTHER MODULES:
 * ```typescript
 * const pickupManager = context.getModule('wyrt_pickups').getPickupManager();
 *
 * // Register spawn points
 * pickupManager.registerPickup({
 *     id: 'health_1',
 *     itemType: 'health_pack',
 *     position: { x: 200, y: 300 },
 *     respawnTime: 30000
 * });
 *
 * // Check pickups near player (in game loop or move handler)
 * pickupManager.checkPickups(player.position, player.id);
 *
 * // Listen for pickup events
 * context.events.on('wyrt:itemPickedUp', (data) => {
 *     // Implement game-specific logic
 *     if (data.itemType === 'health_pack') {
 *         player.health += 50;
 *     }
 * });
 * ```
 *
 * EVENTS:
 * - wyrt:itemPickedUp { pickupId, itemType, playerId, position }
 * - wyrt:itemRespawned { pickupId, itemType, position }
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
import { PickupManager } from './systems/PickupManager';

export default class WyrtPickupsModule implements IModule {
    name = 'wyrt_pickups';
    version = '1.0.0';
    description = 'Generic item pickup/spawn system';
    dependencies = [];

    private context?: ModuleContext;
    private pickupManager?: PickupManager;
    private updateInterval?: NodeJS.Timeout;

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;

        // Create pickup manager
        this.pickupManager = new PickupManager(context);

        // Store globally for easy access
        (globalThis as any).wyrtPickupManager = this.pickupManager;

        console.log(`[${this.name}] Initialized`);
    }

    async activate(): Promise<void> {
        // Start update loop (check respawns every second)
        this.updateInterval = setInterval(() => {
            this.pickupManager?.update();
        }, 1000);

        console.log(`[${this.name}] Module activated`);
        console.log(`[${this.name}] Pickup system ready`);
    }

    async deactivate(): Promise<void> {
        // Stop update loop
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        delete (globalThis as any).wyrtPickupManager;
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Get the pickup manager instance
     */
    getPickupManager(): PickupManager {
        if (!this.pickupManager) {
            throw new Error('PickupManager not initialized');
        }
        return this.pickupManager;
    }
}
