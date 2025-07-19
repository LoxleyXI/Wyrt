// File: modules/core/requests/heartbeat.ts
import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 1,
    auth: false,
    exec: function(u: User, data: Data, payload: any, context?: any) {
        u.system(JSON.stringify({
            type: "heartbeat_response",
            timestamp: Date.now(),
            authenticated: u.isAuthenticated()
        }));
    }
};

export default handler;
