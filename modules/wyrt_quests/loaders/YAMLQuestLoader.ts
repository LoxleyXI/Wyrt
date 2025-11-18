/**
 * YAML Quest Loader for Wyrt Quest System
 *
 * Generic YAML quest loader with adapter pattern.
 * Games provide adapters to parse their custom YAML formats.
 */

import * as fs from 'fs/promises';
import * as YAML from 'yaml';
import { QuestDefinition } from '../types/Quest';

/**
 * Adapter interface - games implement this to parse their YAML format
 */
export interface QuestFormatAdapter {
    /**
     * Parse a single quest from raw YAML data
     *
     * @param raw - Raw YAML object for one quest
     * @param gameContext - Game module instance for accessing game systems
     * @returns Quest definition in standard format
     */
    parseQuest(raw: any, gameContext: any): QuestDefinition;
}

/**
 * Generic YAML quest loader with adapter pattern
 *
 * Handles:
 * - File I/O
 * - YAML parsing
 * - Error handling
 * - Validation
 *
 * Delegates format interpretation to game-provided adapter
 */
export class YAMLQuestLoader {
    private adapter: QuestFormatAdapter;

    constructor(adapter: QuestFormatAdapter) {
        this.adapter = adapter;
    }

    /**
     * Load quests from YAML file
     *
     * @param filePath - Absolute path to YAML file
     * @param gameContext - Game module instance
     * @returns Array of quest definitions
     * @throws Error if file not found, invalid YAML, or parsing fails
     */
    async loadQuests(filePath: string, gameContext: any): Promise<QuestDefinition[]> {
        try {
            // Read file
            const yamlContent = await fs.readFile(filePath, 'utf-8');

            // Parse YAML
            const data = YAML.parse(yamlContent);

            // Validate structure
            if (!data || typeof data !== 'object') {
                throw new Error(`Invalid YAML structure: expected object, got ${typeof data}`);
            }

            // Support both formats:
            // 1. { quests: [array] }
            // 2. { QuestID: {...}, QuestID2: {...} }
            let questArray: any[];

            if (data.quests && Array.isArray(data.quests)) {
                // Format 1: { quests: [...] }
                questArray = data.quests;
            } else {
                // Format 2: { QuestID: {...} } - convert to array
                questArray = Object.entries(data).map(([id, questData]) => ({
                    id,
                    ...(questData as object)
                }));
            }

            // Parse each quest using adapter
            const quests: QuestDefinition[] = [];

            for (let i = 0; i < questArray.length; i++) {
                const rawQuest = questArray[i];

                try {
                    const quest = this.adapter.parseQuest(rawQuest, gameContext);

                    // Validate required fields
                    this.validateQuest(quest, i);

                    quests.push(quest);
                } catch (err: any) {
                    throw new Error(
                        `Error parsing quest at index ${i} (${rawQuest.id || 'unknown'}): ${err.message}`
                    );
                }
            }

            return quests;

        } catch (err: any) {
            // Provide helpful error messages
            if (err.code === 'ENOENT') {
                throw new Error(`Quest file not found: ${filePath}`);
            }

            if (err.name === 'YAMLParseError') {
                throw new Error(`Invalid YAML syntax in ${filePath}: ${err.message}`);
            }

            throw new Error(`Failed to load quests from ${filePath}: ${err.message}`);
        }
    }

    /**
     * Load quests from multiple files
     *
     * @param filePaths - Array of absolute paths
     * @param gameContext - Game module instance
     * @returns Combined array of quest definitions
     */
    async loadQuestsFromFiles(filePaths: string[], gameContext: any): Promise<QuestDefinition[]> {
        const allQuests: QuestDefinition[] = [];

        for (const filePath of filePaths) {
            const quests = await this.loadQuests(filePath, gameContext);
            allQuests.push(...quests);
        }

        return allQuests;
    }

    /**
     * Validate quest has required fields
     */
    private validateQuest(quest: QuestDefinition, index: number): void {
        if (!quest.id) {
            throw new Error(`Quest at index ${index} is missing 'id' field`);
        }

        if (!quest.name) {
            throw new Error(`Quest '${quest.id}' is missing 'name' field`);
        }

        if (!quest.steps || !Array.isArray(quest.steps) || quest.steps.length === 0) {
            throw new Error(`Quest '${quest.id}' has no steps`);
        }

        // Validate step structure
        for (let i = 0; i < quest.steps.length; i++) {
            const step = quest.steps[i];

            if (!step.id) {
                throw new Error(`Quest '${quest.id}' step ${i} is missing 'id' field`);
            }
        }
    }
}
