import { IModule } from "../../src/module/IModule";
import { ModuleContext } from "../../src/module/ModuleContext";
import { RoomManager } from "./RoomManager";
import { EntityManager } from "./EntityManager";

export default class RoomModule implements IModule {
    name = "rooms";
    version = "1.0.0";
    description = "Room system with support for text-based and 2D positioned gameplay";

    private context?: ModuleContext;
    private roomManagers: Map<string, RoomManager> = new Map();
    private entityManagers: Map<string, EntityManager> = new Map();

    async initialize(context: ModuleContext) {
        this.context = context;
        console.log(`[${this.name}] Initialized`);
    }

    createRoomManager(gameId: string): RoomManager {
        if (this.roomManagers.has(gameId)) {
            throw new Error(`RoomManager for game '${gameId}' already exists`);
        }
        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const manager = new RoomManager(this.context);
        this.roomManagers.set(gameId, manager);
        console.log(`[${this.name}] Created room manager for game: ${gameId}`);
        return manager;
    }

    getRoomManager(gameId: string): RoomManager {
        const manager = this.roomManagers.get(gameId);
        if (!manager) {
            throw new Error(`RoomManager for game '${gameId}' not found. Did you call createRoomManager()?`);
        }
        return manager;
    }

    createEntityManager(gameId: string): EntityManager {
        if (this.entityManagers.has(gameId)) {
            throw new Error(`EntityManager for game '${gameId}' already exists`);
        }
        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const manager = new EntityManager(this.context);
        this.entityManagers.set(gameId, manager);
        console.log(`[${this.name}] Created entity manager for game: ${gameId}`);
        return manager;
    }

    getEntityManager(gameId: string): EntityManager {
        const manager = this.entityManagers.get(gameId);
        if (!manager) {
            throw new Error(`EntityManager for game '${gameId}' not found. Did you call createEntityManager()?`);
        }
        return manager;
    }
    
    async activate(context: ModuleContext) {
        console.log(`[${this.name}] Module activated`);
    }

    async deactivate(context: ModuleContext) {
        for (const manager of this.roomManagers.values()) {
            manager.cleanup();
        }
        for (const manager of this.entityManagers.values()) {
            manager.cleanup();
        }
        this.roomManagers.clear();
        this.entityManagers.clear();
        console.log(`[${this.name}] Module deactivated`);
    }
}