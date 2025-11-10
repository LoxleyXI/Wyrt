import { ModuleContext } from '../../../src/module/ModuleContext';
import { SkillConfig } from '../types/Skill';

export class SkillManager {
    private context: ModuleContext;
    private gameId: string;
    private skills: Map<string, SkillConfig> = new Map();
    private readonly BASE_XP = 100; // Base XP multiplier for quadratic progression
    private tableName: string;

    constructor(context: ModuleContext, gameId: string) {
        this.context = context;
        this.gameId = gameId;
        this.tableName = `${gameId}_skills`;
    }

    /**
     * Calculate level from total XP using quadratic formula (starting at level 1)
     * Formula: level = floor(sqrt(xp / BASE_XP)) + 1
     */
    getLevelFromXP(xp: number): number {
        return Math.floor(Math.sqrt(xp / this.BASE_XP)) + 1;
    }

    /**
     * Calculate XP required for a specific level (adjusted for level starting at 1)
     * Formula: xp = (level - 1)^2 * BASE_XP
     */
    getXPForLevel(level: number): number {
        return Math.pow(level - 1, 2) * this.BASE_XP;
    }

    /**
     * Calculate progress to next level (0-100%)
     */ 
    getProgressToNextLevel(xp: number): number {
        const currentLevel = this.getLevelFromXP(xp);
        const currentLevelXP = this.getXPForLevel(currentLevel);
        const nextLevelXP = this.getXPForLevel(currentLevel + 1);
        const xpIntoLevel = xp - currentLevelXP;
        const xpNeededForLevel = nextLevelXP - currentLevelXP;
        return Math.floor((xpIntoLevel / xpNeededForLevel) * 100);
    }

    /**
     * Initialize and load skill definitions from game data
     */
    async initialize(): Promise<void> {
        // Load from game-specific data
        const gameData = (this.context.data as any)[this.gameId];
        if (gameData?.skills?.Skills) {
            Object.entries(gameData.skills.Skills).forEach(([name, config]) => {
                this.skills.set(name, config as SkillConfig);
            });
            this.context.logger.debug(`[wyrt_skills:${this.gameId}] Loaded ${this.skills.size} skill definitions`);
        } else {
            this.context.logger.warn(`[wyrt_skills:${this.gameId}] No skill data found`);
        }
    }

    getSkill(name: string): SkillConfig | undefined {
        return this.skills.get(name);
    }

    async increaseSkill(playerId: string, skillName: string, amount: number): Promise<void> {
        const player = await this.getPlayer(playerId);
        if (!player) return;

        if (!player.skills) {
            player.skills = {};
        }

        const currentXP = player.skills[skillName] || 0;
        const skill = this.skills.get(skillName);
        if (!skill) return;

        // Calculate max XP for the skill's max level
        const maxXP = this.getXPForLevel(skill.maxlvl);
        const newXP = Math.min(currentXP + amount, maxXP);

        // Check if player leveled up
        const oldLevel = this.getLevelFromXP(currentXP);
        const newLevel = this.getLevelFromXP(newXP);
        const leveledUp = newLevel > oldLevel;

        player.skills[skillName] = newXP;
        await this.savePlayer(playerId, player);

        const progress = this.getProgressToNextLevel(newXP);
        const xpToNextLevel = this.getXPForLevel(newLevel + 1) - newXP;

        // Send XP gain notification
        const user = this.findUserByCharacterId(playerId);
        if (user) {
            this.context.logger.debug(`[wyrt_skills:${this.gameId}] ${playerId}: ${skillName} +${amount} XP (Level ${newLevel})`);
            user.system(JSON.stringify({
                type: 'skill_increase',
                data: {
                    skill: skillName,
                    xpGained: amount,
                    totalXP: newXP,
                    level: newLevel,
                    progress,
                    xpToNextLevel,
                    leveledUp
                }
            }));

            // Send separate level up notification
            if (leveledUp) {
                user.system(JSON.stringify({
                    type: 'skill_levelup',
                    data: {
                        skill: skillName,
                        newLevel,
                        oldLevel
                    }
                }));
            }
        }
    }

    /**
     * Calculate and grant skill XP from an activity
     */
    async grantSkillXP(playerId: string, skillName: string, targetLevel: number, multiplier: number = 1): Promise<void> {
        const player = await this.getPlayer(playerId);
        if (!player) {
            this.context.logger.warn(`[wyrt_skills:${this.gameId}] Player ${playerId} not found`);
            return;
        }

        const playerSkillXP = player.skills?.[skillName] || 0;
        const xpGain = this.calculateSkillup(playerSkillXP, targetLevel, multiplier);

        if (xpGain && xpGain > 0) {
            await this.increaseSkill(playerId, skillName, xpGain);
        }
    }

    /**
     * Calculate XP gain from performing an action (awarded on node depletion)
     * Uses square root scaling for balanced progression
     */
    calculateSkillup(playerXP: number, targetLevel: number, multiplier: number = 1): number | null {
        const playerLevel = this.getLevelFromXP(playerXP);

        // Stop gaining XP if player is 10+ levels above the activity
        if (playerLevel >= targetLevel + 10) {
            return null;
        }

        // Square root scaling with ±15% randomness
        // Level 1: 34-46 XP (avg 40) = ~8 nodes for level 1→2
        // Level 5: 76-103 XP (avg 90) = ~12 nodes for level 5→6
        // Level 10: 108-146 XP (avg 127) = ~17 nodes for level 10→11
        const baseValue = Math.sqrt(targetLevel) * 40;
        const randomVariation = 0.85 + Math.random() * 0.3; // ±15% variation

        return Math.ceil(baseValue * randomVariation * multiplier);
    }

    /**
     * Check if player can perform a skill-based action
     */
    canPerformSkill(playerXP: number, requiredLevel: number): boolean {
        const playerLevel = this.getLevelFromXP(playerXP);
        return playerLevel >= requiredLevel;
    }

    /**
     * Get player's current level in a skill
     */
    async getPlayerSkillLevel(playerId: string, skillName: string): Promise<number> {
        const player = await this.getPlayer(playerId);
        if (!player || !player.skills) return 1; // Default to level 1

        const xp = player.skills[skillName] || 0;
        return this.getLevelFromXP(xp);
    }

    private async getPlayer(playerId: string): Promise<any> {
        const [rows] = await this.context.db.query(
            `SELECT skill_name, experience FROM ${this.tableName} WHERE character_id = ?`,
            [playerId]
        );

        const player: any = { skills: {} };

        for (const row of rows) {
            player.skills[row.skill_name] = row.experience;
        }

        return player;
    }

    private async savePlayer(playerId: string, playerData: any): Promise<void> {
        if (!playerData.skills) return;

        // Update each skill individually
        for (const [skillName, experience] of Object.entries(playerData.skills)) {
            const level = this.getLevelFromXP(experience as number);

            await this.context.db.query(
                `INSERT INTO ${this.tableName} (character_id, skill_name, level, experience)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE level = ?, experience = ?`,
                [playerId, skillName, level, experience, level, experience]
            );
        }
    }

    private findUserByCharacterId(characterId: string): any {
        // Find user with this character ID
        for (const userId in this.context.data.users) {
            const user = this.context.data.users[userId];
            if (user.player && user.player.charid && user.player.charid.toString() === characterId) {
                return user;
            }
        }
        return null;
    }
}
