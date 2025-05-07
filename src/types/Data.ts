import { User } from "./User";

export class Data {
    users: User[] = new Array();
    items: Record<string, any>;
    counter: number = 0;
    battle: any; // TODO: Implement Battle type

    constructor() { }
};
