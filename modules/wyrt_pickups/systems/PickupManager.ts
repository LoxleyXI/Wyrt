/**
 * PICKUP MANAGER - Generic Item Pickup System
 *
 * A reusable system for items that can be picked up from the world.
 *
 * FEATURES:
 * - Register spawn points for items
 * - Proximity-based pickup detection
 * - Auto-respawn with configurable timers
 * - Event-driven (emits events, games handle effects)
 * - Support for persistent items (don't despawn) and limited-use items
 *
 * USAGE EXAMPLE:
 * ```typescript
 * const pickupManager = new PickupManager(context);
 *
 * // Register a health pack spawn
 * pickupManager.registerPickup({
 *     id: 'health_1',
 *     itemType: 'health_pack',
 *     position: { x: 200, y: 300 },
 *     respawnTime: 30000  // 30 seconds
 * });
 *
 * // Check for pickups near player
 * pickupManager.checkPickups({ x: 210, y: 310 }, 'player_123');
 * ```
 *
 * EVENTS EMITTED:
 * - wyrt:itemPickedUp { pickupId, itemType, playerId, position }
 * - wyrt:itemRespawned { pickupId, itemType, position }
 *
 * Games listen to these events and implement their own logic:
 * ```typescript
 * context.events.on('wyrt:itemPickedUp', (data) => {
 *     if (data.itemType === 'health_pack') {
 *         player.health += 50;
 *     }
 * });
 * ```
 */

import { ModuleContext } from '../../../src/module/IModule';
import { Pickup, PickupConfig, Position, PickupEvent, RespawnEvent } from '../types/PickupTypes';

const DEFAULT_PICKUP_RANGE = 32;  // pixels

export class PickupManager {
    private context: ModuleContext;
    private pickups: Map<string, Pickup>;

    constructor(context: ModuleContext) {
        this.context = context;
        this.pickups = new Map();
    }

    /**
     * Register a pickup spawn point
     *
     * @param config - Pickup configuration
     * @returns The created pickup
     */
    registerPickup(config: PickupConfig): Pickup {
        if (this.pickups.has(config.id)) {
            throw new Error(`Pickup ${config.id} already registered`);
        }

        const pickup: Pickup = {
            ...config,
            pickupRange: config.pickupRange || DEFAULT_PICKUP_RANGE,
            available: true,
            pickedUpBy: null,
            respawnAt: null,
            usesRemaining: config.maxUses || null,
            spawnedAt: Date.now()
        };

        this.pickups.set(config.id, pickup);

        console.log(`[PickupManager] Registered pickup: ${config.itemType} at (${config.position.x}, ${config.position.y})`);

        return pickup;
    }

    /**
     * Unregister a pickup (remove from world permanently)
     */
    unregisterPickup(pickupId: string): boolean {
        return this.pickups.delete(pickupId);
    }

    /**
     * Check if any pickups are in range of a position
     *
     * Automatically picks up items in range and emits events.
     *
     * @param position - Position to check (usually player position)
     * @param playerId - Player ID attempting pickup
     * @returns Array of picked up items
     */
    checkPickups(position: Position, playerId: string): PickupEvent[] {
        const pickedUp: PickupEvent[] = [];

        for (const pickup of this.pickups.values()) {
            // Skip if not available
            if (!pickup.available) continue;

            // Check range
            const distance = this.getDistance(position, pickup.position);
            if (distance <= pickup.pickupRange!) {
                const result = this.attemptPickup(pickup.id, playerId);
                if (result) {
                    pickedUp.push(result);
                }
            }
        }

        return pickedUp;
    }

    /**
     * Attempt to pick up a specific item by ID
     *
     * @param pickupId - Pickup to collect
     * @param playerId - Player collecting it
     * @returns Pickup event if successful, null if failed
     */
    attemptPickup(pickupId: string, playerId: string): PickupEvent | null {
        const pickup = this.pickups.get(pickupId);
        if (!pickup) return null;

        // Not available
        if (!pickup.available) return null;

        // Check uses
        if (pickup.usesRemaining !== null && pickup.usesRemaining <= 0) {
            return null;
        }

        // Mark as picked up (unless persistent)
        if (!pickup.persistent) {
            pickup.available = false;
            pickup.pickedUpBy = playerId;

            // Schedule respawn
            if (pickup.respawnTime > 0) {
                pickup.respawnAt = Date.now() + pickup.respawnTime;
            }
        }

        // Decrement uses
        if (pickup.usesRemaining !== null) {
            pickup.usesRemaining--;
        }

        // Create event
        const event: PickupEvent = {
            pickupId: pickup.id,
            itemType: pickup.itemType,
            playerId,
            position: pickup.position,
            timestamp: Date.now()
        };

        // Emit event (games listen and implement effects)
        this.context.events.emit('wyrt:itemPickedUp', event);

        console.log(`[PickupManager] Player ${playerId} picked up ${pickup.itemType}`);

        return event;
    }

    /**
     * Update pickup system
     *
     * Call this periodically (e.g., in game loop) to check respawns.
     *
     * @returns Array of respawned pickups
     */
    update(): RespawnEvent[] {
        const now = Date.now();
        const respawned: RespawnEvent[] = [];

        for (const pickup of this.pickups.values()) {
            // Check if ready to respawn
            if (!pickup.available && pickup.respawnAt && now >= pickup.respawnAt) {
                pickup.available = true;
                pickup.pickedUpBy = null;
                pickup.respawnAt = null;

                const event: RespawnEvent = {
                    pickupId: pickup.id,
                    itemType: pickup.itemType,
                    position: pickup.position,
                    timestamp: now
                };

                respawned.push(event);

                // Emit event
                this.context.events.emit('wyrt:itemRespawned', event);

                console.log(`[PickupManager] ${pickup.itemType} respawned at (${pickup.position.x}, ${pickup.position.y})`);
            }
        }

        return respawned;
    }

    /**
     * Get all available pickups (for sending to client)
     */
    getAvailablePickups(): Pickup[] {
        return Array.from(this.pickups.values()).filter(p => p.available);
    }

    /**
     * Get all pickups (available and unavailable)
     */
    getAllPickups(): Pickup[] {
        return Array.from(this.pickups.values());
    }

    /**
     * Get a specific pickup
     */
    getPickup(pickupId: string): Pickup | null {
        return this.pickups.get(pickupId) || null;
    }

    /**
     * Manually set pickup availability
     * (useful for quest items, scripted events, etc.)
     */
    setAvailable(pickupId: string, available: boolean): void {
        const pickup = this.pickups.get(pickupId);
        if (pickup) {
            pickup.available = available;
            if (!available) {
                pickup.respawnAt = null;  // Cancel respawn
            }
        }
    }

    /**
     * Reset all pickups (make available, cancel respawns)
     */
    resetAll(): void {
        for (const pickup of this.pickups.values()) {
            pickup.available = true;
            pickup.pickedUpBy = null;
            pickup.respawnAt = null;
            if (pickup.maxUses !== undefined) {
                pickup.usesRemaining = pickup.maxUses;
            }
        }

        console.log('[PickupManager] Reset all pickups');
    }

    /**
     * Get pickups by type
     */
    getPickupsByType(itemType: string): Pickup[] {
        return Array.from(this.pickups.values()).filter(p => p.itemType === itemType);
    }

    // ===== PRIVATE HELPER METHODS =====

    /**
     * Calculate distance between two positions
     */
    private getDistance(pos1: Position, pos2: Position): number {
        return Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y);
    }
}
