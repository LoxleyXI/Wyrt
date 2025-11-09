/**
 * Generic skill progression system types
 */

export interface SkillConfig {
    verb: string;      // "mining", "fishing", "persuading"
    action: string;    // "mine", "fish", "persuade"
    desc: string;      // Description of the skill
    maxlvl: number;    // Maximum level for this skill
    tool?: string;     // Optional tool requirement
}

export interface SkillData {
    skills: Record<string, number>;  // skill name -> XP amount
}

export interface SkillIncreaseEvent {
    skill: string;
    xpGained: number;
    totalXP: number;
    level: number;
    progress: number;
    xpToNextLevel: number;
    leveledUp: boolean;
}

export interface SkillLevelUpEvent {
    skill: string;
    newLevel: number;
    oldLevel: number;
}
