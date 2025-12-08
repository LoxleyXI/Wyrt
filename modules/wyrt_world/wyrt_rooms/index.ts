/**
 * @module wyrt_rooms
 * @description Room and zone management for multiplayer game worlds
 * @category World
 *
 * @features
 * - Room-based player grouping
 * - Support for text-based and 2D positioned games
 * - Room capacity limits
 * - Player presence tracking
 * - Room-scoped message broadcasting
 * - Entity management per room
 *
 * @usage
 * ```typescript
 * // In your game module's initialize():
 * const roomsModule = context.getModule('wyrt_rooms');
 * this.roomManager = roomsModule.createRoomManager('my_game');
 *
 * // Create a room
 * this.roomManager.createRoom('tavern', { maxPlayers: 50 });
 *
 * // Move player to room
 * this.roomManager.joinRoom(playerId, 'tavern');
 *
 * // Broadcast to room
 * this.roomManager.broadcast('tavern', { type: 'npc_spawn', data: npc });
 *
 * // Get players in room
 * const players = this.roomManager.getPlayersInRoom('tavern');
 * ```
 *
 * @exports RoomManager - Room management class
 * @exports EntityManager - Entity tracking per room
 */

import { IModule } from "../../../src/module/IModule";
import { ModuleContext } from "../../../src/module/ModuleContext";
import { RoomManager } from "./RoomManager";
import { EntityManager } from "./EntityManager";

export default class RoomModule implements IModule {
    name = "wyrt_rooms";
    version = "1.0.0";
    description = "Room system with support for text-based and 2D positioned gameplay";
    dependencies = [];

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
