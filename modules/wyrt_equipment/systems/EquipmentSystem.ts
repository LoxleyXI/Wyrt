import { ModuleContext } from "../../../src/module/ModuleSystem";

export interface EquipmentSet {
    characterId: number;
    head: string | null;
    chest: string | null;
    legs: string | null;
    feet: string | null;
    hands: string | null;
    neck: string | null;
    ring1: string | null;
    ring2: string | null;
    weapon: string | null;
}

export interface Stats {
    [key: string]: number;
}

export interface EquipmentAPI {
    equip(characterId: number, itemId: string, slot: string): Promise<boolean>;
    unequip(characterId: number, slot: string): Promise<boolean>;
    getEquipment(characterId: number): Promise<EquipmentSet | null>;
    getStats(characterId: number): Promise<Stats>;
    canEquip(characterId: number, itemId: string, slot: string): Promise<boolean>;
}

export class EquipmentSystem {
    private context: ModuleContext;
    private gameId: string;
    private equipmentTableName: string;
    private validSlots = ['head', 'chest', 'legs', 'feet', 'hands', 'neck', 'ring1', 'ring2', 'weapon'];

    constructor(context: ModuleContext, gameId: string) {
        this.context = context;
        this.gameId = gameId;
        this.equipmentTableName = `${gameId}_equipment`;
    }

    getAPI(): EquipmentAPI {
        return {
            equip: this.equip.bind(this),
            unequip: this.unequip.bind(this),
            getEquipment: this.getEquipment.bind(this),
            getStats: this.getStats.bind(this),
            canEquip: this.canEquip.bind(this)
        };
    }

    /**
     * Equip an item to a character's equipment slot
     */
    async equip(characterId: number, itemId: string, slot: string): Promise<boolean> {
        try {
            if (!this.validSlots.includes(slot)) {
                this.context.logger.warn(`Invalid equipment slot: ${slot}`);
                return false;
            }

            // Check if can equip (via hook - allows game modules to add requirements)
            const canEquip = await this.canEquip(characterId, itemId, slot);
            if (!canEquip) {
                this.context.logger.warn(`Cannot equip ${itemId} to ${slot} for character ${characterId}`);
                return false;
            }

            // Get current equipment
            const equipment = await this.getEquipment(characterId);
            if (!equipment) {
                // Create equipment row
                await this.context.db.query(
                    `INSERT INTO ${this.equipmentTableName} (character_id) VALUES (?)`,
                    [characterId]
                );
            }

            // Get old item in slot
            const oldItemId = equipment ? (equipment as any)[slot] : null;

            // Calculate old and new stats
            const oldStats = await this.getStats(characterId);

            // Update equipment (using dynamic slot name)
            await this.context.db.query(
                `UPDATE ${this.equipmentTableName} SET ${slot} = ? WHERE character_id = ?`,
                [itemId, characterId]
            );

            // Calculate new stats
            const newStats = await this.getStats(characterId);

            // Emit events
            this.context.events.emit('equipment:equipped', {
                characterId,
                itemId,
                slot,
                oldItemId
            });

            this.context.events.emit('equipment:statsChanged', {
                characterId,
                oldStats,
                newStats
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error equipping item: ${error}`);
            return false;
        }
    }

    /**
     * Unequip an item from a character's equipment slot
     */
    async unequip(characterId: number, slot: string): Promise<boolean> {
        try {
            if (!this.validSlots.includes(slot)) {
                this.context.logger.warn(`Invalid equipment slot: ${slot}`);
                return false;
            }

            // Get current equipment
            const equipment = await this.getEquipment(characterId);
            if (!equipment) {
                return false;
            }

            const itemId = (equipment as any)[slot];
            if (!itemId) {
                return false; // Slot already empty
            }

            // Calculate old stats
            const oldStats = await this.getStats(characterId);

            // Update equipment (set slot to NULL)
            await this.context.db.query(
                `UPDATE ${this.equipmentTableName} SET ${slot} = NULL WHERE character_id = ?`,
                [characterId]
            );

            // Calculate new stats
            const newStats = await this.getStats(characterId);

            // Emit events
            this.context.events.emit('equipment:unequipped', {
                characterId,
                itemId,
                slot
            });

            this.context.events.emit('equipment:statsChanged', {
                characterId,
                oldStats,
                newStats
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error unequipping item: ${error}`);
            return false;
        }
    }

    /**
     * Get character's equipped items
     */
    async getEquipment(characterId: number): Promise<EquipmentSet | null> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT * FROM ${this.equipmentTableName} WHERE character_id = ?`,
                [characterId]
            ) as any;

            if (!rows || rows.length === 0) {
                return null;
            }

            const equipment = rows[0];
            return {
                characterId: equipment.character_id,
                head: equipment.head,
                chest: equipment.chest,
                legs: equipment.legs,
                feet: equipment.feet,
                hands: equipment.hands,
                neck: equipment.neck,
                ring1: equipment.ring1,
                ring2: equipment.ring2,
                weapon: equipment.weapon
            };
        } catch (error) {
            this.context.logger.error(`Error getting equipment: ${error}`);
            return null;
        }
    }

    /**
     * Calculate aggregated stats from all equipped items
     * Uses event hook to allow game modules to provide item stats
     */
    async getStats(characterId: number): Promise<Stats> {
        try {
            const equipment = await this.getEquipment(characterId);
            if (!equipment) {
                return {};
            }

            const totalStats: Stats = {};

            // Iterate through all equipment slots
            for (const slot of this.validSlots) {
                const itemId = (equipment as any)[slot];
                if (!itemId) {
                    continue;
                }

                // Request item stats from game module via event hook
                const itemStats = await this.getItemStats(itemId);

                // Aggregate stats
                for (const stat in itemStats) {
                    if (!totalStats[stat]) {
                        totalStats[stat] = 0;
                    }
                    totalStats[stat] += itemStats[stat];
                }
            }

            return totalStats;
        } catch (error) {
            this.context.logger.error(`Error calculating stats: ${error}`);
            return {};
        }
    }

    /**
     * Check if character can equip an item
     * Uses event hook to allow game modules to add requirements (level, class, etc.)
     */
    async canEquip(characterId: number, itemId: string, slot: string): Promise<boolean> {
        try {
            // Emit hook event - game modules can return false to block equipping
            const results = await this.context.events.emitAsync('equipment:canEquip', {
                characterId,
                itemId,
                slot
            });

            // If any listener returns false, cannot equip
            if (results && results.some((result: any) => result === false)) {
                return false;
            }

            return true;
        } catch (error) {
            this.context.logger.error(`Error checking can equip: ${error}`);
            return false;
        }
    }

    /**
     * Get item stats from game module
     * Uses event hook to allow game modules to provide item stats
     */
    private async getItemStats(itemId: string): Promise<Stats> {
        try {
            // Emit hook event
            const results = await this.context.events.emitAsync('equipment:getItemStats', itemId);

            // Merge all results
            const stats: Stats = {};
            if (results) {
                for (const result of results) {
                    if (result && typeof result === 'object') {
                        for (const stat in result) {
                            if (!stats[stat]) {
                                stats[stat] = 0;
                            }
                            stats[stat] += result[stat];
                        }
                    }
                }
            }

            return stats;
        } catch (error) {
            this.context.logger.error(`Error getting item stats: ${error}`);
            return {};
        }
    }
}
