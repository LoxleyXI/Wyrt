/**
 * Inventory System
 *
 * Uses wyrt_data's generic InventoryItem table for persistence.
 * All operations are scoped by characterId (UUID string).
 */

import type { ModuleContext } from '../../../../src/module/ModuleContext.js';
import type DataModule from '../../../wyrt_data/index.js';

export interface InventoryItem {
  id: string;
  characterId: string;
  itemSlug: string;
  quantity: number;
  instanceData: Record<string, any>;
  acquiredAt: Date;
}

export interface InventoryAPI {
  addItem(characterId: string, itemSlug: string, quantity: number): Promise<boolean>;
  removeItem(characterId: string, itemSlug: string, quantity: number): Promise<boolean>;
  getInventory(characterId: string): Promise<InventoryItem[]>;
  getItem(characterId: string, itemSlug: string): Promise<InventoryItem | null>;
  hasItem(characterId: string, itemSlug: string, quantity?: number): Promise<boolean>;
  hasSpace(characterId: string, requiredSlots?: number): Promise<boolean>;
  getItemCount(characterId: string): Promise<number>;
}

export class InventorySystem implements InventoryAPI {
  private context: ModuleContext;
  private dataModule: DataModule;
  private maxSlots: number = 50;
  private maxStackSize: number = 99;

  constructor(context: ModuleContext, dataModule: DataModule) {
    this.context = context;
    this.dataModule = dataModule;

    // Read config
    if (context.config?.inventory?.maxSlots) {
      this.maxSlots = context.config.inventory.maxSlots;
    }
    if (context.config?.inventory?.maxStackSize) {
      this.maxStackSize = context.config.inventory.maxStackSize;
    }
  }

  private get db() {
    return this.dataModule.getDatabase();
  }

  getAPI(): InventoryAPI {
    return {
      addItem: this.addItem.bind(this),
      removeItem: this.removeItem.bind(this),
      getInventory: this.getInventory.bind(this),
      getItem: this.getItem.bind(this),
      hasItem: this.hasItem.bind(this),
      hasSpace: this.hasSpace.bind(this),
      getItemCount: this.getItemCount.bind(this),
    };
  }

  /**
   * Add an item to character's inventory.
   * Stacks with existing items if possible.
   */
  async addItem(characterId: string, itemSlug: string, quantity: number): Promise<boolean> {
    try {
      // Try to find existing stack
      const existing = await this.db.inventoryItem.findFirst({
        where: {
          characterId,
          itemSlug,
        },
      });

      if (existing) {
        // Stack with existing
        const newQuantity = Math.min(this.maxStackSize, existing.quantity + quantity);
        const added = newQuantity - existing.quantity;
        const remaining = quantity - added;

        await this.db.inventoryItem.update({
          where: { id: existing.id },
          data: { quantity: newQuantity },
        });

        this.context.events.emit('inventory:itemAdded', {
          characterId,
          itemSlug,
          quantity: added,
        });

        // If there's remaining quantity, add as new stack
        if (remaining > 0) {
          return await this.addItem(characterId, itemSlug, remaining);
        }

        return true;
      }

      // Check if inventory is full
      const itemCount = await this.getItemCount(characterId);
      if (itemCount >= this.maxSlots) {
        this.context.logger.warn(`Inventory full for character ${characterId}`);
        return false;
      }

      // Create new inventory entry
      await this.db.inventoryItem.create({
        data: {
          characterId,
          itemSlug,
          quantity: Math.min(quantity, this.maxStackSize),
          instanceData: {},
        },
      });

      this.context.events.emit('inventory:itemAdded', {
        characterId,
        itemSlug,
        quantity,
      });

      // If quantity exceeds max stack, add remaining as new stack
      if (quantity > this.maxStackSize) {
        return await this.addItem(characterId, itemSlug, quantity - this.maxStackSize);
      }

      return true;
    } catch (error) {
      this.context.logger.error(`Error adding item to inventory: ${error}`);
      return false;
    }
  }

  /**
   * Remove an item from character's inventory.
   */
  async removeItem(characterId: string, itemSlug: string, quantity: number): Promise<boolean> {
    try {
      const item = await this.getItem(characterId, itemSlug);
      if (!item) {
        this.context.logger.warn(`Item ${itemSlug} not found for character ${characterId}`);
        return false;
      }

      if (item.quantity < quantity) {
        this.context.logger.warn(`Not enough ${itemSlug} (have: ${item.quantity}, need: ${quantity})`);
        return false;
      }

      if (item.quantity === quantity) {
        // Remove entire stack
        await this.db.inventoryItem.delete({
          where: { id: item.id },
        });
      } else {
        // Decrease quantity
        await this.db.inventoryItem.update({
          where: { id: item.id },
          data: { quantity: item.quantity - quantity },
        });
      }

      this.context.events.emit('inventory:itemRemoved', {
        characterId,
        itemSlug,
        quantity,
      });

      return true;
    } catch (error) {
      this.context.logger.error(`Error removing item from inventory: ${error}`);
      return false;
    }
  }

  /**
   * Get character's entire inventory.
   */
  async getInventory(characterId: string): Promise<InventoryItem[]> {
    try {
      const items = await this.db.inventoryItem.findMany({
        where: { characterId },
        orderBy: { acquiredAt: 'asc' },
      });

      return items.map((item) => ({
        id: item.id,
        characterId: item.characterId,
        itemSlug: item.itemSlug,
        quantity: item.quantity,
        instanceData: (item.instanceData as Record<string, any>) || {},
        acquiredAt: item.acquiredAt,
      }));
    } catch (error) {
      this.context.logger.error(`Error getting inventory: ${error}`);
      return [];
    }
  }

  /**
   * Get a specific item from inventory.
   */
  async getItem(characterId: string, itemSlug: string): Promise<InventoryItem | null> {
    try {
      const item = await this.db.inventoryItem.findFirst({
        where: {
          characterId,
          itemSlug,
        },
      });

      if (!item) return null;

      return {
        id: item.id,
        characterId: item.characterId,
        itemSlug: item.itemSlug,
        quantity: item.quantity,
        instanceData: (item.instanceData as Record<string, any>) || {},
        acquiredAt: item.acquiredAt,
      };
    } catch (error) {
      this.context.logger.error(`Error getting item: ${error}`);
      return null;
    }
  }

  /**
   * Check if character has an item (with optional quantity).
   */
  async hasItem(characterId: string, itemSlug: string, quantity: number = 1): Promise<boolean> {
    const item = await this.getItem(characterId, itemSlug);
    return item !== null && item.quantity >= quantity;
  }

  /**
   * Check if character has inventory space.
   */
  async hasSpace(characterId: string, requiredSlots: number = 1): Promise<boolean> {
    const count = await this.getItemCount(characterId);
    return count + requiredSlots <= this.maxSlots;
  }

  /**
   * Get total number of item stacks in inventory.
   */
  async getItemCount(characterId: string): Promise<number> {
    try {
      return await this.db.inventoryItem.count({
        where: { characterId },
      });
    } catch (error) {
      this.context.logger.error(`Error counting inventory: ${error}`);
      return 0;
    }
  }
}
