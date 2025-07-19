// File: modules/core/requests/move.ts
import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 1,
    auth: true,
    exec: function(u: User, data: Data, payload: any, context?: any) {
        const { x, y, z } = payload;

        u.system(JSON.stringify({
            type: "movement_result",
            success: true,
            direction: 0,
            coordinates: { x, y, z }
        }));

        console.log(`[Move] ${u.player.name}: ${x}, ${y}, ${z}`);
    }
};

export default handler;
