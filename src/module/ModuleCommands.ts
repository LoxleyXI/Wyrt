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
import { Command } from "../types/Command";

export class ModuleCommands {
    public cmd: Record<string, Command> = {};
    private moduleCommands: Map<string, Command> = new Map();

    registerCommand(name: string, command: Command): void {
        this.moduleCommands.set(name, command);
        this.cmd[name] = command;

        // Register aliases
        if (command.alias && command.alias.length) {
            for (const alias of command.alias) {
                this.moduleCommands.set(alias, command);
                this.cmd[alias] = command;
            }
        }
    }

    unregisterCommand(name: string): boolean {
        if (this.moduleCommands.has(name)) {
            const command = this.moduleCommands.get(name);

            if (command?.alias) {
                for (const alias of command.alias) {
                    delete this.cmd[alias];
                    this.moduleCommands.delete(alias);
                }
            }
            
            delete this.cmd[name];
            this.moduleCommands.delete(name);

            return true;
        }

        return false;
    }
}
