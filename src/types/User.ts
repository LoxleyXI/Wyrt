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
import { GameState } from "./GameState";
import { Menu } from "./Menu";
import { MessageType } from "./MessageType";

export class User {
    id: number;
    account: any;  // Account data (shared across games)
    player: any;   // Character data (game-specific)
    socket: any;
    log: string[];
    state: GameState;
    menu: Menu;
    clientIP: string;
    connectionTime: number;

    constructor(socket: any, id: number) {
        this.id = id;
        this.account = { authenticated: false };
        this.player = { authenticated: false };
        this.socket = socket;
        this.log = [];
        this.clientIP = '';
        this.connectionTime = Date.now();

        console.log("+ connection (web)");
    }

    output(msg: string, type: any) {
        if (this.socket.readyState === 1) { // WebSocket.OPEN
            this.socket.send(JSON.stringify({
                type: type,
                time: new Date().valueOf(),
                msg: msg,
            }));
        }
    }

    system(msg: string, ...args: any[]) {
        this.output(msg, MessageType.System);
    }

    error(msg: string, ...args: any[]) {
        this.output(msg, MessageType.Error);
    }

    chat(msg: string, ...args: any[]) {
        this.output(msg, MessageType.Chat);
    }

    isAuthenticated(): boolean {
        return this.account.authenticated === true;
    }

    hasPrivilege(level: number): boolean {
        return this.isAuthenticated() && this.player.gmlv >= level;
    }

    send(msg: string): void {
        if (this.socket.readyState === 1) { // WebSocket.OPEN
            this.socket.send(msg);
        }
    }
}
