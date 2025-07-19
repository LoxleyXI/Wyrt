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
import { Request } from "../types/Request";

export class ModuleRequestTypes {
    public handlers: Record<string, Request> = {};
    private moduleHandlers: Map<string, Request> = new Map();

    registerHandler(type: string, handler: Request): void {
        this.moduleHandlers.set(type, handler);
        this.handlers[type] = handler;
    }

    unregisterHandler(type: string): boolean {
        if (this.moduleHandlers.has(type)) {
            delete this.handlers[type];
            this.moduleHandlers.delete(type);

            return true;
        }

        return false;
    }
}
