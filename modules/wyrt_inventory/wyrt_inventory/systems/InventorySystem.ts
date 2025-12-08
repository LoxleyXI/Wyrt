import { ModuleContext } from "../../../src/module/IModule";

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

                await this.context.prisma.my_game_inventory.update({
                    where: { id: existing.id },
                    data: { quantity: newQuantity }
                });

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
            await this.context.prisma.my_game_inventory.create({
                data: {
                    character_id: characterId,
                    item_id: itemId,
                    quantity: quantity,
                    slot: slot !== null ? slot.toString() : null,
                    equipped: false
                }
            });

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
                await this.context.prisma.my_game_inventory.delete({
                    where: { id: item.id }
                });
            } else {
                // Decrease quantity
                await this.context.prisma.my_game_inventory.update({
                    where: { id: item.id },
                    data: { quantity: item.quantity - quantity }
                });
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
            const rows = await this.context.prisma.my_game_inventory.findMany({
                where: { character_id: characterId },
                orderBy: { slot: 'asc' }
            });

            return rows.map(row => ({
                id: row.id,
                characterId: row.character_id,
                itemId: row.item_id,
                quantity: row.quantity ?? 1,
                slot: row.slot ? parseInt(row.slot) : null,
                equipped: row.equipped ?? false
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
            const row = await this.context.prisma.my_game_inventory.findFirst({
                where: {
                    character_id: characterId,
                    item_id: itemId
                }
            });

            if (!row) {
                return null;
            }

            return {
                id: row.id,
                characterId: row.character_id,
                itemId: row.item_id,
                quantity: row.quantity ?? 1,
                slot: row.slot ? parseInt(row.slot) : null,
                equipped: row.equipped ?? false
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
            const fromItem = await this.context.prisma.my_game_inventory.findFirst({
                where: {
                    character_id: characterId,
                    slot: fromSlot.toString()
                }
            });

            const toItem = await this.context.prisma.my_game_inventory.findFirst({
                where: {
                    character_id: characterId,
                    slot: toSlot.toString()
                }
            });

            if (!fromItem) {
                return false; // No item to move
            }

            if (toItem) {
                // Swap items
                await this.context.prisma.my_game_inventory.update({
                    where: { id: fromItem.id },
                    data: { slot: toSlot.toString() }
                });

                await this.context.prisma.my_game_inventory.update({
                    where: { id: toItem.id },
                    data: { slot: fromSlot.toString() }
                });
            } else {
                // Move to empty slot
                await this.context.prisma.my_game_inventory.update({
                    where: { id: fromItem.id },
                    data: { slot: toSlot.toString() }
                });
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
            const count = await this.context.prisma.my_game_inventory.count({
                where: { character_id: characterId }
            });

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
            const rows = await this.context.prisma.my_game_inventory.findMany({
                where: {
                    character_id: characterId,
                    slot: { not: null }
                },
                select: { slot: true },
                orderBy: { slot: 'asc' }
            });

            const usedSlots = new Set(rows.map(row => row.slot ? parseInt(row.slot) : null).filter(s => s !== null));

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
            const result = await this.context.prisma.my_game_inventory.updateMany({
                where: {
                    character_id: characterId,
                    item_id: itemId
                },
                data: {
                    slot: slot.toString()
                }
            });

            return result.count > 0;
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

            await this.context.prisma.my_game_inventory.update({
                where: { id: existing.id },
                data: { quantity: newQuantity }
            });

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
