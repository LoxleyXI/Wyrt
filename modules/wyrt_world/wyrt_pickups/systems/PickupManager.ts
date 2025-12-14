/**
 * Generic item pickup system with proximity detection and auto-respawn.
 * Emits events for games to implement pickup effects.
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

        return pickup;
    }

    /**
     * Register multiple pickups at once (with consolidated logging)
     *
     * @param configs - Array of pickup configurations
     * @returns Array of created pickups
     */
    registerPickups(configs: PickupConfig[]): Pickup[] {
        const pickups = configs.map(config => this.registerPickup(config));

        if (pickups.length > 0) {
            const summary = pickups.map(p => `${p.itemType}@(${p.position.x},${p.position.y})`).join(', ');
            console.log(`[PickupManager] Registered ${pickups.length} pickups: ${summary}`);
        }

        return pickups;
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

    /**
     * Get all available pickups in a specific room
     *
     * @param roomId - Room identifier (e.g., "zone:room")
     * @returns Array of available pickups in that room
     */
    getPickupsInRoom(roomId: string): Pickup[] {
        return Array.from(this.pickups.values()).filter(p => p.roomId === roomId && p.available);
    }

    /**
     * Get all pickups in a specific room (available and unavailable)
     *
     * @param roomId - Room identifier (e.g., "zone:room")
     * @returns Array of all pickups in that room
     */
    getAllPickupsInRoom(roomId: string): Pickup[] {
        return Array.from(this.pickups.values()).filter(p => p.roomId === roomId);
    }

    /**
     * Spawn a new pickup in a room
     *
     * @param itemType - Type of item to spawn
     * @param roomId - Room identifier
     * @param position - Position in the room
     * @param quantity - Optional quantity (stored in itemType or custom data)
     * @returns The created pickup
     */
    spawnPickup(itemType: string, roomId: string, position: Position, quantity?: number): Pickup {
        // Generate unique ID for this pickup
        const pickupId = `pickup_${roomId}_${itemType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return this.registerPickup({
            id: pickupId,
            itemType: itemType,
            roomId: roomId,
            position: position,
            respawnTime: 0, // One-time pickup by default
            maxUses: 1
        });
    }

    // ===== PRIVATE HELPER METHODS =====

    /**
     * Calculate distance between two positions
     */
    private getDistance(pos1: Position, pos2: Position): number {
        return Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y);
    }
}
