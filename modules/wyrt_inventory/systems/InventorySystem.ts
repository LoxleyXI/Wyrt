import { ModuleContext } from "../../../src/module/IModule";
import mysql from "mysql2/promise";

export interface InventoryItem {
    id: number;
    characterId: number;
    itemId: string;
    quantity: number;
    slot: number | null;
    equipped: boolean;
}

export interface InventoryAPI {
    addItem(characterId: number, itemId: string, quantity: number, slot?: number | null): Promise<boolean>;
    removeItem(characterId: number, itemId: string, quantity: number): Promise<boolean>;
    getInventory(characterId: number): Promise<InventoryItem[]>;
    getItem(characterId: number, itemId: string): Promise<InventoryItem | null>;
    moveItem(characterId: number, fromSlot: number, toSlot: number): Promise<boolean>;
    hasSpace(characterId: number, requiredSlots?: number): Promise<boolean>;
    findEmptySlot(characterId: number): Promise<number | null>;
    setSlot(characterId: number, itemId: string, slot: number): Promise<boolean>;
    stackItem(characterId: number, itemId: string, quantity: number): Promise<boolean>;
}

export class InventorySystem {
    private context: ModuleContext;
    private cleanupInterval?: NodeJS.Timeout;
    private maxSlots: number = 20;
    private maxStackSize: number = 99;

    constructor(context: ModuleContext) {
        this.context = context;

        // Read config
        if (context.config?.inventory?.maxSlots) {
            this.maxSlots = context.config.inventory.maxSlots;
        }
        if (context.config?.inventory?.maxStackSize) {
            this.maxStackSize = context.config.inventory.maxStackSize;
        }
    }

    getAPI(): InventoryAPI {
        return {
            addItem: this.addItem.bind(this),
            removeItem: this.removeItem.bind(this),
            getInventory: this.getInventory.bind(this),
            getItem: this.getItem.bind(this),
            moveItem: this.moveItem.bind(this),
            hasSpace: this.hasSpace.bind(this),
            findEmptySlot: this.findEmptySlot.bind(this),
            setSlot: this.setSlot.bind(this),
            stackItem: this.stackItem.bind(this)
        };
    }

    /**
     * Add an item to character's inventory
     * Attempts to stack with existing items first, then finds empty slot
     */
    async addItem(characterId: number, itemId: string, quantity: number, slot: number | null = null): Promise<boolean> {
        try {
            // First try to stack with existing item
            const existing = await this.getItem(characterId, itemId);
            if (existing && existing.quantity < this.maxStackSize) {
                const newQuantity = Math.min(this.maxStackSize, existing.quantity + quantity);
                const added = newQuantity - existing.quantity;
                const remaining = quantity - added;

                await this.context.db.execute(
                    'UPDATE my_game_inventory SET quantity = ? WHERE id = ?',
                    [newQuantity, existing.id]
                );

                this.context.events.emit('inventory:itemAdded', {
                    characterId,
                    itemId,
                    quantity: added,
                    slot: existing.slot
                });

                // If there's remaining quantity, add to new slot
                if (remaining > 0) {
                    return await this.addItem(characterId, itemId, remaining);
                }

                return true;
            }

            // Find empty slot if not specified
            if (slot === null) {
                slot = await this.findEmptySlot(characterId);
                if (slot === null) {
                    this.context.logger.warn(`No empty inventory slot for character ${characterId}`);
                    return false;
                }
            }

            // Insert new item
            await this.context.db.execute(
                'INSERT INTO my_game_inventory (character_id, item_id, quantity, slot, equipped) VALUES (?, ?, ?, ?, FALSE)',
                [characterId, itemId, quantity, slot]
            );

            this.context.events.emit('inventory:itemAdded', {
                characterId,
                itemId,
                quantity,
                slot
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error adding item to inventory: ${error}`);
            return false;
        }
    }

    /**
     * Remove an item from character's inventory
     */
    async removeItem(characterId: number, itemId: string, quantity: number): Promise<boolean> {
        try {
            const item = await this.getItem(characterId, itemId);
            if (!item) {
                this.context.logger.warn(`Item ${itemId} not found in inventory for character ${characterId}`);
                return false;
            }

            if (item.quantity < quantity) {
                this.context.logger.warn(`Not enough ${itemId} to remove (have: ${item.quantity}, need: ${quantity})`);
                return false;
            }

            if (item.quantity === quantity) {
                // Remove entire stack
                await this.context.db.execute(
                    'DELETE FROM my_game_inventory WHERE id = ?',
                    [item.id]
                );
            } else {
                // Decrease quantity
                await this.context.db.execute(
                    'UPDATE my_game_inventory SET quantity = quantity - ? WHERE id = ?',
                    [quantity, item.id]
                );
            }

            this.context.events.emit('inventory:itemRemoved', {
                characterId,
                itemId,
                quantity,
                slot: item.slot
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error removing item from inventory: ${error}`);
            return false;
        }
    }

    /**
     * Get character's entire inventory
     */
    async getInventory(characterId: number): Promise<InventoryItem[]> {
        try {
            const [rows] = await this.context.db.execute(
                'SELECT * FROM my_game_inventory WHERE character_id = ? ORDER BY slot ASC',
                [characterId]
            );

            return (rows as any[]).map(row => ({
                id: row.id,
                characterId: row.character_id,
                itemId: row.item_id,
                quantity: row.quantity,
                slot: row.slot,
                equipped: row.equipped
            }));
        } catch (error) {
            this.context.logger.error(`Error getting inventory: ${error}`);
            return [];
        }
    }

    /**
     * Get a specific item from inventory
     */
    async getItem(characterId: number, itemId: string): Promise<InventoryItem | null> {
        try {
            const [rows] = await this.context.db.execute(
                'SELECT * FROM my_game_inventory WHERE character_id = ? AND item_id = ? LIMIT 1',
                [characterId, itemId]
            );

            const items = rows as any[];
            if (items.length === 0) {
                return null;
            }

            const row = items[0];
            return {
                id: row.id,
                characterId: row.character_id,
                itemId: row.item_id,
                quantity: row.quantity,
                slot: row.slot,
                equipped: row.equipped
            };
        } catch (error) {
            this.context.logger.error(`Error getting item from inventory: ${error}`);
            return null;
        }
    }

    /**
     * Move an item from one slot to another
     */
    async moveItem(characterId: number, fromSlot: number, toSlot: number): Promise<boolean> {
        try {
            // Check if slots are valid
            if (fromSlot < 0 || fromSlot >= this.maxSlots || toSlot < 0 || toSlot >= this.maxSlots) {
                return false;
            }

            // Get items in both slots
            const [fromRows] = await this.context.db.execute(
                'SELECT * FROM my_game_inventory WHERE character_id = ? AND slot = ?',
                [characterId, fromSlot]
            );

            const [toRows] = await this.context.db.execute(
                'SELECT * FROM my_game_inventory WHERE character_id = ? AND slot = ?',
                [characterId, toSlot]
            );

            const fromItems = fromRows as any[];
            const toItems = toRows as any[];

            if (fromItems.length === 0) {
                return false; // No item to move
            }

            const fromItem = fromItems[0];
            const toItem = toItems.length > 0 ? toItems[0] : null;

            if (toItem) {
                // Swap items
                await this.context.db.execute(
                    'UPDATE my_game_inventory SET slot = ? WHERE id = ?',
                    [toSlot, fromItem.id]
                );

                await this.context.db.execute(
                    'UPDATE my_game_inventory SET slot = ? WHERE id = ?',
                    [fromSlot, toItem.id]
                );
            } else {
                // Move to empty slot
                await this.context.db.execute(
                    'UPDATE my_game_inventory SET slot = ? WHERE id = ?',
                    [toSlot, fromItem.id]
                );
            }

            this.context.events.emit('inventory:itemMoved', {
                characterId,
                fromSlot,
                toSlot
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error moving item: ${error}`);
            return false;
        }
    }

    /**
     * Check if character has space in inventory
     */
    async hasSpace(characterId: number, requiredSlots: number = 1): Promise<boolean> {
        try {
            const [rows] = await this.context.db.execute(
                'SELECT COUNT(*) as count FROM my_game_inventory WHERE character_id = ?',
                [characterId]
            );

            const count = (rows as any[])[0].count;
            return (count + requiredSlots) <= this.maxSlots;
        } catch (error) {
            this.context.logger.error(`Error checking inventory space: ${error}`);
            return false;
        }
    }

    /**
     * Find first empty slot in inventory
     */
    async findEmptySlot(characterId: number): Promise<number | null> {
        try {
            const [rows] = await this.context.db.execute(
                'SELECT slot FROM my_game_inventory WHERE character_id = ? AND slot IS NOT NULL ORDER BY slot ASC',
                [characterId]
            );

            const usedSlots = new Set((rows as any[]).map(row => row.slot));

            for (let i = 0; i < this.maxSlots; i++) {
                if (!usedSlots.has(i)) {
                    return i;
                }
            }

            return null;
        } catch (error) {
            this.context.logger.error(`Error finding empty slot: ${error}`);
            return null;
        }
    }

    /**
     * Set item's slot
     */
    async setSlot(characterId: number, itemId: string, slot: number): Promise<boolean> {
        try {
            const result = await this.context.db.execute(
                'UPDATE my_game_inventory SET slot = ? WHERE character_id = ? AND item_id = ?',
                [slot, characterId, itemId]
            );

            return (result as any)[0].affectedRows > 0;
        } catch (error) {
            this.context.logger.error(`Error setting item slot: ${error}`);
            return false;
        }
    }

    /**
     * Stack item with existing stack
     */
    async stackItem(characterId: number, itemId: string, quantity: number): Promise<boolean> {
        try {
            const existing = await this.getItem(characterId, itemId);
            if (!existing) {
                return false;
            }

            const newQuantity = Math.min(this.maxStackSize, existing.quantity + quantity);

            await this.context.db.execute(
                'UPDATE my_game_inventory SET quantity = ? WHERE id = ?',
                [newQuantity, existing.id]
            );

            return true;
        } catch (error) {
            this.context.logger.error(`Error stacking item: ${error}`);
            return false;
        }
    }

    startCleanup() {
        // Placeholder for future cleanup tasks (e.g., expired temporary items)
        this.context.logger.debug("Inventory cleanup started");
    }

    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
