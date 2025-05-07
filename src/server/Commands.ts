//----------------------------------
// Wyrt - An MMO Engine
//----------------------------------
// Copyright (c) 2025 LoxleyXI
//
// https://github.com/LoxleyXI/Wyrt
//----------------------------------
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see http://www.gnu.org/licenses/
//----------------------------------
import { Command } from "../types/Command"
import { Data } from "../types/Data"
import { User } from "../types/User"

export class Commands {
    public cmd: Record<string, Command>;

    constructor() {
        this.cmd = {}

        //----------------------------------
        // test
        // A test command
        //----------------------------------
        this.cmd["test"] = {
            alias: ["t"],
            gmlv: 0,
            exec: function(u: User, data: Data, args: string[]) {
                if (args[0]) {
                    u.system(`Test command executed with param ${args[0]}`)
                }
                else {
                    u.system("Test command executed")
                }
            },
        }

        //----------------------------------
        // item
        // Display info about an item
        //----------------------------------
        this.cmd["item"] = {
            alias: [],
            gmlv: 0,
            exec: function(u: User, data: Data, args: string[]) {
                if (!args[0]) {
                    u.system(`item: No item name specified`)
                }
                else {
                    if (!data.items[args[0]]) {
                        u.system(`item: (${args[0]}): No such item exists`)
                    }
                    else {
                        // TODO: Give a different response type for JSON lookups that aren't printed
                        u.system(`item (${args[0]}): ${JSON.stringify(data.items[args[0]])}`)
                    }
                }
            },
        }

        //----------------------------------
        // Create command aliases
        //----------------------------------
        for (const func in this.cmd) {
            if (this.cmd[func].alias && this.cmd[func].alias.length) {
                for (const other of this.cmd[func].alias) {
                    this.cmd[other] = this.cmd[func];
                }
            }
        }
    }
}
