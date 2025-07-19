// File: modules/core/requests/chat.ts
import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 2,
    auth: true,
    exec: function(u: User, data: Data, payload: any) {
        const { message } = payload;

        if (!message || message.trim().length === 0) {
            u.error("Empty message");
            return;
        }

        // Echo the message
        u.chat(`${u.player.name}: ${message}`);

        // Send to other players in the same room/area
        for (const otherUser of Object.values(data.users)) {
            if (otherUser.id !== u.id && otherUser.player.authenticated) {
                otherUser.chat(`${u.player.name}: ${message}`);
            }
        }
    }
};

export default handler;
