/**
 * Quest Manager for Wyrt Quest System
 *
 * Core quest lifecycle management:
 * - Quest loading and storage
 * - Quest progress tracking
 * - Objective completion
 * - Reward distribution
 * - Cooldown management
 */

import { ModuleContext } from '../../../src/module/ModuleContext';
import { QuestDefinition, QuestProgress, QuestStep } from '../types/Quest';
import { ObjectiveRegistry } from './ObjectiveRegistry';
import { RewardRegistry } from './RewardRegistry';

/**
 * Configuration for QuestManager
 *
 * Allows games to customize table/field names
 */
export interface QuestManagerConfig {
    tableName: string;              // Game-specific table name (e.g., 'mygame_character_quests')
    characterIdField: string;       // Field name for character ID (default: 'character_id')
}

export class QuestManager {
    private context: ModuleContext;
    private quests: Map<string, QuestDefinition> = new Map();
    private config: QuestManagerConfig;

    public objectives: ObjectiveRegistry;
    public rewards: RewardRegistry;

    constructor(context: ModuleContext, config: QuestManagerConfig) {
        this.context = context;
        this.config = config;
        this.objectives = new ObjectiveRegistry();
        this.rewards = new RewardRegistry();
    }

    /**
     * Load quests from data
     *
     * @param quests - Array of quest definitions
     */
    loadQuests(quests: QuestDefinition[]): void {
        for (const quest of quests) {
            this.quests.set(quest.id, quest);
        }
        this.context.logger.info(`[wyrt_quests] ✓ Loaded ${this.quests.size} quests`);
    }

    /**
     * Get quest by ID
     */
    getQuest(questId: string): QuestDefinition | undefined {
        return this.quests.get(questId);
    }

    /**
     * Get all quests
     */
    getAllQuests(): QuestDefinition[] {
        return Array.from(this.quests.values());
    }

    /**
     * Get quest progress for character
     *
     * @returns Quest progress or null if not found
     */
    async getProgress(characterId: number | string, questId: string): Promise<QuestProgress | null> {
        const [rows] = await this.context.db.execute(
            `SELECT * FROM ${this.config.tableName} WHERE ${this.config.characterIdField} = ? AND quest_id = ?`,
            [characterId, questId]
        );

        const results = rows as any[];
        if (results.length === 0) {
            return null;
        }

        const row = results[0];
        return {
            characterId: row[this.config.characterIdField],
            questId: row.quest_id,
            currentStep: row.current_step,
            status: row.status,
            objectiveProgress: JSON.parse(row.objective_progress || '{}'),
            acceptedAt: new Date(row.accepted_at),
            completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
            lastCompleted: row.last_completed ? new Date(row.last_completed) : undefined,
            completionCount: row.completion_count || 0,
            custom: JSON.parse(row.custom || '{}')
        };
    }

    /**
     * Accept quest
     *
     * @throws Error if prerequisites not met, already active, or on cooldown
     */
    async acceptQuest(
        characterId: number | string,
        questId: string,
        gameContext: any
    ): Promise<void> {
        const quest = this.quests.get(questId);
        if (!quest) {
            throw new Error(`Quest not found: ${questId}`);
        }

        // Check if already active
        const existing = await this.getProgress(characterId, questId);
        if (existing && existing.status === 'active') {
            throw new Error('Quest already active');
        }

        // Check cooldown
        if (quest.repeatable && existing) {
            const onCooldown = this.isOnCooldown(quest, existing);
            if (onCooldown) {
                throw new Error('Quest on cooldown');
            }
        }

        // Check prerequisites (game handles this via callback)
        if (quest.prerequisites) {
            const canAccept = await this.checkPrerequisites(quest, characterId, gameContext);
            if (!canAccept) {
                throw new Error('Prerequisites not met');
            }
        }

        // Create/update progress
        await this.context.db.execute(`
            INSERT INTO ${this.config.tableName}
            (${this.config.characterIdField}, quest_id, current_step, status, objective_progress, accepted_at)
            VALUES (?, ?, 0, 'active', '{}', NOW())
            ON DUPLICATE KEY UPDATE
            current_step = 0, status = 'active', objective_progress = '{}', accepted_at = NOW()
        `, [characterId, questId]);

        // Initialize step 0 objectives
        const progress = await this.getProgress(characterId, questId);
        if (progress && quest.steps[0]?.objectives) {
            await this.objectives.initializeObjectives(quest.steps[0].objectives, progress, gameContext);
        }

        // Emit event
        await this.context.events.emit('quest.accepted', {
            characterId,
            questId,
            quest
        });
    }

    /**
     * Update quest progress
     *
     * Called when game events occur (mob killed, item collected, etc.)
     *
     * @returns true if progress was updated, false otherwise
     */
    async updateProgress(
        characterId: number | string,
        questId: string,
        objectiveType: string,
        eventData: any,
        gameContext: any
    ): Promise<boolean> {
        const quest = this.quests.get(questId);
        if (!quest) return false;

        const progress = await this.getProgress(characterId, questId);
        if (!progress || progress.status !== 'active') return false;

        const currentStep = quest.steps[progress.currentStep];
        if (!currentStep || !currentStep.objectives) return false;

        // Update objective progress
        const updated = await this.objectives.updateObjectiveProgress(
            objectiveType,
            currentStep.objectives,
            progress,
            eventData,
            gameContext
        );

        if (updated) {
            // Save progress
            await this.saveProgress(progress);

            // Check if step objectives complete
            const stepComplete = await this.objectives.areObjectivesComplete(
                currentStep.objectives,
                progress,
                gameContext
            );

            if (stepComplete) {
                // Emit event (game can show notification)
                await this.context.events.emit('quest.step_complete', {
                    characterId,
                    questId,
                    step: progress.currentStep
                });
            }
        }

        return updated;
    }

    /**
     * Complete current step and move to next
     *
     * @throws Error if objectives not complete
     */
    async completeStep(
        characterId: number | string,
        questId: string,
        gameContext: any
    ): Promise<void> {
        const quest = this.quests.get(questId);
        if (!quest) return;

        const progress = await this.getProgress(characterId, questId);
        if (!progress || progress.status !== 'active') return;

        const currentStep = quest.steps[progress.currentStep];
        if (!currentStep) return;

        // Verify objectives complete
        if (currentStep.objectives) {
            const complete = await this.objectives.areObjectivesComplete(
                currentStep.objectives,
                progress,
                gameContext
            );
            if (!complete) {
                throw new Error('Objectives not complete');
            }
        }

        // Give rewards
        if (currentStep.rewards) {
            await this.rewards.giveRewards(currentStep.rewards, characterId, gameContext);
        }

        // Cleanup current step
        if (currentStep.objectives) {
            await this.objectives.cleanupObjectives(currentStep.objectives, progress, progress.currentStep, gameContext);
        }

        // Move to next step
        const nextStep = progress.currentStep + 1;

        if (nextStep >= quest.steps.length) {
            // Quest complete!
            await this.completeQuest(characterId, questId, gameContext);
        } else {
            // Advance to next step
            progress.currentStep = nextStep;
            progress.objectiveProgress = {}; // Reset objectives
            await this.saveProgress(progress);

            // Initialize next step
            if (quest.steps[nextStep]?.objectives) {
                await this.objectives.initializeObjectives(quest.steps[nextStep].objectives, progress, gameContext);
            }

            // Emit event
            await this.context.events.emit('quest.step_advanced', {
                characterId,
                questId,
                step: nextStep
            });
        }
    }

    /**
     * Complete quest
     */
    private async completeQuest(
        characterId: number | string,
        questId: string,
        gameContext: any
    ): Promise<void> {
        await this.context.db.execute(`
            UPDATE ${this.config.tableName}
            SET status = 'completed',
                completed_at = NOW(),
                last_completed = NOW(),
                completion_count = completion_count + 1
            WHERE ${this.config.characterIdField} = ? AND quest_id = ?
        `, [characterId, questId]);

        // Emit event
        await this.context.events.emit('quest.completed', {
            characterId,
            questId
        });
    }

    /**
     * Abandon quest
     */
    async abandonQuest(characterId: number | string, questId: string): Promise<void> {
        await this.context.db.execute(`
            UPDATE ${this.config.tableName}
            SET status = 'abandoned'
            WHERE ${this.config.characterIdField} = ? AND quest_id = ?
        `, [characterId, questId]);

        await this.context.events.emit('quest.abandoned', {
            characterId,
            questId
        });
    }

    /**
     * Check if quest is on cooldown
     */
    private isOnCooldown(quest: QuestDefinition, progress: QuestProgress): boolean {
        if (!progress.lastCompleted) return false;

        const now = new Date();
        const lastCompleted = new Date(progress.lastCompleted);

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
            const cooldownEnd = new Date(lastCompleted.getTime() + (quest.cooldown_seconds * 1000));
            return now < cooldownEnd;
        }

        return false;
    }

    /**
     * Check prerequisites (calls game-provided callback)
     */
    private async checkPrerequisites(
        quest: QuestDefinition,
        characterId: number | string,
        gameContext: any
    ): Promise<boolean> {
        // Emit event - game handles prerequisite checking
        const result = await this.context.events.emit('quest.check_prerequisites', {
            quest,
            characterId,
            gameContext
        });

        // EventEmitter returns boolean, not array
        // If no listeners, assume prerequisites are met
        // Game modules can listen and throw errors if prerequisites fail
        return true;
    }

    /**
     * Save progress to database
     */
    private async saveProgress(progress: QuestProgress): Promise<void> {
        await this.context.db.execute(`
            UPDATE ${this.config.tableName}
            SET current_step = ?,
                objective_progress = ?,
                custom = ?
            WHERE ${this.config.characterIdField} = ? AND quest_id = ?
        `, [
            progress.currentStep,
            JSON.stringify(progress.objectiveProgress),
            JSON.stringify(progress.custom || {}),
            progress.characterId,
            progress.questId
        ]);
    }
}
