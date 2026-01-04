/**
 * Skill Manager
 *
 * Uses wyrt_data's CharacterSkill table for persistence.
 * All operations use characterId (UUID string).
 */

import type { ModuleContext } from '../../../../src/module/ModuleContext.js';
import type DataModule from '../../../wyrt_data/index.js';
import { SkillConfig } from '../types/Skill.js';

export interface CharacterSkillData {
  id: string;
  characterId: string;
  skillSlug: string;
  level: number;
  experience: number;
}

export interface SkillAPI {
  getLevel(characterId: string, skillSlug: string): Promise<number>;
  getXP(characterId: string, skillSlug: string): Promise<number>;
  getSkills(characterId: string): Promise<CharacterSkillData[]>;
  grantXP(characterId: string, skillSlug: string, amount: number): Promise<void>;
  setLevel(characterId: string, skillSlug: string, level: number): Promise<void>;
}

export class SkillManager implements SkillAPI {
  private context: ModuleContext;
  private dataModule: DataModule;
  private gameId: string;
  private skills: Map<string, SkillConfig> = new Map();
  private readonly BASE_XP = 100; // Base XP multiplier for quadratic progression

  constructor(context: ModuleContext, dataModule: DataModule, gameId: string) {
    this.context = context;
    this.dataModule = dataModule;
    this.gameId = gameId;
  }

  private get db() {
    return this.dataModule.getDatabase();
  }

  getAPI(): SkillAPI {
    return {
      getLevel: this.getLevel.bind(this),
      getXP: this.getXP.bind(this),
      getSkills: this.getSkills.bind(this),
      grantXP: this.grantXP.bind(this),
      setLevel: this.setLevel.bind(this),
    };
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
    // Load skill definitions from wyrt_data
    try {
      const skillDefs = await this.db.skill.findMany({
        where: { gameId: this.gameId },
      });

      for (const skill of skillDefs) {
        this.skills.set(skill.slug, {
          name: skill.name,
          description: skill.description || '',
          maxlvl: skill.maxLevel,
          type: skill.type,
        });
      }

      this.context.logger.debug(`[wyrt_skills:${this.gameId}] Loaded ${this.skills.size} skill definitions`);
    } catch (error) {
      this.context.logger.warn(`[wyrt_skills:${this.gameId}] Could not load skill definitions: ${error}`);
    }
  }

  getSkillConfig(slug: string): SkillConfig | undefined {
    return this.skills.get(slug);
  }

  /**
   * Get player's level in a skill
   */
  async getLevel(characterId: string, skillSlug: string): Promise<number> {
    try {
      const skill = await this.db.characterSkill.findUnique({
        where: {
          characterId_skillSlug: {
            characterId,
            skillSlug,
          },
        },
      });

      return skill?.level ?? 1;
    } catch (error) {
      this.context.logger.error(`Error getting skill level: ${error}`);
      return 1;
    }
  }

  /**
   * Get player's XP in a skill
   */
  async getXP(characterId: string, skillSlug: string): Promise<number> {
    try {
      const skill = await this.db.characterSkill.findUnique({
        where: {
          characterId_skillSlug: {
            characterId,
            skillSlug,
          },
        },
      });

      return skill?.experience ?? 0;
    } catch (error) {
      this.context.logger.error(`Error getting skill XP: ${error}`);
      return 0;
    }
  }

  /**
   * Get all skills for a character
   */
  async getSkills(characterId: string): Promise<CharacterSkillData[]> {
    try {
      const skills = await this.db.characterSkill.findMany({
        where: { characterId },
      });

      return skills.map((s) => ({
        id: s.id,
        characterId: s.characterId,
        skillSlug: s.skillSlug,
        level: s.level,
        experience: s.experience,
      }));
    } catch (error) {
      this.context.logger.error(`Error getting skills: ${error}`);
      return [];
    }
  }

  /**
   * Grant XP to a skill
   */
  async grantXP(characterId: string, skillSlug: string, amount: number): Promise<void> {
    try {
      // Get current skill data
      const existing = await this.db.characterSkill.findUnique({
        where: {
          characterId_skillSlug: {
            characterId,
            skillSlug,
          },
        },
      });

      const currentXP = existing?.experience ?? 0;
      const config = this.skills.get(skillSlug);
      const maxLevel = config?.maxlvl ?? 100;
      const maxXP = this.getXPForLevel(maxLevel + 1);

      const newXP = Math.min(currentXP + amount, maxXP);
      const oldLevel = this.getLevelFromXP(currentXP);
      const newLevel = this.getLevelFromXP(newXP);
      const leveledUp = newLevel > oldLevel;

      // Upsert skill data
      await this.db.characterSkill.upsert({
        where: {
          characterId_skillSlug: {
            characterId,
            skillSlug,
          },
        },
        update: {
          experience: newXP,
          level: newLevel,
        },
        create: {
          characterId,
          skillSlug,
          experience: newXP,
          level: newLevel,
        },
      });

      // Emit events
      this.context.events.emit('skill:xpGained', {
        characterId,
        skillSlug,
        amount,
        totalXP: newXP,
        level: newLevel,
        progress: this.getProgressToNextLevel(newXP),
        leveledUp,
      });

      if (leveledUp) {
        this.context.events.emit('skill:levelUp', {
          characterId,
          skillSlug,
          oldLevel,
          newLevel,
        });
      }

      this.context.logger.debug(
        `[wyrt_skills:${this.gameId}] ${characterId}: ${skillSlug} +${amount} XP (Level ${newLevel})`
      );
    } catch (error) {
      this.context.logger.error(`Error granting skill XP: ${error}`);
    }
  }

  /**
   * Set skill level directly (for admin/testing)
   */
  async setLevel(characterId: string, skillSlug: string, level: number): Promise<void> {
    try {
      const experience = this.getXPForLevel(level);

      await this.db.characterSkill.upsert({
        where: {
          characterId_skillSlug: {
            characterId,
            skillSlug,
          },
        },
        update: {
          level,
          experience,
        },
        create: {
          characterId,
          skillSlug,
          level,
          experience,
        },
      });
    } catch (error) {
      this.context.logger.error(`Error setting skill level: ${error}`);
    }
  }

  /**
   * Calculate XP gain from performing an action
   * Uses square root scaling for balanced progression
   */
  calculateSkillXP(targetLevel: number, multiplier: number = 1): number {
    // Square root scaling with ±15% randomness
    const baseValue = Math.sqrt(targetLevel) * 40;
    const randomVariation = 0.85 + Math.random() * 0.3;
    return Math.ceil(baseValue * randomVariation * multiplier);
  }

  /**
   * Check if player meets level requirement
   */
  async canPerformSkill(characterId: string, skillSlug: string, requiredLevel: number): Promise<boolean> {
    const level = await this.getLevel(characterId, skillSlug);
    return level >= requiredLevel;
  }

  // Legacy methods for backwards compatibility
  async increaseSkill(characterId: string, skillSlug: string, amount: number): Promise<void> {
    return this.grantXP(characterId, skillSlug, amount);
  }

  async getPlayerSkillLevel(characterId: string, skillSlug: string): Promise<number> {
    return this.getLevel(characterId, skillSlug);
  }
}
