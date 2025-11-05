import { IModule } from "../../src/module/IModule";
import { ModuleContext } from "../../src/module/ModuleContext";
import { RoomManager } from "./RoomManager";
import { EntityManager } from "./EntityManager";

export default class RoomModule implements IModule {
    name = "rooms";
    version = "1.0.0";
    description = "Room system with support for text-based and 2D positioned gameplay";
    
    private roomManager!: RoomManager;
    private entityManager!: EntityManager;
    
    async initialize(context: ModuleContext) {
        this.roomManager = new RoomManager(context);
        this.entityManager = new EntityManager(context);

        // Load room data
        context.data.registerLoader("rooms", {
            load: (data, filePath) => this.roomManager.loadRooms(filePath)
        });

        // Load NPC data
        context.data.registerLoader("npcs", {
            load: (data, filePath) => this.entityManager.loadNPCs(filePath)
        });

        // Load mob data
        context.data.registerLoader("mobs", {
            load: (data, filePath) => this.entityManager.loadMobs(filePath)
        });
    }

    // Public API for other modules
    getRoomManager() {
        return this.roomManager;
    }

    getEntityManager() {
        return this.entityManager;
    }
    
    async activate(context: ModuleContext) {
        // Commands and requests are loaded automatically by ModuleManager

        // Setup event listeners
        context.events.on("playerConnect", (player) => {
            this.roomManager.handlePlayerConnect(player);
        });

        context.events.on("playerDisconnect", (player) => {
            this.roomManager.handlePlayerDisconnect(player);
        });
    }
    
    async deactivate(context: ModuleContext) {
        // Cleanup
        this.roomManager.cleanup();
        this.entityManager.cleanup();
    }
}