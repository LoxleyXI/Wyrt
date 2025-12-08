import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 1,
    auth: true,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        try {
            const { slot } = payload;

            if (!slot) {
                u.error("Missing slot");
                return;
            }

            const equipment = context.equipment;
            const inventory = context.inventory;

            if (!equipment || !inventory) {
                u.error("Equipment or inventory system not available");
                return;
            }

            // Get current equipment
            const currentEquipment = await equipment.getEquipment(u.player.character_id);
            if (!currentEquipment) {
                u.error("No equipment found");
                return;
            }

            const itemId = (currentEquipment as any)[slot];
            if (!itemId) {
                u.error("No item equipped in that slot");
                return;
            }

            // Check if player has inventory space
            const hasSpace = await inventory.hasSpace(u.player.character_id);
            if (!hasSpace) {
                u.error("Inventory is full");
                return;
            }

            // Unequip the item
            const success = await equipment.unequip(u.player.character_id, slot);

            if (success) {
                // Add back to inventory
                await inventory.addItem(u.player.character_id, itemId, 1);

                // Get updated equipment and stats
                const updatedEquipment = await equipment.getEquipment(u.player.character_id);
                const updatedStats = await equipment.getStats(u.player.character_id);

                u.send(JSON.stringify({
                    type: "itemUnequipped",
                    itemId,
                    slot,
                    equipment: updatedEquipment,
                    stats: updatedStats
                }));
            } else {
                u.error("Failed to unequip item");
            }
        } catch (error) {
            console.error("Error unequipping item:", error);
            u.error("Failed to unequip item");
        }
    }
};

export default handler;
