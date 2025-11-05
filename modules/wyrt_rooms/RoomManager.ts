import { ModuleContext } from "../../src/module/ModuleContext";
import { Room, Player, Entity, Position2D, Position3D, PositionType } from "./types";
import * as fs from "fs";
import * as yaml from "js-yaml";
import * as path from "path";

export class RoomManager {
    private rooms: Map<string, Room> = new Map();
    private playerRooms: Map<string, string> = new Map(); // playerId -> roomId
    private context: ModuleContext;
    
    constructor(context: ModuleContext) {
        this.context = context;
    }
    
    loadRooms(filePath: string): boolean {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = yaml.load(content) as Record<string, any>;
            
            for (const [roomId, roomData] of Object.entries(data)) {
                const room: Room = {
                    id: roomId,
                    name: roomData.name || roomId,
                    description: roomData.desc || roomData.description || "",
                    region: roomData.region,
                    positionType: this.determinePositionType(roomData),
                    dimensions: roomData.dimensions,
                    exits: roomData.exit || roomData.exits,
                    tiles: roomData.tiles,
                    npcs: [],
                    mobs: [],
                    players: [],
                    items: [],
                    respawnPoints: roomData.respawnPoints
                };
                
                this.rooms.set(roomId, room);
            }
            
            this.context.logger.info(`Loaded ${this.rooms.size} rooms from ${path.basename(filePath)}`);
            return true;
        } catch (error) {
            this.context.logger.error(`Failed to load rooms from ${filePath}:`, error);
            return false;
        }
    }
    
    private determinePositionType(roomData: any): PositionType {
        if (roomData.tiles || roomData.dimensions) {
            return roomData.dimensions?.depth ? "3d" : "2d";
        }
        return "none";
    }
    
    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }
    
    getAllRooms(): Room[] {
        return Array.from(this.rooms.values());
    }
    
    movePlayer(player: Player, targetRoomId: string, position?: Position2D | Position3D): boolean {
        const currentRoom = this.getPlayerRoom(player.id);
        const targetRoom = this.rooms.get(targetRoomId);
        
        if (!targetRoom) {
            return false;
        }
        
        // Remove from current room
        if (currentRoom) {
            const index = currentRoom.players.findIndex(p => p.id === player.id);
            if (index !== -1) {
                currentRoom.players.splice(index, 1);
            }
            
            // Broadcast exit message
            this.broadcastToRoom(currentRoom.id, {
                type: "playerExit",
                playerId: player.id,
                playerName: player.name
            }, player.id);
        }
        
        // Add to target room
        player.room = targetRoomId;
        if (position && targetRoom.positionType !== "none") {
            player.position = position;
        }
        targetRoom.players.push(player);
        this.playerRooms.set(player.id, targetRoomId);
        
        // Broadcast enter message
        this.broadcastToRoom(targetRoomId, {
            type: "playerEnter",
            playerId: player.id,
            playerName: player.name,
            position: player.position
        }, player.id);
        
        return true;
    }
    
    getPlayerRoom(playerId: string): Room | undefined {
        const roomId = this.playerRooms.get(playerId);
        return roomId ? this.rooms.get(roomId) : undefined;
    }
    
    addEntityToRoom(entity: Entity, roomId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) return false;
        
        entity.room = roomId;
        
        if (entity.type === "npc") {
            room.npcs.push(entity);
        } else {
            room.mobs.push(entity);
        }
        
        // Broadcast entity spawn
        this.broadcastToRoom(roomId, {
            type: "entitySpawn",
            entity: entity
        });
        
        return true;
    }
    
    removeEntityFromRoom(entityId: string, roomId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) return false;
        
        // Check NPCs
        let index = room.npcs.findIndex(e => e.id === entityId);
        if (index !== -1) {
            room.npcs.splice(index, 1);
            this.broadcastToRoom(roomId, {
                type: "entityRemove",
                entityId: entityId
            });
            return true;
        }
        
        // Check mobs
        index = room.mobs.findIndex(e => e.id === entityId);
        if (index !== -1) {
            room.mobs.splice(index, 1);
            this.broadcastToRoom(roomId, {
                type: "entityRemove",
                entityId: entityId
            });
            return true;
        }
        
        return false;
    }
    
    updateEntityPosition(entityId: string, roomId: string, position: Position2D | Position3D): boolean {
        const room = this.rooms.get(roomId);
        if (!room || room.positionType === "none") return false;
        
        const entity = [...room.npcs, ...room.mobs].find(e => e.id === entityId);
        if (!entity) return false;
        
        entity.position = position;
        
        // Broadcast position update
        this.broadcastToRoom(roomId, {
            type: "entityMove",
            entityId: entityId,
            position: position
        });
        
        return true;
    }
    
    broadcastToRoom(roomId: string, message: any, excludePlayerId?: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        for (const player of room.players) {
            if (player.id !== excludePlayerId) {
                this.context.events.emit("sendToPlayer", {
                    playerId: player.id,
                    message: message
                });
            }
        }
    }
    
    getNearbyEntities(roomId: string, position: Position2D | Position3D, range: number): Entity[] {
        const room = this.rooms.get(roomId);
        if (!room || room.positionType === "none") return [];
        
        const entities: Entity[] = [];
        const allEntities = [...room.npcs, ...room.mobs];
        
        for (const entity of allEntities) {
            if (entity.position && this.calculateDistance(position, entity.position) <= range) {
                entities.push(entity);
            }
        }
        
        return entities;
    }
    
    private calculateDistance(pos1: Position2D | Position3D, pos2: Position2D | Position3D): number {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        
        if ('z' in pos1 && 'z' in pos2) {
            const dz = (pos1 as Position3D).z - (pos2 as Position3D).z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    getRoomDescription(room: Room, player: Player): string {
        let description = `${room.name}\n${room.description}\n`;
        
        if (room.exits) {
            const exitList = Object.entries(room.exits)
                .map(([dir, roomId]) => `${dir.toUpperCase()}: ${this.rooms.get(roomId)?.name || roomId}`)
                .join(", ");
            description += `\nExits: ${exitList}\n`;
        }
        
        if (room.npcs.length > 0) {
            description += `\nNPCs: ${room.npcs.map(n => n.name).join(", ")}\n`;
        }
        
        if (room.mobs.length > 0) {
            description += `\nCreatures: ${room.mobs.map(m => `${m.name} (Lv${m.level})`).join(", ")}\n`;
        }
        
        const otherPlayers = room.players.filter(p => p.id !== player.id);
        if (otherPlayers.length > 0) {
            description += `\nPlayers: ${otherPlayers.map(p => p.name).join(", ")}\n`;
        }
        
        return description;
    }
    
    handlePlayerConnect(player: Player) {
        // Place player in their saved room or starting room
        const startingRoom = player.room || "starting_room";
        this.movePlayer(player, startingRoom);
    }
    
    handlePlayerDisconnect(player: Player) {
        const room = this.getPlayerRoom(player.id);
        if (room) {
            const index = room.players.findIndex(p => p.id === player.id);
            if (index !== -1) {
                room.players.splice(index, 1);
            }
            this.playerRooms.delete(player.id);
            
            // Broadcast disconnect
            this.broadcastToRoom(room.id, {
                type: "playerDisconnect",
                playerId: player.id,
                playerName: player.name
            });
        }
    }
    
    cleanup() {
        this.rooms.clear();
        this.playerRooms.clear();
    }
}