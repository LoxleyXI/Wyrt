/**
 * Equipment System
 *
 * Uses wyrt_data's generic Equipment table for persistence.
 * Each equipped item is a row with characterId, slot, and itemSlug.
 * All operations use characterId (UUID string).
 */

import type { ModuleContext } from '../../../../../src/module/ModuleContext.js';
import type DataModule from '../../../../wyrt_data/index.js';

export interface EquipmentSlot {
  id: string;
  characterId: string;
  slot: string;
  itemSlug: string;
  instanceData: Record<string, any>;
  equippedAt: Date;
}

export interface EquipmentSet {
  [slot: string]: EquipmentSlot | null;
}

export interface Stats {
  [key: string]: number;
}

export interface EquipmentAPI {
  equip(characterId: string, itemSlug: string, slot: string): Promise<boolean>;
  unequip(characterId: string, slot: string): Promise<boolean>;
  getEquipment(characterId: string): Promise<EquipmentSet>;
  getEquippedItem(characterId: string, slot: string): Promise<EquipmentSlot | null>;
  getStats(characterId: string): Promise<Stats>;
  canEquip(characterId: string, itemSlug: string, slot: string): Promise<boolean>;
}

export class EquipmentSystem implements EquipmentAPI {
  private context: ModuleContext;
  private dataModule: DataModule;
  private gameId: string;

  // Standard equipment slots
  private validSlots = [
    'head', 'chest', 'legs', 'feet', 'hands',
    'neck', 'ring1', 'ring2',
    'mainhand', 'offhand',
    'back', 'waist',
  ];

  constructor(context: ModuleContext, dataModule: DataModule, gameId: string) {
    this.context = context;
    this.dataModule = dataModule;
    this.gameId = gameId;
  }

  private get db() {
    return this.dataModule.getDatabase();
  }

  getAPI(): EquipmentAPI {
    return {
      equip: this.equip.bind(this),
      unequip: this.unequip.bind(this),
      getEquipment: this.getEquipment.bind(this),
      getEquippedItem: this.getEquippedItem.bind(this),
      getStats: this.getStats.bind(this),
      canEquip: this.canEquip.bind(this),
    };
  }

  /**
   * Equip an item to a character's equipment slot.
   * Replaces any existing item in that slot.
   */
  async equip(characterId: string, itemSlug: string, slot: string): Promise<boolean> {
    try {
      if (!this.validSlots.includes(slot)) {
        this.context.logger.warn(`Invalid equipment slot: ${slot}`);
        return false;
      }

      // Check if can equip (via hook)
      const canEquip = await this.canEquip(characterId, itemSlug, slot);
      if (!canEquip) {
        this.context.logger.warn(`Cannot equip ${itemSlug} to ${slot} for character ${characterId}`);
        return false;
      }

      // Get old item in slot
      const oldEquipment = await this.getEquippedItem(characterId, slot);
      const oldItemSlug = oldEquipment?.itemSlug || null;

      // Calculate old stats
      const oldStats = await this.getStats(characterId);

      // Upsert equipment (unique on characterId + slot)
      await this.db.equipment.upsert({
        where: {
          characterId_slot: {
            characterId,
            slot,
          },
        },
        update: {
          itemSlug,
          instanceData: {},
          equippedAt: new Date(),
        },
        create: {
          characterId,
          slot,
          itemSlug,
          instanceData: {},
        },
      });

      // Calculate new stats
      const newStats = await this.getStats(characterId);

      // Emit events
      this.context.events.emit('equipment:equipped', {
        characterId,
        itemSlug,
        slot,
        oldItemSlug,
      });

      this.context.events.emit('equipment:statsChanged', {
        characterId,
        oldStats,
        newStats,
      });

      return true;
    } catch (error) {
      this.context.logger.error(`Error equipping item: ${error}`);
      return false;
    }
  }

  /**
   * Unequip an item from a character's equipment slot.
   */
  async unequip(characterId: string, slot: string): Promise<boolean> {
    try {
      if (!this.validSlots.includes(slot)) {
        this.context.logger.warn(`Invalid equipment slot: ${slot}`);
        return false;
      }

      // Get current item in slot
      const equipment = await this.getEquippedItem(characterId, slot);
      if (!equipment) {
        return false; // Slot already empty
      }

      const itemSlug = equipment.itemSlug;

      // Calculate old stats
      const oldStats = await this.getStats(characterId);

      // Delete equipment row
      await this.db.equipment.delete({
        where: {
          characterId_slot: {
            characterId,
            slot,
          },
        },
      });

      // Calculate new stats
      const newStats = await this.getStats(characterId);

      // Emit events
      this.context.events.emit('equipment:unequipped', {
        characterId,
        itemSlug,
        slot,
      });

      this.context.events.emit('equipment:statsChanged', {
        characterId,
        oldStats,
        newStats,
      });

      return true;
    } catch (error) {
      this.context.logger.error(`Error unequipping item: ${error}`);
      return false;
    }
  }

  /**
   * Get character's all equipped items.
   */
  async getEquipment(characterId: string): Promise<EquipmentSet> {
    try {
      const items = await this.db.equipment.findMany({
        where: { characterId },
      });

      // Build equipment set with all slots
      const equipment: EquipmentSet = {};
      for (const slot of this.validSlots) {
        const item = items.find((i) => i.slot === slot);
        equipment[slot] = item
          ? {
              id: item.id,
              characterId: item.characterId,
              slot: item.slot,
              itemSlug: item.itemSlug,
              instanceData: (item.instanceData as Record<string, any>) || {},
              equippedAt: item.equippedAt,
            }
          : null;
      }

      return equipment;
    } catch (error) {
      this.context.logger.error(`Error getting equipment: ${error}`);
      return {};
    }
  }

  /**
   * Get item equipped in a specific slot.
   */
  async getEquippedItem(characterId: string, slot: string): Promise<EquipmentSlot | null> {
    try {
      const item = await this.db.equipment.findUnique({
        where: {
          characterId_slot: {
            characterId,
            slot,
          },
        },
      });

      if (!item) return null;

      return {
        id: item.id,
        characterId: item.characterId,
        slot: item.slot,
        itemSlug: item.itemSlug,
        instanceData: (item.instanceData as Record<string, any>) || {},
        equippedAt: item.equippedAt,
      };
    } catch (error) {
      this.context.logger.error(`Error getting equipped item: ${error}`);
      return null;
    }
  }

  /**
   * Calculate aggregated stats from all equipped items.
   * Uses event hook to allow game modules to provide item stats.
   */
  async getStats(characterId: string): Promise<Stats> {
    try {
      const items = await this.db.equipment.findMany({
        where: { characterId },
      });

      const totalStats: Stats = {};

      for (const equip of items) {
        // Request item stats from game module via event hook
        const itemStats = await this.getItemStats(equip.itemSlug);

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
   * Check if character can equip an item.
   * Uses event hook to allow game modules to add requirements.
   */
  async canEquip(characterId: string, itemSlug: string, slot: string): Promise<boolean> {
    try {
      // Emit hook event - game modules can return false to block equipping
      const results = await this.context.events.emitAsync('equipment:canEquip', {
        characterId,
        itemSlug,
        slot,
        gameId: this.gameId,
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
   * Get item stats from game module.
   * Uses event hook to allow game modules to provide item stats.
   */
  private async getItemStats(itemSlug: string): Promise<Stats> {
    try {
      // Emit hook event
      const results = await this.context.events.emitAsync('equipment:getItemStats', {
        itemSlug,
        gameId: this.gameId,
      });

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
