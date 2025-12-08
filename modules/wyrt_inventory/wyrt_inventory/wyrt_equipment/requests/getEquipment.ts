import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 1,
    auth: true,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        try {
            const equipment = context.equipment;
            if (!equipment) {
                u.error("Equipment system not available");
                return;
            }

            const equipmentData = await equipment.getEquipment(u.player.character_id);
            const stats = await equipment.getStats(u.player.character_id);

            u.send(JSON.stringify({
                type: "equipmentData",
                equipment: equipmentData,
                stats: stats
            }));
        } catch (error) {
            console.error("Error getting equipment:", error);
            u.error("Failed to get equipment");
        }
    }
};

export default handler;
