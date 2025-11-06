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
import { Connection } from "mysql";
import { EventEmitter } from "events";
import { Data } from "../types/Data";
import { ModuleCommands } from "./ModuleCommands";
import { ModuleRequestTypes } from "./ModuleRequestTypes";
import { AuthManager } from "../server/AuthManager";
import { RateLimiter } from "../server/RateLimiter";
import { Logger } from "../server/ConsoleLogger";
import { WebManager } from "../server/WebManager";
import { CharacterCreateHook, CharacterSelectHook } from "../types/Hooks.js";

export interface ModuleContext {
    connection: Connection;
    data: Data;
    commands: ModuleCommands;
    requestTypes: ModuleRequestTypes;
    authManager: AuthManager;
    rateLimiter: RateLimiter;
    config: any;
    events: EventEmitter;
    logger: Logger;
    getModule: (moduleName: string) => any;
    webManager?: WebManager;

    // Hook system
    registerCharacterCreateHook: (gameId: string, hook: CharacterCreateHook) => void;
    getCharacterCreateHook: (gameId: string) => CharacterCreateHook | undefined;
    registerCharacterSelectHook: (gameId: string, hook: CharacterSelectHook) => void;
    getCharacterSelectHook: (gameId: string) => CharacterSelectHook | undefined;
}
