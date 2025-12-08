/**
 * Objective Registry for Wyrt Quest System
 *
 * Manages pluggable objective handlers.
 * Games register handlers for custom objective types (kill, collect, craft, etc.)
 */

import { ObjectiveHandler } from '../types/Objective';
import { QuestObjective, QuestProgress } from '../types/Quest';

export class ObjectiveRegistry {
    private handlers: Map<string, ObjectiveHandler> = new Map();

    /**
     * Register an objective type handler
     *
     * @param handler - Objective handler implementation
     * @throws Error if type already registered
     */
    register(handler: ObjectiveHandler): void {
        if (this.handlers.has(handler.type)) {
            throw new Error(`Objective type already registered: ${handler.type}`);
        }
        this.handlers.set(handler.type, handler);
    }

    /**
     * Get handler for objective type
     *
     * @param type - Objective type (e.g., 'kill', 'collect')
     * @returns Handler or undefined if not found
     */
    getHandler(type: string): ObjectiveHandler | undefined {
        return this.handlers.get(type);
    }

    /**
     * Check if all objectives in a list are complete
     *
     * @param objectives - List of quest objectives
     * @param progress - Quest progress
     * @param gameContext - Game module instance
     * @returns true if all objectives complete
     */
    async areObjectivesComplete(
        objectives: QuestObjective[],
        progress: QuestProgress,
        gameContext: any
    ): Promise<boolean> {
        for (const objective of objectives) {
            const handler = this.getHandler(objective.type);
            if (!handler) {
                throw new Error(`No handler for objective type: ${objective.type}`);
            }

            const complete = await handler.isComplete(objective, progress, gameContext);
            if (!complete) {
                return false;
            }
        }
        return true;
    }

    /**
     * Update progress for a specific objective type
     *
     * Called when game events occur (mob killed, item collected, etc.)
     *
     * @param objectiveType - Type of objective to update
     * @param objectives - List of quest objectives
     * @param progress - Quest progress (will be modified)
     * @param eventData - Event-specific data
     * @param gameContext - Game module instance
     * @returns true if any objective was updated
     */
    async updateObjectiveProgress(
        objectiveType: string,
        objectives: QuestObjective[],
        progress: QuestProgress,
        eventData: any,
        gameContext: any
    ): Promise<boolean> {
        const handler = this.getHandler(objectiveType);
        if (!handler) {
            return false; // No handler for this type
        }

        let updated = false;
        for (const objective of objectives) {
            if (objective.type === objectiveType) {
                const changed = await handler.updateProgress(
                    objective,
                    progress,
                    eventData,
                    gameContext
                );
                if (changed) updated = true;
            }
        }

        return updated;
    }

    /**
     * Initialize all objectives in a list
     *
     * Called when quest step starts
     *
     * @param objectives - List of quest objectives
     * @param progress - Quest progress
     * @param gameContext - Game module instance
     */
    async initializeObjectives(
        objectives: QuestObjective[],
        progress: QuestProgress,
        gameContext: any
    ): Promise<void> {
        for (const objective of objectives) {
            const handler = this.getHandler(objective.type);
            if (handler?.initialize) {
                await handler.initialize(objective, progress, gameContext);
            }
        }
    }

    /**
     * Cleanup all objectives in a list
     *
     * Called when quest step ends
     *
     * @param objectives - List of quest objectives
     * @param progress - Quest progress
     * @param gameContext - Game module instance
     */
    async cleanupObjectives(
        objectives: QuestObjective[],
        progress: QuestProgress,
        gameContext: any
    ): Promise<void> {
        for (const objective of objectives) {
            const handler = this.getHandler(objective.type);
            if (handler?.cleanup) {
                await handler.cleanup(objective, progress, gameContext);
            }
        }
    }
}
