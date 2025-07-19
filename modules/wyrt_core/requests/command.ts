import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 3,
    auth: true,
    exec: function(u: User, data: Data, payload: any, context?: any) {
        const { name, args } = payload;
        
        // Access commands through the module context
        const commands = context?.commands || (globalThis as any).moduleCommands;
        const command = commands?.cmd[name];

        if (!command) {
            u.error(`Unknown command: ${name}`);
            return;
        }

        // Check GM level in dev mode
        const config = context?.config || (globalThis as any).config;
        if (!config?.server?.options?.dev && command.gmlv && u.player.gmlv < command.gmlv) {
            u.error(`Insufficient privileges for command: ${name}`);
            return;
        }

        command.exec(u, data, args || []);
    }
};

export default handler;
