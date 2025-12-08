import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 1,
    auth: true,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        try {
            const loot = context.loot;
            if (!loot) {
                u.error("Loot system not available");
                return;
            }

            // Get player's current zone
            const zone = u.player.zone || "Unknown";

            const lootItems = await loot.getLootInZone(u.player.character_id, zone);

            u.send(JSON.stringify({
                type: "lootData",
                items: lootItems
            }));
        } catch (error) {
            console.error("Error getting loot:", error);
            u.error("Failed to get loot");
        }
    }
};

export default handler;
