import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 1,
    auth: true,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        try {
            const { lootId } = payload;

            if (!lootId) {
                u.error("Missing lootId");
                return;
            }

            const loot = context.loot;
            if (!loot) {
                u.error("Loot system not available");
                return;
            }

            const success = await loot.pickupLoot(u.player.character_id, lootId);

            if (success) {
                u.send(JSON.stringify({
                    type: "lootPicked",
                    lootId
                }));

                // Send updated inventory
                const inventory = context.inventory;
                if (inventory) {
                    const items = await inventory.getInventory(u.player.character_id);
                    u.send(JSON.stringify({
                        type: "inventoryData",
                        items
                    }));
                }
            } else {
                u.error("Failed to pickup loot (expired or inventory full?)");
            }
        } catch (error) {
            console.error("Error picking up loot:", error);
            u.error("Failed to pickup loot");
        }
    }
};

export default handler;
