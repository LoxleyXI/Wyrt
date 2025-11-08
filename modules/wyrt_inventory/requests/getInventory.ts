import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 1,
    auth: true,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        try {
            const inventory = context.inventory;
            if (!inventory) {
                u.error("Inventory system not available");
                return;
            }

            const items = await inventory.getInventory(u.player.character_id);

            u.send(JSON.stringify({
                type: "inventoryData",
                items: items
            }));
        } catch (error) {
            console.error("Error getting inventory:", error);
            u.error("Failed to get inventory");
        }
    }
};

export default handler;
