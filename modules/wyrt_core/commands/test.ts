// File: modules/core/commands/test.ts
import { Command } from "../../../src/types/Command";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const command: Command = {
    alias: ["t"],
    gmlv: 0,
    exec: function(u: User, data: Data, args: string[]) {
        if (args[0]) {
            u.system(`Test command executed with param ${args[0]}`);
        } else {
            u.system("Test command executed");
        }
    }
};

export default command;
