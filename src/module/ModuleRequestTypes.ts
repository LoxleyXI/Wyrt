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
    // Legacy flat handlers (for backward compatibility with core modules)
    public handlers: Record<string, Request> = {};

    // Game-scoped handlers: gameHandlers[gameId][handlerType]
    private gameHandlers: Map<string, Map<string, Request>> = new Map();

    private moduleHandlers: Map<string, Request> = new Map();

    /**
     * Register a handler for a specific game module
     * @param gameId - Module name (e.g., 'my_game', 'my_game')
     * @param type - Handler type (e.g., 'selectCharacter', 'move')
     * @param handler - The handler implementation
     */
    registerGameHandler(gameId: string, type: string, handler: Request): void {
        if (!this.gameHandlers.has(gameId)) {
            this.gameHandlers.set(gameId, new Map());
        }
        this.gameHandlers.get(gameId)!.set(type, handler);
    }

    /**
     * Register a global handler (backward compatibility for core modules)
     */
    registerHandler(type: string, handler: Request): void {
        this.moduleHandlers.set(type, handler);
        this.handlers[type] = handler;
    }

    /**
     * Get handler for a specific game and type
     * Falls back to global handler if game-specific not found
     */
    getHandler(gameId: string | undefined, type: string): Request | undefined {
        // Try game-specific handler first
        if (gameId && this.gameHandlers.has(gameId)) {
            const gameHandler = this.gameHandlers.get(gameId)!.get(type);
            if (gameHandler) {
                return gameHandler;
            }
        }

        // Fall back to global handler (for core modules)
        return this.handlers[type];
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
