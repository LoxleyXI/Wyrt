/**
 * Mob Data Loader
 *
 * Loads mob templates from YAML files.
 * Games can use this to load their mob definitions.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { MobTemplate } from '../types/Mob';

/**
 * Load mob templates from a directory
 */
export function loadMobTemplates(mobDataPath: string): Record<string, MobTemplate> {
    const templates: Record<string, MobTemplate> = {};

    if (!fs.existsSync(mobDataPath)) {
        console.warn(`[MobLoader] Mob data path does not exist: ${mobDataPath}`);
        return templates;
    }

    const files = fs.readdirSync(mobDataPath);

    for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
            const filePath = path.join(mobDataPath, file);
            try {
                const fileContents = fs.readFileSync(filePath, 'utf8');
                const data = yaml.load(fileContents) as Record<string, MobTemplate>;

                // Merge into templates
                Object.assign(templates, data);
            } catch (error) {
                console.error(`[MobLoader] Error loading ${file}:`, error);
            }
        }
    }

    return templates;
}

/**
 * Load a single mob template file
 */
export function loadMobTemplateFile(filePath: string): Record<string, MobTemplate> {
    try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const data = yaml.load(fileContents) as Record<string, MobTemplate>;
        return data;
    } catch (error) {
        console.error(`[MobLoader] Error loading ${filePath}:`, error);
        return {};
    }
}
