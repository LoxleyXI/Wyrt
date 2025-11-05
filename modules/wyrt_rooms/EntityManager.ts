import { ModuleContext } from "../../src/module/ModuleContext";
import { Entity, EntityType, AIBehavior, AIType, LootTable, DialogueTree, EntityStats, Position2D, Position3D } from "./types";
import * as fs from "fs";
import * as yaml from "js-yaml";
import * as path from "path";

export class EntityManager {
    private entities: Map<string, Entity> = new Map();
    private entityTemplates: Map<string, any> = new Map();
    private context: ModuleContext;
    private aiUpdateInterval: NodeJS.Timeout | null = null;
    
    constructor(context: ModuleContext) {
        this.context = context;
        this.startAILoop();
    }
    
    loadNPCs(filePath: string): boolean {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = yaml.load(content) as Record<string, any>;
            
            for (const [npcId, npcData] of Object.entries(data)) {
                this.entityTemplates.set(npcId, {
                    ...npcData,
                    type: EntityType.NPC
                });
            }
            
            this.context.logger.info(`Loaded ${Object.keys(data).length} NPC templates from ${path.basename(filePath)}`);
            return true;
        } catch (error) {
            this.context.logger.error(`Failed to load NPCs from ${filePath}:`, error);
            return false;
        }
    }
    
    loadMobs(filePath: string): boolean {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = yaml.load(content) as Record<string, any>;
            
            for (const [mobId, mobData] of Object.entries(data)) {
                this.entityTemplates.set(mobId, {
                    ...mobData,
                    type: EntityType.MOB
                });
            }
            
            this.context.logger.info(`Loaded ${Object.keys(data).length} mob templates from ${path.basename(filePath)}`);
            return true;
        } catch (error) {
            this.context.logger.error(`Failed to load mobs from ${filePath}:`, error);
            return false;
        }
    }
    
    spawnEntity(templateId: string, roomId: string, position?: Position2D | Position3D): Entity | null {
        const template = this.entityTemplates.get(templateId);
        if (!template) {
            this.context.logger.warn(`Entity template not found: ${templateId}`);
            return null;
        }
        
        const entityId = `${templateId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const entity: Entity = {
            id: entityId,
            name: template.name || templateId,
            type: template.type || EntityType.MOB,
            level: this.calculateLevel(template),
            position: position,
            room: roomId,
            hp: this.calculateHP(template),
            mp: template.mp ? [template.mp, template.mp] : undefined,
            stats: this.calculateStats(template),
            behavior: this.createBehavior(template),
            dialogue: template.dialogue,
            loot: this.createLootTable(template),
            respawnTime: template.respawn ? template.respawn * 1000 : undefined,
            effects: {},
            skills: template.skills || []
        };
        
        this.entities.set(entityId, entity);
        
        // Add entity to room
        const roomManager = this.context.modules.get("roomManager");
        if (roomManager) {
            roomManager.addEntityToRoom(entity, roomId);
        }
        
        return entity;
    }
    
    private calculateLevel(template: any): number {
        if (template.level) return template.level;
        if (template.min && template.max) {
            return Math.floor(Math.random() * (template.max - template.min + 1)) + template.min;
        }
        return 1;
    }
    
    private calculateHP(template: any): [number, number] {
        if (template.hp) return [template.hp, template.hp];
        if (template.mods?.setHP) return [template.mods.setHP, template.mods.setHP];
        
        const level = this.calculateLevel(template);
        const baseHP = 50 + (level * 10);
        return [baseHP, baseHP];
    }
    
    private calculateStats(template: any): EntityStats {
        const level = this.calculateLevel(template);
        const baseStats = {
            strength: 10 + level * 2,
            dexterity: 10 + level * 2,
            intelligence: 10 + level * 2,
            defense: 5 + level,
            agility: 10 + level
        };
        
        // Apply template modifiers
        if (template.stats) {
            Object.assign(baseStats, template.stats);
        }
        
        return baseStats;
    }
    
    private createBehavior(template: any): AIBehavior {
        const behavior: AIBehavior = {
            type: template.aggressive ? AIType.AGGRESSIVE : AIType.PASSIVE,
            aggroRange: template.aggroRange || 5,
            wanderRadius: template.wanderRadius || 3,
            fleeHealthPercent: template.fleeAt || 0
        };
        
        if (template.patrol) {
            behavior.type = AIType.PATROL;
            behavior.patrolPath = template.patrol;
        }
        
        return behavior;
    }
    
    private createLootTable(template: any): LootTable | undefined {
        if (!template.items) return undefined;
        
        const lootTable: LootTable = {
            items: [],
            experience: template.exp || this.calculateLevel(template) * 10
        };
        
        for (const item of template.items) {
            if (Array.isArray(item) && item.length === 2) {
                lootTable.items.push({
                    itemId: item[1],
                    chance: item[0],
                    quantity: [1, 1]
                });
            }
        }
        
        if (template.gold) {
            lootTable.gold = Array.isArray(template.gold) ? template.gold : [template.gold, template.gold];
        }
        
        return lootTable;
    }
    
    getEntity(entityId: string): Entity | undefined {
        return this.entities.get(entityId);
    }
    
    removeEntity(entityId: string): boolean {
        const entity = this.entities.get(entityId);
        if (!entity) return false;
        
        // Remove from room
        const roomManager = this.context.modules.get("roomManager");
        if (roomManager) {
            roomManager.removeEntityFromRoom(entityId, entity.room);
        }
        
        // Schedule respawn if applicable
        if (entity.respawnTime) {
            setTimeout(() => {
                this.respawnEntity(entity);
            }, entity.respawnTime);
        }
        
        this.entities.delete(entityId);
        return true;
    }
    
    private respawnEntity(oldEntity: Entity) {
        // Find template ID from entity name
        const templateId = oldEntity.name.replace(/ /g, "_");
        this.spawnEntity(templateId, oldEntity.room, oldEntity.position);
    }
    
    damageEntity(entityId: string, damage: number): boolean {
        const entity = this.entities.get(entityId);
        if (!entity) return false;
        
        entity.hp[0] = Math.max(0, entity.hp[0] - damage);
        
        // Broadcast damage
        const roomManager = this.context.modules.get("roomManager");
        if (roomManager) {
            roomManager.broadcastToRoom(entity.room, {
                type: "entityDamage",
                entityId: entityId,
                damage: damage,
                currentHP: entity.hp[0],
                maxHP: entity.hp[1]
            });
        }
        
        // Check if entity died
        if (entity.hp[0] <= 0) {
            this.handleEntityDeath(entity);
        }
        
        return true;
    }
    
    private handleEntityDeath(entity: Entity) {
        // Drop loot
        if (entity.loot) {
            this.dropLoot(entity);
        }
        
        // Award experience to players who damaged it
        // TODO: Track damage dealers
        
        // Broadcast death
        const roomManager = this.context.modules.get("roomManager");
        if (roomManager) {
            roomManager.broadcastToRoom(entity.room, {
                type: "entityDeath",
                entityId: entity.id,
                entityName: entity.name
            });
        }
        
        // Remove entity
        this.removeEntity(entity.id);
    }
    
    private dropLoot(entity: Entity) {
        if (!entity.loot) return;
        
        const drops: any[] = [];
        
        // Roll for items
        for (const lootItem of entity.loot.items) {
            if (Math.random() * 100 <= lootItem.chance) {
                const quantity = Math.floor(Math.random() * 
                    (lootItem.quantity[1] - lootItem.quantity[0] + 1)) + lootItem.quantity[0];
                drops.push({
                    itemId: lootItem.itemId,
                    quantity: quantity
                });
            }
        }
        
        // Roll for gold
        if (entity.loot.gold) {
            const gold = Math.floor(Math.random() * 
                (entity.loot.gold[1] - entity.loot.gold[0] + 1)) + entity.loot.gold[0];
            if (gold > 0) {
                drops.push({
                    itemId: "gold",
                    quantity: gold
                });
            }
        }
        
        // Broadcast loot drop
        if (drops.length > 0) {
            const roomManager = this.context.modules.get("roomManager");
            if (roomManager) {
                roomManager.broadcastToRoom(entity.room, {
                    type: "lootDrop",
                    position: entity.position,
                    items: drops
                });
            }
        }
    }
    
    private startAILoop() {
        this.aiUpdateInterval = setInterval(() => {
            this.updateAI();
        }, 1000); // Update AI every second
    }
    
    private updateAI() {
        for (const entity of this.entities.values()) {
            if (entity.behavior) {
                this.processAI(entity);
            }
        }
    }
    
    private processAI(entity: Entity) {
        if (!entity.behavior) return;
        
        const roomManager = this.context.modules.get("roomManager");
        if (!roomManager) return;
        
        const room = roomManager.getRoom(entity.room);
        if (!room) return;
        
        switch (entity.behavior.type) {
            case AIType.AGGRESSIVE:
                this.processAggressiveAI(entity, room, roomManager);
                break;
            case AIType.WANDER:
                this.processWanderAI(entity, room, roomManager);
                break;
            case AIType.PATROL:
                this.processPatrolAI(entity, room, roomManager);
                break;
        }
    }
    
    private processAggressiveAI(entity: Entity, room: any, roomManager: any) {
        // Check for nearby players to attack
        if (!entity.target && entity.position && entity.behavior?.aggroRange) {
            const nearbyPlayers = room.players.filter((player: any) => {
                if (!player.position) return false;
                const distance = this.calculateDistance(entity.position!, player.position);
                return distance <= entity.behavior!.aggroRange!;
            });
            
            if (nearbyPlayers.length > 0) {
                // Target the closest player
                entity.target = nearbyPlayers[0].id;
                roomManager.broadcastToRoom(entity.room, {
                    type: "entityAggro",
                    entityId: entity.id,
                    targetId: entity.target
                });
            }
        }
        
        // Move towards target
        if (entity.target && entity.position) {
            const targetPlayer = room.players.find((p: any) => p.id === entity.target);
            if (targetPlayer && targetPlayer.position) {
                this.moveTowards(entity, targetPlayer.position, roomManager);
            }
        }
    }
    
    private processWanderAI(entity: Entity, room: any, roomManager: any) {
        if (!entity.position || !entity.behavior?.wanderRadius) return;
        
        // Random chance to wander
        if (Math.random() < 0.1) { // 10% chance per update
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * entity.behavior.wanderRadius;
            
            const newPosition: Position2D = {
                x: entity.position.x + Math.cos(angle) * distance,
                y: entity.position.y + Math.sin(angle) * distance
            };
            
            roomManager.updateEntityPosition(entity.id, entity.room, newPosition);
        }
    }
    
    private processPatrolAI(entity: Entity, room: any, roomManager: any) {
        // TODO: Implement patrol path following
    }
    
    private moveTowards(entity: Entity, target: Position2D | Position3D, roomManager: any) {
        if (!entity.position) return;
        
        const dx = target.x - entity.position.x;
        const dy = target.y - entity.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 1) {
            const moveSpeed = 2; // Units per update
            const moveX = (dx / distance) * Math.min(moveSpeed, distance);
            const moveY = (dy / distance) * Math.min(moveSpeed, distance);
            
            const newPosition: Position2D = {
                x: entity.position.x + moveX,
                y: entity.position.y + moveY
            };
            
            roomManager.updateEntityPosition(entity.id, entity.room, newPosition);
        }
    }
    
    private calculateDistance(pos1: Position2D | Position3D, pos2: Position2D | Position3D): number {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    cleanup() {
        if (this.aiUpdateInterval) {
            clearInterval(this.aiUpdateInterval);
            this.aiUpdateInterval = null;
        }
        this.entities.clear();
        this.entityTemplates.clear();
    }
}