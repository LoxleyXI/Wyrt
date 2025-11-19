import { ModuleContext } from "../../../src/module/ModuleContext";

export interface Recipe {
    name: string;
    skill: string;
    level: number;
    materials: Array<[number, string]>; // [quantity, itemId]
    result: Array<[number, string]>;
    xp?: number; // Optional XP override
}

export interface CraftingManagerConfig {
    skillTableName: string;
}

export interface CraftValidation {
    valid: boolean;
    error?: string;
    missingMaterials?: Array<{ item: string; needed: number; has: number }>;
    inventorySpaceNeeded?: number;
}

export class CraftingManager {
    private context: ModuleContext;
    private config: CraftingManagerConfig;

    constructor(context: ModuleContext, config: CraftingManagerConfig) {
        this.context = context;
        this.config = config;
    }

    /**
     * Validate if a player can craft a recipe
     */
    async validateRecipe(
        playerId: string,
        recipe: Recipe,
        quantity: number,
        playerManager: any,
        skillManager: any
    ): Promise<CraftValidation> {
        const player = playerManager.getPlayer(playerId);
        if (!player) {
            return { valid: false, error: "Player not found" };
        }

        // Check skill level
        const characterId = this.getCharacterId(player);
        if (!characterId) {
            return { valid: false, error: "Character ID not found" };
        }

        const playerSkillLevel = await skillManager.getPlayerSkillLevel(characterId, recipe.skill);
        if (playerSkillLevel < recipe.level) {
            return {
                valid: false,
                error: `You need level ${recipe.level} ${recipe.skill} to craft this (you have ${playerSkillLevel})`
            };
        }

        // Check materials
        const missingMaterials: Array<{ item: string; needed: number; has: number }> = [];
        for (const [neededQty, itemId] of recipe.materials) {
            const totalNeeded = neededQty * quantity;
            const playerHas = player.inventory.items.get(itemId) || 0;

            if (playerHas < totalNeeded) {
                missingMaterials.push({
                    item: itemId,
                    needed: totalNeeded,
                    has: playerHas
                });
            }
        }

        if (missingMaterials.length > 0) {
            return {
                valid: false,
                error: "Insufficient materials",
                missingMaterials
            };
        }

        // Check inventory space
        const resultItemCount = recipe.result.reduce((sum, [qty]) => sum + qty, 0);
        const totalResultItems = resultItemCount * quantity;
        const currentInventorySize = player.inventory.items.size;
        const maxInventorySize = 100; // TODO: Make configurable

        // Calculate unique result items (could stack)
        const uniqueResultItems = new Set(recipe.result.map(([_, itemId]) => itemId));
        const newItemsAdded = Array.from(uniqueResultItems).filter(
            itemId => !player.inventory.items.has(itemId)
        ).length;

        const spaceNeeded = newItemsAdded;
        const spaceAvailable = maxInventorySize - currentInventorySize;

        if (spaceNeeded > spaceAvailable) {
            return {
                valid: false,
                error: "Inventory full",
                inventorySpaceNeeded: spaceNeeded
            };
        }

        return { valid: true };
    }

    /**
     * Execute a single craft
     */
    async executeCraft(
        playerId: string,
        recipe: Recipe,
        playerManager: any,
        skillManager: any
    ): Promise<{ success: boolean; xpGained: number; error?: string }> {
        const player = playerManager.getPlayer(playerId);
        if (!player) {
            return { success: false, xpGained: 0, error: "Player not found" };
        }

        // Remove materials
        for (const [qty, itemId] of recipe.materials) {
            const removed = playerManager.removeItem(playerId, itemId, qty);
            if (!removed) {
                return { success: false, xpGained: 0, error: `Failed to remove ${itemId}` };
            }
        }

        // Add result items
        for (const [qty, itemId] of recipe.result) {
            playerManager.addItem(playerId, itemId, qty);
        }

        // Calculate and award XP
        const characterId = this.getCharacterId(player);
        if (!characterId) {
            return { success: true, xpGained: 0 }; // Crafted but no XP
        }

        const playerSkillLevel = await skillManager.getPlayerSkillLevel(characterId, recipe.skill);

        // No XP if 10+ levels above recipe
        if (playerSkillLevel >= recipe.level + 10) {
            return { success: true, xpGained: 0 };
        }

        // Calculate XP using skill manager (square root scaling)
        const [skillRows] = await this.context.db.query(
            `SELECT experience FROM ${this.config.skillTableName} WHERE character_id = ? AND skill_name = ?`,
            [characterId, recipe.skill]
        ) as any;
        const playerSkillXP = (skillRows && skillRows[0]) ? skillRows[0].experience : 0;

        let xpGain = 0;
        if (recipe.xp) {
            // Use override XP if specified
            xpGain = recipe.xp;
        } else {
            // Use skill manager's formula
            xpGain = skillManager.calculateSkillup(playerSkillXP, recipe.level, 1) || 0;
        }

        return { success: true, xpGained: xpGain };
    }

    /**
     * Craft multiple items with progress updates
     */
    async craftMultiple(
        playerId: string,
        recipe: Recipe,
        quantity: number,
        playerManager: any,
        skillManager: any,
        onProgress: (current: number, total: number, xpGained: number, item: string) => void
    ): Promise<{ success: boolean; totalXPGained: number; error?: string }> {
        let totalXP = 0;

        for (let i = 1; i <= quantity; i++) {
            const result = await this.executeCraft(playerId, recipe, playerManager, skillManager);

            if (!result.success) {
                return {
                    success: false,
                    totalXPGained: totalXP,
                    error: result.error || `Failed at craft ${i}/${quantity}`
                };
            }

            totalXP += result.xpGained;

            // Send progress update
            onProgress(i, quantity, result.xpGained, recipe.result[0][1]);

            // Small delay to allow UI updates (optional)
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return { success: true, totalXPGained: totalXP };
    }

    /**
     * Calculate maximum craftable quantity based on materials
     */
    calculateMaxQuantity(playerId: string, recipe: Recipe, playerManager: any): number {
        const player = playerManager.getPlayer(playerId);
        if (!player) return 0;

        let maxQty = Infinity;

        for (const [neededQty, itemId] of recipe.materials) {
            const playerHas = player.inventory.items.get(itemId) || 0;
            const possibleCrafts = Math.floor(playerHas / neededQty);
            maxQty = Math.min(maxQty, possibleCrafts);
        }

        return maxQty === Infinity ? 0 : maxQty;
    }

    /**
     * Helper to get character ID from player
     */
    private getCharacterId(player: any): string | null {
        return player.character_id || player.charid || player.id || null;
    }
}
