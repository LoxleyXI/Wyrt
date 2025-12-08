import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 1,
    auth: true,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        try {
            const { itemId, slot } = payload;

            if (!itemId || !slot) {
                u.error("Missing itemId or slot");
                return;
            }

            const equipment = context.equipment;
            const inventory = context.inventory;

            if (!equipment || !inventory) {
                u.error("Equipment or inventory system not available");
                return;
            }

            // Check if player has the item in inventory
            const item = await inventory.getItem(u.player.character_id, itemId);
            if (!item) {
                u.error("Item not found in inventory");
                return;
            }

            // Equip the item
            const success = await equipment.equip(u.player.character_id, itemId, slot);

            if (success) {
                // Remove from inventory
                await inventory.removeItem(u.player.character_id, itemId, 1);

                // Get updated equipment and stats
                const updatedEquipment = await equipment.getEquipment(u.player.character_id);
                const updatedStats = await equipment.getStats(u.player.character_id);

                u.send(JSON.stringify({
                    type: "itemEquipped",
                    itemId,
                    slot,
                    equipment: updatedEquipment,
                    stats: updatedStats
                }));
            } else {
                u.error("Failed to equip item (requirements not met?)");
            }
        } catch (error) {
            console.error("Error equipping item:", error);
            u.error("Failed to equip item");
        }
    }
};

export default handler;
