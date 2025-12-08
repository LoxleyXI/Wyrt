import { ModuleContext } from "../../../src/module/IModule";

export interface DroppedItem {
    id: number;
    characterId: number;
    zone: string;
    itemId: string;
    quantity: number;
    x: number;
    y: number;
    createdAt: Date;
    expiresAt: Date;
}

export interface LootTable {
    itemId: string;
    quantity: number;
    chance?: number; // Optional for pre-rolled loot
}

export interface LootAPI {
    dropLoot(characterId: number, zone: string, x: number, y: number, loot: LootTable[]): Promise<DroppedItem[]>;
    pickupLoot(characterId: number, lootId: number): Promise<boolean>;
    getLootInZone(characterId: number, zone: string): Promise<DroppedItem[]>;
    cleanupExpiredLoot(): Promise<number>;
    rollLootTable(lootTable: any[]): Promise<LootTable[]>;
}

export class LootSystem {
    private context: ModuleContext;
    private gameId: string;
    private lootTableName: string;
    private cleanupInterval?: NodeJS.Timeout;
    private expiryTime: number = 5 * 60 * 1000; // 5 minutes
    private cleanupIntervalTime: number = 60 * 1000; // 1 minute
    private useMemory: boolean = false;
    private memoryLoot: Map<number, DroppedItem> = new Map();
    private nextLootId: number = 1;

    constructor(context: ModuleContext, gameId: string) {
        this.context = context;
        this.gameId = gameId;
        this.lootTableName = `${gameId}_loot`;

        // Force in-memory mode for now (no database required)
        this.useMemory = true;
        this.context.logger.debug("Loot system using in-memory storage");

        // Read config
        if (context.config?.loot?.expiryTime) {
            this.expiryTime = context.config.loot.expiryTime;
        }
        if (context.config?.loot?.cleanupInterval) {
            this.cleanupIntervalTime = context.config.loot.cleanupInterval;
        }
    }

    getAPI(): LootAPI {
        return {
            dropLoot: this.dropLoot.bind(this),
            pickupLoot: this.pickupLoot.bind(this),
            getLootInZone: this.getLootInZone.bind(this),
            cleanupExpiredLoot: this.cleanupExpiredLoot.bind(this),
            rollLootTable: this.rollLootTable.bind(this)
        };
    }

    /**
     * Drop loot at a position for a specific player (player-instanced)
     */
    async dropLoot(characterId: number, zone: string, x: number, y: number, loot: LootTable[]): Promise<DroppedItem[]> {
        try {
            const droppedItems: DroppedItem[] = [];

            for (const item of loot) {
                if (this.useMemory) {
                    // In-memory storage
                    const lootId = this.nextLootId++;
                    const droppedItem: DroppedItem = {
                        id: lootId,
                        characterId,
                        zone,
                        itemId: item.itemId,
                        quantity: item.quantity,
                        x,
                        y,
                        createdAt: new Date(),
                        expiresAt: new Date(Date.now() + this.expiryTime)
                    };
                    this.memoryLoot.set(lootId, droppedItem);
                    droppedItems.push(droppedItem);
                } else {
                    // Database storage
                    const result = await this.context.db.execute(
                        `INSERT INTO ${this.lootTableName}
                        (character_id, zone, item_id, quantity, x, y, created_at, expires_at)
                        VALUES (?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND))`,
                        [characterId, zone, item.itemId, item.quantity, x, y, this.expiryTime / 1000]
                    );

                    const insertId = (result as any)[0].insertId;

                    droppedItems.push({
                        id: insertId,
                        characterId,
                        zone,
                        itemId: item.itemId,
                        quantity: item.quantity,
                        x,
                        y,
                        createdAt: new Date(),
                        expiresAt: new Date(Date.now() + this.expiryTime)
                    });
                }
            }

            // Emit event
            this.context.events.emit('loot:dropped', {
                characterId,
                zone,
                items: droppedItems,
                position: { x, y }
            });

            return droppedItems;
        } catch (error) {
            this.context.logger.error(`Error dropping loot: ${error}`);
            return [];
        }
    }

    /**
     * Pickup dropped loot (must belong to the character)
     */
    async pickupLoot(characterId: number, lootId: number): Promise<boolean> {
        try {
            let loot: any;

            if (this.useMemory) {
                // In-memory storage
                const droppedItem = this.memoryLoot.get(lootId);
                if (!droppedItem || droppedItem.characterId !== characterId) {
                    this.context.logger.warn(`Loot ${lootId} not found or doesn't belong to character ${characterId}`);
                    return false;
                }

                // Check if expired
                if (droppedItem.expiresAt < new Date()) {
                    this.context.logger.warn(`Loot ${lootId} has expired`);
                    this.memoryLoot.delete(lootId);
                    return false;
                }

                loot = {
                    item_id: droppedItem.itemId,
                    quantity: droppedItem.quantity
                };
            } else {
                // Database storage
                const [rows] = await this.context.db.execute(
                    `SELECT * FROM ${this.lootTableName} WHERE id = ? AND character_id = ?`,
                    [lootId, characterId]
                );

                const lootItems = rows as any[];
                if (lootItems.length === 0) {
                    this.context.logger.warn(`Loot ${lootId} not found or doesn't belong to character ${characterId}`);
                    return false;
                }

                loot = lootItems[0];

                // Check if expired
                if (new Date(loot.expires_at) < new Date()) {
                    this.context.logger.warn(`Loot ${lootId} has expired`);
                    await this.context.db.execute(`DELETE FROM ${this.lootTableName} WHERE id = ?`, [lootId]);
                    return false;
                }
            }

            // Add to inventory
            const inventory = (this.context as any).inventory;
            if (!inventory) {
                this.context.logger.error("Inventory system not available");
                return false;
            }

            const success = await inventory.addItem(characterId, loot.item_id, loot.quantity);
            if (!success) {
                this.context.logger.warn(`Failed to add ${loot.item_id} to inventory (no space?)`);
                return false;
            }

            // Remove from dropped loot
            if (this.useMemory) {
                this.memoryLoot.delete(lootId);
            } else {
                await this.context.db.execute(`DELETE FROM ${this.lootTableName} WHERE id = ?`, [lootId]);
            }

            // Emit event
            this.context.events.emit('loot:picked', {
                characterId,
                lootId,
                itemId: loot.item_id,
                quantity: loot.quantity
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error picking up loot: ${error}`);
            return false;
        }
    }

    /**
     * Get all dropped loot in a zone for a specific character
     */
    async getLootInZone(characterId: number, zone: string): Promise<DroppedItem[]> {
        try {
            if (this.useMemory) {
                // In-memory storage
                const now = new Date();
                const items: DroppedItem[] = [];

                for (const [id, item] of this.memoryLoot.entries()) {
                    if (item.characterId === characterId && item.zone === zone && item.expiresAt > now) {
                        items.push(item);
                    }
                }

                return items;
            } else {
                // Database storage
                const [rows] = await this.context.db.execute(
                    `SELECT * FROM ${this.lootTableName} WHERE character_id = ? AND zone = ? AND expires_at > NOW()`,
                    [characterId, zone]
                );

                return (rows as any[]).map(row => ({
                    id: row.id,
                    characterId: row.character_id,
                    zone: row.zone,
                    itemId: row.item_id,
                    quantity: row.quantity,
                    x: row.x,
                    y: row.y,
                    createdAt: new Date(row.created_at),
                    expiresAt: new Date(row.expires_at)
                }));
            }
        } catch (error) {
            this.context.logger.error(`Error getting loot in zone: ${error}`);
            return [];
        }
    }

    /**
     * Cleanup expired loot
     */
    async cleanupExpiredLoot(): Promise<number> {
        try {
            if (this.useMemory) {
                // In-memory storage
                const now = new Date();
                let deletedCount = 0;

                for (const [id, item] of this.memoryLoot.entries()) {
                    if (item.expiresAt < now) {
                        this.memoryLoot.delete(id);
                        deletedCount++;
                    }
                }

                if (deletedCount > 0) {
                    this.context.logger.debug(`Cleaned up ${deletedCount} expired loot items`);
                }

                return deletedCount;
            } else {
                // Database storage
                const result = await this.context.db.execute(
                    `DELETE FROM ${this.lootTableName} WHERE expires_at < NOW()`
                );

                const deletedCount = (result as any)[0].affectedRows;
                if (deletedCount > 0) {
                    this.context.logger.debug(`Cleaned up ${deletedCount} expired loot items`);
                }

                return deletedCount;
            }
        } catch (error) {
            this.context.logger.error(`Error cleaning up expired loot: ${error}`);
            return 0;
        }
    }

    /**
     * Roll loot table to determine drops
     * Loot table format: [{ item: "ItemId", chance: 40, quantity: [1, 3] }, ...]
     */
    async rollLootTable(lootTable: any[]): Promise<LootTable[]> {
        const drops: LootTable[] = [];

        for (const entry of lootTable) {
            const roll = Math.random() * 100;
            if (roll < entry.chance) {
                let quantity = entry.quantity;
                if (Array.isArray(quantity)) {
                    // Random quantity between min and max
                    const min = quantity[0];
                    const max = quantity[1];
                    quantity = Math.floor(Math.random() * (max - min + 1)) + min;
                }

                drops.push({
                    itemId: entry.item,
                    quantity
                });
            }
        }

        return drops;
    }

    startCleanup() {
        this.cleanupInterval = setInterval(async () => {
            await this.cleanupExpiredLoot();
        }, this.cleanupIntervalTime);

        this.context.logger.debug("Loot cleanup started");
    }

    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
