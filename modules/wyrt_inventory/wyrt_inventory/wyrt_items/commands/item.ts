// File: modules/core/commands/item.ts
import { Command } from "../../../src/types/Command";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const command: Command = {
    alias: [],
    gmlv: 0,
    exec: function(u: User, data: Data, args: string[]) {
        if (!args[0]) {
            u.system(`item: No item name specified`);
        } else {
            if (!data.items[args[0]]) {
                u.system(`item: (${args[0]}): No such item exists`);
            } else {
                u.system(`item (${args[0]}): ${JSON.stringify(data.items[args[0]])}`);
            }
        }
    }
};

export default command;
