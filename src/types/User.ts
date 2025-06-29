import { GameState } from "./GameState";
import { Menu } from "./Menu";
import { MessageType } from "./MessageType";

export class User {
    id: number;
    player: any;
    socket: any;
    log: string[];
    state: GameState;
    menu: Menu;
    clientIP: string;
    connectionTime: number;

    constructor(socket: any, id: number) {
        this.id = id;
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
        return this.player.authenticated === true;
    }

    hasPrivilege(level: number): boolean {
        return this.isAuthenticated() && this.player.gmlv >= level;
    }
}
