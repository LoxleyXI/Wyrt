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

    constructor(socket: any, id: number) {
        this.id = id;
        this.player = {};
        this.socket = socket;
        this.log = [];

        console.log("+ connection (web)");
    }

    output(msg: string, type: MessageType) {
        this.socket.send(JSON.stringify({
            type: type,
            time: new Date().valueOf(),
            msg: msg,
        }));
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
};
