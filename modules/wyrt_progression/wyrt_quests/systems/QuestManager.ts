/**
 * Quest Manager for Wyrt Quest System
 *
 * Uses wyrt_data's QuestProgress table for persistence.
 * Quest definitions are loaded from wyrt_data's Quest table.
 *
 * Core quest lifecycle management:
 * - Quest loading and storage
 * - Quest progress tracking
 * - Objective completion
 * - Reward distribution
 * - Cooldown management
 */

import type { ModuleContext } from '../../../../src/module/ModuleContext.js';
import type DataModule from '../../../wyrt_data/index.js';
import { QuestDefinition, QuestProgress, QuestStep } from '../types/Quest.js';
import { ObjectiveRegistry } from './ObjectiveRegistry.js';
import { RewardRegistry } from './RewardRegistry.js';

export interface QuestProgressData {
  id: string;
  characterId: string;
  questSlug: string;
  status: string;
  progress: Record<string, any>;
  completions: number;
  startedAt: Date;
  completedAt: Date | null;
}

export class QuestManager {
  private context: ModuleContext;
  private dataModule: DataModule;
  private gameId: string;
  private quests: Map<string, QuestDefinition> = new Map();

  public objectives: ObjectiveRegistry;
  public rewards: RewardRegistry;

  constructor(context: ModuleContext, dataModule: DataModule, gameId: string) {
    this.context = context;
    this.dataModule = dataModule;
    this.gameId = gameId;
    this.objectives = new ObjectiveRegistry();
    this.rewards = new RewardRegistry();
  }

  private get db() {
    return this.dataModule.getDatabase();
  }

  /**
   * Initialize and load quest definitions from wyrt_data
   */
  async initialize(): Promise<void> {
    try {
      const questDefs = await this.db.quest.findMany({
        where: { gameId: this.gameId },
      });

      for (const quest of questDefs) {
        this.quests.set(quest.slug, this.convertToQuestDefinition(quest));
      }

      this.context.logger.info(`[wyrt_quests:${this.gameId}] ✓ Loaded ${this.quests.size} quests`);
    } catch (error) {
      this.context.logger.warn(`[wyrt_quests:${this.gameId}] Could not load quest definitions: ${error}`);
    }
  }

  /**
   * Convert database quest to QuestDefinition format
   */
  private convertToQuestDefinition(dbQuest: any): QuestDefinition {
    const objectives = (dbQuest.objectives as any[]) || [];
    const rewards = (dbQuest.rewards as Record<string, any>) || {};

    return {
      id: dbQuest.slug,
      name: dbQuest.name,
      description: dbQuest.description || '',
      type: dbQuest.type,
      giver: dbQuest.giverSlug || undefined,
      prerequisites: dbQuest.prerequisiteSlug ? [dbQuest.prerequisiteSlug] : undefined,
      repeatable: dbQuest.resetPeriod !== null,
      repeat_type: dbQuest.resetPeriod as 'daily' | 'weekly' | 'manual' | undefined,
      steps: [
        {
          objectives: objectives.map((obj) => ({
            type: obj.type,
            target: obj.target,
            count: obj.count,
            description: obj.description,
          })),
          rewards: {
            experience: rewards.exp,
            gold: rewards.gold,
            items: rewards.items?.map((i: any) => ({ id: i.slug, quantity: i.qty })),
          },
        },
      ],
    };
  }

  /**
   * Load quests from data (for backwards compatibility)
   */
  loadQuests(quests: QuestDefinition[]): void {
    for (const quest of quests) {
      this.quests.set(quest.id, quest);
    }
    this.context.logger.info(`[wyrt_quests:${this.gameId}] ✓ Loaded ${this.quests.size} quests`);
  }

  /**
   * Get quest by ID/slug
   */
  getQuest(questSlug: string): QuestDefinition | undefined {
    return this.quests.get(questSlug);
  }

  /**
   * Get all quests
   */
  getAllQuests(): QuestDefinition[] {
    return Array.from(this.quests.values());
  }

  /**
   * Get quest progress for character
   */
  async getProgress(characterId: string, questSlug: string): Promise<QuestProgressData | null> {
    try {
      const progress = await this.db.questProgress.findUnique({
        where: {
          characterId_questSlug: {
            characterId,
            questSlug,
          },
        },
      });

      if (!progress) return null;

      return {
        id: progress.id,
        characterId: progress.characterId,
        questSlug: progress.questSlug,
        status: progress.status,
        progress: (progress.progress as Record<string, any>) || {},
        completions: progress.completions,
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
      };
    } catch (error) {
      this.context.logger.error(`Error getting quest progress: ${error}`);
      return null;
    }
  }

  /**
   * Get all active quests for character
   */
  async getActiveQuests(characterId: string): Promise<QuestProgressData[]> {
    try {
      const quests = await this.db.questProgress.findMany({
        where: {
          characterId,
          status: 'active',
        },
      });

      return quests.map((q) => ({
        id: q.id,
        characterId: q.characterId,
        questSlug: q.questSlug,
        status: q.status,
        progress: (q.progress as Record<string, any>) || {},
        completions: q.completions,
        startedAt: q.startedAt,
        completedAt: q.completedAt,
      }));
    } catch (error) {
      this.context.logger.error(`Error getting active quests: ${error}`);
      return [];
    }
  }

  /**
   * Get completed quests for character
   */
  async getCompletedQuests(characterId: string): Promise<QuestProgressData[]> {
    try {
      const quests = await this.db.questProgress.findMany({
        where: {
          characterId,
          status: 'completed',
        },
      });

      return quests.map((q) => ({
        id: q.id,
        characterId: q.characterId,
        questSlug: q.questSlug,
        status: q.status,
        progress: (q.progress as Record<string, any>) || {},
        completions: q.completions,
        startedAt: q.startedAt,
        completedAt: q.completedAt,
      }));
    } catch (error) {
      this.context.logger.error(`Error getting completed quests: ${error}`);
      return [];
    }
  }

  /**
   * Accept quest
   */
  async acceptQuest(characterId: string, questSlug: string, gameContext?: any): Promise<void> {
    const quest = this.quests.get(questSlug);
    if (!quest) {
      throw new Error(`Quest not found: ${questSlug}`);
    }

    // Check if already active
    const existing = await this.getProgress(characterId, questSlug);
    if (existing && existing.status === 'active') {
      throw new Error('Quest already active');
    }

    // Check cooldown for repeatable quests
    if (quest.repeatable && existing) {
      if (this.isOnCooldown(quest, existing)) {
        throw new Error('Quest on cooldown');
      }
    }

    // Create/update progress
    await this.db.questProgress.upsert({
      where: {
        characterId_questSlug: {
          characterId,
          questSlug,
        },
      },
      update: {
        status: 'active',
        progress: {},
        startedAt: new Date(),
      },
      create: {
        characterId,
        questSlug,
        status: 'active',
        progress: {},
      },
    });

    // Emit event
    this.context.events.emit('quest:accepted', {
      characterId,
      questSlug,
      quest,
    });

    this.context.logger.debug(`[wyrt_quests:${this.gameId}] ${characterId} accepted quest: ${questSlug}`);
  }

  /**
   * Update quest progress
   */
  async updateProgress(
    characterId: string,
    questSlug: string,
    objectiveType: string,
    eventData: any,
    gameContext?: any
  ): Promise<boolean> {
    const quest = this.quests.get(questSlug);
    if (!quest) return false;

    const progressData = await this.getProgress(characterId, questSlug);
    if (!progressData || progressData.status !== 'active') return false;

    const currentStep = quest.steps[0]; // Simplified - using single step
    if (!currentStep || !currentStep.objectives) return false;

    // Find matching objective
    const objective = currentStep.objectives.find((obj) => obj.type === objectiveType);
    if (!objective) return false;

    // Check target match
    if (objective.target && eventData.target !== objective.target) return false;

    // Update progress
    const progress = { ...progressData.progress };
    const key = `${objectiveType}:${objective.target || 'any'}`;
    progress[key] = (progress[key] || 0) + (eventData.amount || 1);

    await this.db.questProgress.update({
      where: {
        characterId_questSlug: {
          characterId,
          questSlug,
        },
      },
      data: { progress },
    });

    // Check if all objectives complete
    const allComplete = currentStep.objectives.every((obj) => {
      const objKey = `${obj.type}:${obj.target || 'any'}`;
      return (progress[objKey] || 0) >= (obj.count || 1);
    });

    // Emit progress event
    this.context.events.emit('quest:progress', {
      characterId,
      questSlug,
      objectiveType,
      progress,
      complete: allComplete,
    });

    return true;
  }

  /**
   * Complete quest
   */
  async completeQuest(characterId: string, questSlug: string, gameContext?: any): Promise<void> {
    const quest = this.quests.get(questSlug);
    if (!quest) return;

    const progressData = await this.getProgress(characterId, questSlug);
    if (!progressData || progressData.status !== 'active') return;

    // Update status
    await this.db.questProgress.update({
      where: {
        characterId_questSlug: {
          characterId,
          questSlug,
        },
      },
      data: {
        status: 'completed',
        completedAt: new Date(),
        completions: progressData.completions + 1,
      },
    });

    // Emit completion event (game handles reward distribution)
    this.context.events.emit('quest:completed', {
      characterId,
      questSlug,
      quest,
      rewards: quest.steps[0]?.rewards,
    });

    this.context.logger.debug(`[wyrt_quests:${this.gameId}] ${characterId} completed quest: ${questSlug}`);
  }

  /**
   * Abandon quest
   */
  async abandonQuest(characterId: string, questSlug: string): Promise<void> {
    await this.db.questProgress.update({
      where: {
        characterId_questSlug: {
          characterId,
          questSlug,
        },
      },
      data: { status: 'abandoned' },
    });

    this.context.events.emit('quest:abandoned', {
      characterId,
      questSlug,
    });
  }

  /**
   * Check if quest is on cooldown
   */
  private isOnCooldown(quest: QuestDefinition, progress: QuestProgressData): boolean {
    if (!progress.completedAt) return false;

    const now = new Date();
    const lastCompleted = new Date(progress.completedAt);

    if (quest.repeat_type === 'daily') {
      return lastCompleted.toDateString() === now.toDateString();
    }

    if (quest.repeat_type === 'weekly') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return lastCompleted >= startOfWeek;
    }

    if (quest.repeat_type === 'manual' && quest.cooldown_seconds) {
      const cooldownEnd = new Date(lastCompleted.getTime() + quest.cooldown_seconds * 1000);
      return now < cooldownEnd;
    }

    return false;
  }

  /**
   * Get available quests for character (not started, prerequisites met)
   */
  async getAvailableQuests(characterId: string, gameContext?: any): Promise<QuestDefinition[]> {
    const allQuests = this.getAllQuests();
    const available: QuestDefinition[] = [];

    for (const quest of allQuests) {
      const progress = await this.getProgress(characterId, quest.id);

      // Skip if already active
      if (progress?.status === 'active') continue;

      // Skip if completed and not repeatable
      if (progress?.status === 'completed' && !quest.repeatable) continue;

      // Skip if on cooldown
      if (progress && quest.repeatable && this.isOnCooldown(quest, progress)) continue;

      // Check prerequisites
      if (quest.prerequisites) {
        let prereqsMet = true;
        for (const prereq of quest.prerequisites) {
          const prereqProgress = await this.getProgress(characterId, prereq);
          if (!prereqProgress || prereqProgress.status !== 'completed') {
            prereqsMet = false;
            break;
          }
        }
        if (!prereqsMet) continue;
      }

      available.push(quest);
    }

    return available;
  }
}
