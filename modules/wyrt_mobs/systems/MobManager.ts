/**
 * Generic Mob Manager
 *
 * Manages NPC/enemy lifecycle for any Wyrt game:
 * - Spawning and respawning
 * - Health and combat state
 * - AI (roaming, chasing, aggro)
 * - Position tracking
 * - Health regeneration
 *
 * Game modules provide:
 * - Mob templates (via constructor)
 * - Event callbacks for broadcasting
 */

import { ModuleContext } from '../../../src/module/ModuleContext';
import { MobInstance, MobTemplate, MobSpawn, MobEventCallbacks, MobBroadcastData } from '../types/Mob';
import { Position, Direction } from '../../wyrt_2d/types/Position2D';
import { PositionManager } from '../../wyrt_2d/systems/PositionManager';

export class MobManager {
    private mobInstances: Map<string, MobInstance> = new Map();
    private roomMobs: Map<string, Set<string>> = new Map(); // roomPath -> Set<mobId>
    private mobTemplates: Map<string, MobTemplate> = new Map();
    private context: ModuleContext;
    private callbacks: MobEventCallbacks;

    private respawnInterval: NodeJS.Timeout | null = null;
    private aiInterval: NodeJS.Timeout | null = null;

    constructor(context: ModuleContext, templates: Record<string, MobTemplate>, callbacks: MobEventCallbacks = {}) {
        this.context = context;
        this.callbacks = callbacks;

        // Load templates into Map
        for (const [id, template] of Object.entries(templates)) {
            this.mobTemplates.set(id, { ...template, id });
        }

        this.context.logger.info(`[MobManager] Loaded ${this.mobTemplates.size} mob templates`);
    }

    /**
     * Clear all mobs in a room (for hot-reload or cleanup)
     */
    clearRoomMobs(zone: string, room: string): void {
        const roomPath = `${zone}:${room}`;
        const mobSet = this.roomMobs.get(roomPath);

        if (mobSet) {
            for (const mobId of mobSet) {
                this.mobInstances.delete(mobId);
            }
            mobSet.clear();
        }
    }

    /**
     * Start respawn timer (checks every 10 seconds)
     */
    startRespawnTimer(): void {
        if (this.respawnInterval) {
            clearInterval(this.respawnInterval);
        }

        this.respawnInterval = setInterval(() => {
            this.checkRespawns();
        }, 10000);
    }

    /**
     * Stop respawn timer
     */
    stopRespawnTimer(): void {
        if (this.respawnInterval) {
            clearInterval(this.respawnInterval);
            this.respawnInterval = null;
        }
    }

    /**
     * Spawn mobs in a room from spawn data
     */
    spawnMobsInRoom(zone: string, room: string, mobSpawns: (string | MobSpawn)[]): void {
        if (!mobSpawns || !Array.isArray(mobSpawns)) return;

        const roomPath = `${zone}:${room}`;
        const spawnedMobs: string[] = [];

        for (const mobSpawn of mobSpawns) {
            let templateId: string;
            let spawnX: number | undefined;
            let spawnY: number | undefined;
            let levelOverride: number | undefined;

            if (typeof mobSpawn === 'string') {
                // Simple format: just the mob template ID
                templateId = mobSpawn;
            } else {
                // Full format: { id, x, y, level }
                templateId = mobSpawn.id;
                spawnX = mobSpawn.x;
                spawnY = mobSpawn.y;
                levelOverride = mobSpawn.level;
            }

            // Get template to validate
            const template = this.mobTemplates.get(templateId);
            if (!template) {
                this.context.logger.warn(`[MobManager] Template not found: ${templateId}`);
                continue;
            }

            // Spawn the mob
            const mob = this.spawnMob(templateId, zone, room, true, spawnX, spawnY, levelOverride);
            if (mob) {
                const levelStr = `Lv${mob.level}`;
                const posStr = mob.position ? ` @(${Math.round(mob.position.x)},${Math.round(mob.position.y)})` : '';
                spawnedMobs.push(`${mob.name} ${levelStr}${posStr}`);
            }
        }

        // Log all spawned mobs for this room
        if (spawnedMobs.length > 0) {
            this.context.logger.debug(`[MobManager] ${roomPath}: ${spawnedMobs.join(', ')}`);
        }
    }

    /**
     * Spawn a single mob
     */
    spawnMob(
        templateId: string,
        zone: string,
        room: string,
        silent: boolean = false,
        x?: number,
        y?: number,
        levelOverride?: number
    ): MobInstance | null {
        const template = this.mobTemplates.get(templateId);
        if (!template) {
            this.context.logger.warn(`[MobManager] Template not found: ${templateId}`);
            return null;
        }

        const instanceId = `${templateId}_${Date.now()}_${Math.random()}`;

        // Determine level
        let level = 1;
        if (levelOverride !== undefined) {
            level = levelOverride;
        } else if (template.min && template.max) {
            level = Math.floor(Math.random() * (template.max - template.min + 1)) + template.min;
        } else if (template.min) {
            level = template.min;
        } else if (template.level) {
            level = template.level;
        }

        // Calculate HP
        const baseHp = template.baseHp || 10;
        const hpPerLevel = template.hpPerLevel || 0;
        const maxHp = baseHp + (level - 1) * hpPerLevel;

        // Determine position
        const position = (x !== undefined && y !== undefined)
            ? { x, y }
            : template.spawnPositions && template.spawnPositions.length > 0
                ? template.spawnPositions[Math.floor(Math.random() * template.spawnPositions.length)]
                : { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 };

        // Create instance
        const instance: MobInstance = {
            id: instanceId,
            templateId,
            name: template.name || templateId,
            level,
            hp: maxHp,
            maxHp,
            zone,
            room,
            respawnTime: template.respawn || 60,
            stats: {
                str: (template.stats?.str || 10) + Math.floor(level / 2),
                dex: (template.stats?.dex || 10) + Math.floor(level / 2),
                con: (template.stats?.con || 10) + Math.floor(level / 2),
                int: (template.stats?.int || 10) + Math.floor(level / 2),
                wis: (template.stats?.wis || 10) + Math.floor(level / 2),
                cha: (template.stats?.cha || 10) + Math.floor(level / 2)
            },
            hostileToPlayers: new Set(),
            target: null,
            lastCombatTime: 0,
            position,
            direction: "down"
        };

        this.mobInstances.set(instanceId, instance);

        // Track in room
        const roomPath = `${zone}:${room}`;
        if (!this.roomMobs.has(roomPath)) {
            this.roomMobs.set(roomPath, new Set());
        }
        this.roomMobs.get(roomPath)!.add(instanceId);

        if (!silent) {
            this.context.logger.debug(`[MobManager] Spawned ${instance.name} (Lv${level}) in ${roomPath}`);
        }

        // Callback
        if (this.callbacks.onMobSpawned) {
            this.callbacks.onMobSpawned(instance);
        }

        return instance;
    }

    /**
     * Kill a mob (marks for respawn)
     */
    killMob(mobId: string, killerId?: string): void {
        const mob = this.mobInstances.get(mobId);
        if (!mob) return;

        mob.lastKilled = Date.now();
        mob.hp = 0;

        // Remove from room
        const roomPath = `${mob.zone}:${mob.room}`;
        const roomMobSet = this.roomMobs.get(roomPath);
        if (roomMobSet) {
            roomMobSet.delete(mobId);
        }

        this.context.logger.debug(`[MobManager] ${mob.name} killed, will respawn in ${mob.respawnTime}s`);

        // Callback
        if (this.callbacks.onMobKilled) {
            this.callbacks.onMobKilled(mob, killerId);
        }
    }

    /**
     * Check for mobs that need to respawn
     */
    checkRespawns(): void {
        const now = Date.now();

        for (const [mobId, mob] of this.mobInstances) {
            if (mob.hp <= 0 && mob.lastKilled) {
                const timeSinceDeath = (now - mob.lastKilled) / 1000;

                if (timeSinceDeath >= mob.respawnTime) {
                    this.respawnMob(mobId);
                }
            }
        }
    }

    /**
     * Respawn a mob
     */
    respawnMob(mobId: string): void {
        const mob = this.mobInstances.get(mobId);
        if (!mob) return;

        // Reset HP
        mob.hp = mob.maxHp;
        mob.lastKilled = undefined;
        mob.hostileToPlayers.clear();
        mob.target = null;

        // Add back to room
        const roomPath = `${mob.zone}:${mob.room}`;
        if (!this.roomMobs.has(roomPath)) {
            this.roomMobs.set(roomPath, new Set());
        }
        this.roomMobs.get(roomPath)!.add(mobId);

        this.context.logger.debug(`[MobManager] ${mob.name} respawned in ${roomPath}`);

        // Callback
        if (this.callbacks.onMobRespawned) {
            this.callbacks.onMobRespawned(mob);
        }
    }

    /**
     * Get all alive mobs in a room
     */
    getMobsInRoom(zone: string, room: string): MobInstance[] {
        const roomPath = `${zone}:${room}`;
        const mobSet = this.roomMobs.get(roomPath);

        if (!mobSet) return [];

        const mobs: MobInstance[] = [];
        for (const mobId of mobSet) {
            const mob = this.mobInstances.get(mobId);
            if (mob && mob.hp > 0) {
                mobs.push(mob);
            }
        }

        return mobs;
    }

    /**
     * Get a mob by ID
     */
    getMob(mobId: string): MobInstance | undefined {
        return this.mobInstances.get(mobId);
    }

    /**
     * Damage a mob (returns true if mob died)
     */
    damageMob(mobId: string, damage: number, attackerId: string): boolean {
        const mob = this.mobInstances.get(mobId);
        if (!mob || mob.hp <= 0) return false;

        // Apply damage
        const actualDamage = Math.min(damage, mob.hp);
        mob.hp -= actualDamage;
        mob.lastCombatTime = Date.now();

        // Make mob hostile to attacker
        mob.hostileToPlayers.add(attackerId);
        if (!mob.target) {
            mob.target = attackerId;
        }

        this.context.logger.debug(`[MobManager] ${mob.name} took ${actualDamage} damage from ${attackerId} (${mob.hp}/${mob.maxHp})`);

        // Broadcast update
        this.broadcastMobUpdate(mob);

        // Check if mob died
        if (mob.hp <= 0) {
            this.killMob(mobId, attackerId);
            return true;
        }

        return false;
    }

    /**
     * Broadcast mob update to room
     */
    broadcastMobUpdate(mob: MobInstance): void {
        if (!this.callbacks.onBroadcastToRoom) return;

        const roomPath = `${mob.zone}:${mob.room}`;
        const data: MobBroadcastData = {
            id: mob.id,
            name: mob.name,
            level: mob.level,
            hp: mob.hp,
            maxHp: mob.maxHp,
            position: mob.position,
            direction: mob.direction,
            isHostile: mob.hostileToPlayers.size > 0
        };

        this.callbacks.onBroadcastToRoom(roomPath, {
            type: 'mobUpdate',
            mob: data
        });

        // Callback
        if (this.callbacks.onMobUpdate) {
            this.callbacks.onMobUpdate(mob);
        }
    }

    /**
     * Broadcast mob movement to room
     */
    broadcastMobMovement(mob: MobInstance): void {
        if (!this.callbacks.onBroadcastToRoom) return;

        const roomPath = `${mob.zone}:${mob.room}`;
        this.callbacks.onBroadcastToRoom(roomPath, {
            type: 'mobMoved',
            mob: {
                id: mob.id,
                position: mob.position,
                direction: mob.direction
            }
        });

        // Callback
        if (this.callbacks.onMobMoved) {
            this.callbacks.onMobMoved(mob);
        }
    }

    /**
     * Process mob health regeneration
     */
    processMobRegeneration(): void {
        const now = Date.now();
        const regenDelay = 5000; // 5 seconds out of combat
        const regenRate = 10; // HP per second

        for (const [mobId, mob] of this.mobInstances) {
            if (mob.hp <= 0) continue;
            if (mob.hp >= mob.maxHp) continue;

            const timeSinceCombat = now - mob.lastCombatTime;

            if (timeSinceCombat >= regenDelay) {
                const oldHp = mob.hp;
                mob.hp = Math.min(mob.maxHp, mob.hp + regenRate);

                if (mob.hp !== oldHp) {
                    this.broadcastMobUpdate(mob);

                    // Clear hostility when fully healed
                    if (mob.hp >= mob.maxHp) {
                        mob.hostileToPlayers.clear();
                        mob.target = null;
                    }
                }
            }
        }
    }

    /**
     * Process mob movement (chase or roam)
     *
     * Requires getPlayerPosition callback to be provided for chase behavior
     */
    processMobMovement(getPlayerPosition?: (playerId: string, roomPath: string) => Position | null): void {
        const moveChance = 0.1; // 10% chance to move per tick
        const roamDistance = 20;
        const chaseSpeed = 30;
        const chaseRange = 600;

        for (const [mobId, mob] of this.mobInstances) {
            if (mob.hp <= 0) continue;

            // Ensure mob has position
            if (!mob.position) {
                mob.position = { x: Math.random() * 800, y: Math.random() * 600 };
            }

            // Chase target if hostile and getPlayerPosition is provided
            if (mob.target && mob.hostileToPlayers.size > 0 && getPlayerPosition) {
                const roomPath = `${mob.zone}:${mob.room}`;
                const playerPos = getPlayerPosition(mob.target, roomPath);

                if (playerPos) {
                    const dx = playerPos.x - mob.position.x;
                    const dy = playerPos.y - mob.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < chaseRange && distance > 10) {
                        // Move towards player
                        const moveX = (dx / distance) * chaseSpeed;
                        const moveY = (dy / distance) * chaseSpeed;

                        mob.position.x = Math.max(50, Math.min(750, mob.position.x + moveX));
                        mob.position.y = Math.max(50, Math.min(550, mob.position.y + moveY));

                        // Update direction
                        if (Math.abs(moveX) > Math.abs(moveY)) {
                            mob.direction = moveX > 0 ? "right" : "left";
                        } else {
                            mob.direction = moveY > 0 ? "down" : "up";
                        }

                        this.broadcastMobMovement(mob);
                        continue;
                    }
                }
            }

            // Random roaming
            if (Math.random() < moveChance) {
                const angle = Math.random() * Math.PI * 2;
                const moveX = Math.cos(angle) * roamDistance;
                const moveY = Math.sin(angle) * roamDistance;

                mob.position.x = Math.max(100, Math.min(700, mob.position.x + moveX));
                mob.position.y = Math.max(100, Math.min(500, mob.position.y + moveY));

                // Update direction
                if (Math.abs(moveX) > Math.abs(moveY)) {
                    mob.direction = moveX > 0 ? "right" : "left";
                } else {
                    mob.direction = moveY > 0 ? "down" : "up";
                }

                this.broadcastMobMovement(mob);
            }
        }
    }

    /**
     * Process mob AI (regeneration and movement)
     */
    processMobAI(getPlayerPosition?: (playerId: string, roomPath: string) => Position | null): void {
        this.processMobRegeneration();
        this.processMobMovement(getPlayerPosition);
    }

    /**
     * Start AI loop (1 second intervals)
     */
    startAI(getPlayerPosition?: (playerId: string, roomPath: string) => Position | null): void {
        if (this.aiInterval) {
            clearInterval(this.aiInterval);
        }

        this.aiInterval = setInterval(() => {
            this.processMobAI(getPlayerPosition);
        }, 1000);
    }

    /**
     * Stop AI loop
     */
    stopAI(): void {
        if (this.aiInterval) {
            clearInterval(this.aiInterval);
            this.aiInterval = null;
        }
    }

    /**
     * Cleanup (stop all timers)
     */
    cleanup(): void {
        this.stopRespawnTimer();
        this.stopAI();
    }
}
