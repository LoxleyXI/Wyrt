import { ModuleContext } from "../../../src/module/ModuleContext";
import { User } from "../../../src/types/User";
import { Request } from "../../../src/types/Request";

const handler: Request = {
    cost: 1,
    auth: true,
    exec: async (u: User, data: any, payload: any, context?: ModuleContext) => {
        const { skill, recipe: recipeName, quantity } = payload;

        if (!skill || !recipeName || !quantity || quantity < 1) {
            u.error("Invalid craft request");
            return;
        }

        // Get game module (e.g., my_game)
        // The game module should have initialized crafting
        const gameModule = context.getModule('my_game'); // TODO: Make this configurable
        if (!gameModule) {
            u.error("Game module not found");
            return;
        }

        const craftingManager = gameModule.craftingManager;
        const playerManager = gameModule.playerManager;
        const skillManager = gameModule.skillManager;

        if (!craftingManager || !playerManager || !skillManager) {
            u.error("Crafting system not initialized");
            return;
        }

        // Get recipe from game data (makes/needs format) using proper getModule() pattern
        const my_gameModule = context.getModule('my_game');
        if (!my_gameModule) {
            u.error("Game module not found");
            return;
        }

        const allRecipes = my_gameModule.data?.recipes || {};
        const recipeData = allRecipes[recipeName];

        if (!recipeData) {
            u.error(`Recipe ${recipeName} not found`);
            return;
        }

        // Convert makes/needs format to CraftingManager format
        // makes: { ItemId: quantity, ... } → result: [[quantity, ItemId], ...]
        // needs: { MaterialId: quantity, ... } → materials: [[quantity, MaterialId], ...]
        const materials: Array<[number, string]> = [];
        if (recipeData.needs) {
            for (const [itemId, qty] of Object.entries(recipeData.needs)) {
                materials.push([qty as number, itemId]);
            }
        }

        const result: Array<[number, string]> = [];
        if (recipeData.makes) {
            for (const [itemId, qty] of Object.entries(recipeData.makes)) {
                result.push([qty as number, itemId]);
            }
        }

        const recipe = {
            name: recipeData.name || recipeName,
            skill: recipeData.skill || skill,
            level: recipeData.level || 1,
            materials: materials,
            result: result,
            xp: recipeData.xp
        };

        const playerId = u.id.toString();

        // Validate recipe
        const validation = await craftingManager.validateRecipe(
            playerId,
            recipe,
            quantity,
            playerManager,
            skillManager
        );

        if (!validation.valid) {
            u.error(validation.error || "Cannot craft this recipe");
            return;
        }

        // Execute crafts with progress updates
        const craftResult = await craftingManager.craftMultiple(
            playerId,
            recipe,
            quantity,
            playerManager,
            skillManager,
            async (current, total, xpGained, item) => {
                // Award XP if any was gained
                if (xpGained > 0) {
                    await playerManager.grantSkillXP(u, skill, xpGained);
                }

                // Send progress update
                u.send(JSON.stringify({
                    type: 'craft_progress',
                    current,
                    total,
                    xpGained,
                    item,
                    recipeName
                }));
            }
        );

        if (!craftResult.success) {
            u.error(craftResult.error || "Crafting failed");
            return;
        }

        // Send completion message
        u.send(JSON.stringify({
            type: 'craft_complete',
            skill,
            recipe: recipeName,
            quantity,
            totalXPGained: craftResult.totalXPGained
        }));

        // Update inventory on client
        const player = playerManager.getPlayer(playerId);
        if (player) {
            u.send(JSON.stringify({
                type: 'inventory_update',
                inventory: {
                    items: Array.from(player.inventory.items.entries()),
                    equipment: Array.from(player.inventory.equipment.entries()),
                    gold: player.inventory.gold
                }
            }));
        }
    }
};

export default handler;
