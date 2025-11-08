import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 1,
    auth: true,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        try {
            const { fromSlot, toSlot } = payload;

            if (typeof fromSlot !== 'number' || typeof toSlot !== 'number') {
                u.error("Invalid slot numbers");
                return;
            }

            const inventory = context.inventory;
            if (!inventory) {
                u.error("Inventory system not available");
                return;
            }

            const success = await inventory.moveItem(u.player.character_id, fromSlot, toSlot);

            if (success) {
                u.send(JSON.stringify({
                    type: "itemMoved",
                    fromSlot,
                    toSlot
                }));
            } else {
                u.error("Failed to move item");
            }
        } catch (error) {
            console.error("Error moving item:", error);
            u.error("Failed to move item");
        }
    }
};

export default handler;
