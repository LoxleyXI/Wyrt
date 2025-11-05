import { ModuleContext } from "../../src/module/ModuleContext";
import { SkillManager } from "./SkillManager";
import { DamageCalculator } from "./DamageCalculator";
import { Player, Entity, EntityStats } from "../rooms/types";

export interface CombatSession {
    id: string;
    participants: CombatParticipant[];
    turnOrder: string[];
    currentTurn: number;
    roundNumber: number;
    startTime: number;
    lastActionTime: number;
    status: "active" | "ended";
}

export interface CombatParticipant {
    id: string;
    type: "player" | "entity";
    stats: EntityStats;
    hp: [number, number];
    mp?: [number, number];
    buffs: Buff[];
    debuffs: Debuff[];
    cooldowns: Map<string, number>;
    threat: Map<string, number>; // targetId -> threat value
    inCombat: boolean;
    lastAction?: CombatAction;
}

export interface CombatAction {
    type: "attack" | "skill" | "item" | "flee";
    sourceId: string;
    targetId?: string;
    skillId?: string;
    itemId?: string;
    timestamp: number;
}

export interface Buff {
    id: string;
    name: string;
    duration: number;
    startTime: number;
    stats?: Partial<EntityStats>;
    effects?: string[];
}

export interface Debuff extends Buff {
    dot?: number; // Damage over time
}

export class CombatManager {
    private context: ModuleContext;
    private skillManager: SkillManager;
    private damageCalculator: DamageCalculator;
    private combatSessions: Map<string, CombatSession> = new Map();
    private participantSessions: Map<string, string> = new Map(); // participantId -> sessionId
    private combatLoopInterval: NodeJS.Timeout | null = null;
    private tickRate = 100; // 10 ticks per second
    
    constructor(
        context: ModuleContext, 
        skillManager: SkillManager, 
        damageCalculator: DamageCalculator
    ) {
        this.context = context;
        this.skillManager = skillManager;
        this.damageCalculator = damageCalculator;
    }
    
    startCombatLoop() {
        if (this.combatLoopInterval) return;
        
        this.combatLoopInterval = setInterval(() => {
            this.processCombat();
        }, this.tickRate);
        
        this.context.logger.info("Combat loop started");
    }
    
    stopCombatLoop() {
        if (this.combatLoopInterval) {
            clearInterval(this.combatLoopInterval);
            this.combatLoopInterval = null;
            this.context.logger.info("Combat loop stopped");
        }
    }
    
    private processCombat() {
        const now = Date.now();
        
        for (const [sessionId, session] of this.combatSessions) {
            if (session.status !== "active") continue;
            
            // Process DoT/HoT effects
            this.processEffects(session, now);
            
            // Update buff/debuff durations
            this.updateBuffDebuffDurations(session, now);
            
            // Check for combat timeout
            if (now - session.lastActionTime > 30000) { // 30 second timeout
                this.endCombat(sessionId, "timeout");
            }
        }
    }
    
    startCombat(attackerId: string, targetId: string): CombatSession | null {
        // Check if already in combat
        if (this.participantSessions.has(attackerId)) {
            const sessionId = this.participantSessions.get(attackerId)!;
            return this.combatSessions.get(sessionId) || null;
        }
        
        // Get entities
        const attacker = this.getEntity(attackerId);
        const target = this.getEntity(targetId);
        
        if (!attacker || !target) {
            return null;
        }
        
        // Create combat session
        const sessionId = this.generateSessionId();
        const session: CombatSession = {
            id: sessionId,
            participants: [],
            turnOrder: [],
            currentTurn: 0,
            roundNumber: 1,
            startTime: Date.now(),
            lastActionTime: Date.now(),
            status: "active"
        };
        
        // Add participants
        const attackerParticipant = this.createParticipant(attacker);
        const targetParticipant = this.createParticipant(target);
        
        session.participants.push(attackerParticipant, targetParticipant);
        session.turnOrder = this.calculateTurnOrder(session.participants);
        
        // Store session
        this.combatSessions.set(sessionId, session);
        this.participantSessions.set(attackerId, sessionId);
        this.participantSessions.set(targetId, sessionId);
        
        // Broadcast combat start
        this.broadcastCombatEvent(session, {
            type: "combat_start",
            sessionId: sessionId,
            participants: session.participants.map(p => ({
                id: p.id,
                type: p.type,
                hp: p.hp,
                mp: p.mp
            }))
        });
        
        this.context.logger.info(`Combat started: ${attackerId} vs ${targetId}`);
        
        return session;
    }
    
    endCombat(sessionId: string, reason: string = "victory") {
        const session = this.combatSessions.get(sessionId);
        if (!session) return;
        
        session.status = "ended";
        
        // Remove participant mappings
        for (const participant of session.participants) {
            this.participantSessions.delete(participant.id);
            participant.inCombat = false;
        }
        
        // Calculate rewards
        const rewards = this.calculateRewards(session);
        
        // Broadcast combat end
        this.broadcastCombatEvent(session, {
            type: "combat_end",
            sessionId: sessionId,
            reason: reason,
            rewards: rewards
        });
        
        // Remove session
        this.combatSessions.delete(sessionId);
        
        this.context.logger.info(`Combat ended: ${sessionId} (${reason})`);
    }
    
    async performAttack(attackerId: string, targetId: string): Promise<boolean> {
        const sessionId = this.participantSessions.get(attackerId);
        if (!sessionId) return false;
        
        const session = this.combatSessions.get(sessionId);
        if (!session || session.status !== "active") return false;
        
        const attacker = session.participants.find(p => p.id === attackerId);
        const target = session.participants.find(p => p.id === targetId);
        
        if (!attacker || !target) return false;
        
        // Calculate damage
        const damage = this.damageCalculator.calculateBasicAttack(attacker.stats, target.stats);
        
        // Apply damage
        target.hp[0] = Math.max(0, target.hp[0] - damage.amount);
        
        // Update threat
        this.updateThreat(target, attackerId, damage.amount);
        
        // Record action
        attacker.lastAction = {
            type: "attack",
            sourceId: attackerId,
            targetId: targetId,
            timestamp: Date.now()
        };
        
        session.lastActionTime = Date.now();
        
        // Broadcast attack
        this.broadcastCombatEvent(session, {
            type: "attack",
            attackerId: attackerId,
            targetId: targetId,
            damage: damage,
            targetHp: target.hp
        });
        
        // Check if target died
        if (target.hp[0] <= 0) {
            this.handleParticipantDeath(session, targetId);
        }
        
        return true;
    }
    
    async useSkill(userId: string, skillId: string, targetId?: string): Promise<boolean> {
        const sessionId = this.participantSessions.get(userId);
        if (!sessionId) return false;
        
        const session = this.combatSessions.get(sessionId);
        if (!session || session.status !== "active") return false;
        
        const user = session.participants.find(p => p.id === userId);
        if (!user) return false;
        
        // Check cooldown
        const cooldownEnd = user.cooldowns.get(skillId);
        if (cooldownEnd && Date.now() < cooldownEnd) {
            const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
            this.sendErrorToUser(userId, `Skill on cooldown (${remaining}s remaining)`);
            return false;
        }
        
        // Get skill
        const skill = this.skillManager.getSkill(skillId);
        if (!skill) return false;
        
        // Check MP cost
        if (skill.manaCost && user.mp) {
            if (user.mp[0] < skill.manaCost) {
                this.sendErrorToUser(userId, "Not enough mana");
                return false;
            }
            user.mp[0] -= skill.manaCost;
        }
        
        // Determine targets
        const targets = this.determineSkillTargets(session, user, skill, targetId);
        if (targets.length === 0) {
            this.sendErrorToUser(userId, "No valid targets");
            return false;
        }
        
        // Apply skill effects
        const results = this.skillManager.applySkill(skill, user, targets);
        
        // Set cooldown
        if (skill.cooldown > 0) {
            user.cooldowns.set(skillId, Date.now() + skill.cooldown * 1000);
        }
        
        // Record action
        user.lastAction = {
            type: "skill",
            sourceId: userId,
            targetId: targetId,
            skillId: skillId,
            timestamp: Date.now()
        };
        
        session.lastActionTime = Date.now();
        
        // Broadcast skill use
        this.broadcastCombatEvent(session, {
            type: "skill_use",
            userId: userId,
            skillId: skillId,
            skill: skill,
            targets: results,
            userMp: user.mp
        });
        
        // Check for deaths
        for (const result of results) {
            const target = session.participants.find(p => p.id === result.targetId);
            if (target && target.hp[0] <= 0) {
                this.handleParticipantDeath(session, target.id);
            }
        }
        
        return true;
    }
    
    private createParticipant(entity: any): CombatParticipant {
        return {
            id: entity.id,
            type: entity.type === "player" ? "player" : "entity",
            stats: entity.stats || this.getDefaultStats(),
            hp: entity.hp || [100, 100],
            mp: entity.mp,
            buffs: [],
            debuffs: [],
            cooldowns: new Map(),
            threat: new Map(),
            inCombat: true
        };
    }
    
    private getDefaultStats(): EntityStats {
        return {
            strength: 10,
            dexterity: 10,
            intelligence: 10,
            defense: 10,
            agility: 10
        };
    }
    
    private calculateTurnOrder(participants: CombatParticipant[]): string[] {
        // Sort by agility for turn order
        return participants
            .sort((a, b) => (b.stats.agility || 0) - (a.stats.agility || 0))
            .map(p => p.id);
    }
    
    private processEffects(session: CombatSession, now: number) {
        for (const participant of session.participants) {
            // Process DoT debuffs
            for (const debuff of participant.debuffs) {
                if (debuff.dot && debuff.dot > 0) {
                    // Apply DoT damage every second
                    const timeSinceStart = now - debuff.startTime;
                    const ticksSinceStart = Math.floor(timeSinceStart / 1000);
                    const lastTick = Math.floor((timeSinceStart - this.tickRate) / 1000);
                    
                    if (ticksSinceStart > lastTick) {
                        participant.hp[0] = Math.max(0, participant.hp[0] - debuff.dot);
                        
                        this.broadcastCombatEvent(session, {
                            type: "dot_damage",
                            targetId: participant.id,
                            damage: debuff.dot,
                            source: debuff.name,
                            targetHp: participant.hp
                        });
                        
                        if (participant.hp[0] <= 0) {
                            this.handleParticipantDeath(session, participant.id);
                        }
                    }
                }
            }
        }
    }
    
    private updateBuffDebuffDurations(session: CombatSession, now: number) {
        for (const participant of session.participants) {
            // Remove expired buffs
            participant.buffs = participant.buffs.filter(buff => {
                const elapsed = (now - buff.startTime) / 1000;
                return elapsed < buff.duration;
            });
            
            // Remove expired debuffs
            participant.debuffs = participant.debuffs.filter(debuff => {
                const elapsed = (now - debuff.startTime) / 1000;
                return elapsed < debuff.duration;
            });
        }
    }
    
    private updateThreat(target: CombatParticipant, attackerId: string, amount: number) {
        const currentThreat = target.threat.get(attackerId) || 0;
        target.threat.set(attackerId, currentThreat + amount);
    }
    
    private determineSkillTargets(
        session: CombatSession, 
        user: CombatParticipant, 
        skill: any, 
        targetId?: string
    ): CombatParticipant[] {
        const targets: CombatParticipant[] = [];
        
        switch (skill.targetType) {
            case "self":
                targets.push(user);
                break;
                
            case "single":
                if (targetId) {
                    const target = session.participants.find(p => p.id === targetId);
                    if (target) targets.push(target);
                }
                break;
                
            case "aoe":
                // Target all enemies or allies depending on skill type
                for (const participant of session.participants) {
                    if (skill.type === "heal" || skill.type === "buff") {
                        // Target allies
                        if (participant.type === user.type) {
                            targets.push(participant);
                        }
                    } else {
                        // Target enemies
                        if (participant.type !== user.type) {
                            targets.push(participant);
                        }
                    }
                }
                break;
        }
        
        return targets;
    }
    
    private handleParticipantDeath(session: CombatSession, participantId: string) {
        const participant = session.participants.find(p => p.id === participantId);
        if (!participant) return;
        
        participant.inCombat = false;
        
        // Emit death event
        this.context.events.emit("combatDeath", {
            sessionId: session.id,
            participantId: participantId,
            killers: Array.from(participant.threat.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([id]) => id)
        });
        
        // Check if combat should end
        const remainingTypes = new Set(
            session.participants
                .filter(p => p.inCombat && p.hp[0] > 0)
                .map(p => p.type)
        );
        
        if (remainingTypes.size <= 1) {
            // One side won
            this.endCombat(session.id, "victory");
        }
    }
    
    private calculateRewards(session: CombatSession): any {
        const rewards: any = {
            experience: 0,
            gold: 0,
            items: []
        };
        
        // Calculate based on defeated enemies
        for (const participant of session.participants) {
            if (participant.type === "entity" && participant.hp[0] <= 0) {
                // Base rewards
                rewards.experience += 50 * (participant.stats.strength || 10);
                rewards.gold += 10 + Math.floor(Math.random() * 20);
                
                // Random item chance
                if (Math.random() < 0.2) {
                    rewards.items.push({
                        id: "potion_health",
                        quantity: 1
                    });
                }
            }
        }
        
        return rewards;
    }
    
    private broadcastCombatEvent(session: CombatSession, event: any) {
        for (const participant of session.participants) {
            if (participant.type === "player") {
                this.context.events.emit("sendToPlayer", {
                    playerId: participant.id,
                    message: {
                        type: "combat_event",
                        ...event
                    }
                });
            }
        }
    }
    
    private sendErrorToUser(userId: string, message: string) {
        this.context.events.emit("sendToPlayer", {
            playerId: userId,
            message: {
                type: "error",
                message: message
            }
        });
    }
    
    private getEntity(entityId: string): any {
        // Get from room system
        const roomManager = this.context.modules.get("roomManager");
        const entityManager = this.context.modules.get("entityManager");
        
        if (roomManager) {
            // Check if it's a player
            const rooms = roomManager.getAllRooms();
            for (const room of rooms) {
                const player = room.players.find((p: any) => p.id === entityId);
                if (player) return player;
            }
        }
        
        if (entityManager) {
            // Check if it's an entity
            return entityManager.getEntity(entityId);
        }
        
        return null;
    }
    
    handleEntityDeath(entityId: string) {
        const sessionId = this.participantSessions.get(entityId);
        if (sessionId) {
            const session = this.combatSessions.get(sessionId);
            if (session) {
                this.handleParticipantDeath(session, entityId);
            }
        }
    }
    
    private generateSessionId(): string {
        return `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    cleanup() {
        this.stopCombatLoop();
        this.combatSessions.clear();
        this.participantSessions.clear();
    }
}