//----------------------------------
// Wyrt - An MMO Engine
//----------------------------------
// Copyright (c) 2025 LoxleyXI
//
// https://github.com/LoxleyXI/Wyrt
//----------------------------------
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see http://www.gnu.org/licenses/
//----------------------------------
import { Data } from "../types/Data";

/**
 * YAML-based data loader interface
 * Used for loading game data from YAML files
 */
export interface DataLoader {
    load(obj: Data, path: string): Promise<boolean> | boolean;
    validate?(data: any): boolean;
}

/**
 * Database-driven data loader interface
 * Used for loading game data from SQL databases via Prisma or other ORMs
 *
 * @template T The type of data being loaded (e.g., Item, Mob, Recipe)
 *
 * @example
 * \`\`\`typescript
 * const itemLoader: DatabaseLoader<Item> = {
 *   async loadFromDatabase(db: PrismaClient): Promise<Item[]> {
 *     return await db.item.findMany({ include: { stats: true } });
 *   },
 *   getId(item: Item): number {
 *     return item.id;
 *   }
 * };
 * \`\`\`
 */
export interface DatabaseLoader<T = any> {
    /**
     * Load data from database
     * @param db Database client (PrismaClient, TypeORM connection, etc.)
     * @returns Array of loaded data items
     */
    loadFromDatabase(db: any): Promise<T[]>;

    /**
     * Extract unique identifier from data item
     * Used to store items in context.data with IDs as keys
     * @param item The data item
     * @returns Unique identifier (number or string)
     */
    getId(item: T): number | string;

    /**
     * Optional validation function
     * @param data The data to validate
     * @returns True if valid, false otherwise
     */
    validate?(data: T): boolean;
}

/**
 * Type guard to check if a loader is a database loader
 */
function isDatabaseLoader(loader: any): loader is DatabaseLoader {
    return loader && typeof loader.loadFromDatabase === 'function' && typeof loader.getId === 'function';
}

/**
 * Type guard to check if a loader is a YAML loader
 */
function isYamlLoader(loader: any): loader is DataLoader {
    return loader && typeof loader.load === 'function';
}

export class ModuleData extends Data {
    private moduleLoaders: Map<string, DataLoader | DatabaseLoader> = new Map();
    private moduleDataTypes: Map<string, string[]> = new Map();

    /**
     * Register a data loader (YAML or Database)
     * @param dataType Type of data (e.g., 'item', 'mob', 'recipe')
     * @param loader DataLoader (YAML) or DatabaseLoader instance
     * @param fileExtensions File extensions for YAML loaders (ignored for database loaders)
     */
    registerLoader(dataType: string, loader: DataLoader | DatabaseLoader, fileExtensions: string[] = ['.yaml', '.yml']): void {
        this.moduleLoaders.set(dataType, loader);
        if (isYamlLoader(loader)) {
            this.moduleDataTypes.set(dataType, fileExtensions);
        } else {
            // Database loaders don't use file extensions
            this.moduleDataTypes.set(dataType, []);
        }
    }

    getLoader(dataType: string): DataLoader | DatabaseLoader | undefined {
        return this.moduleLoaders.get(dataType);
    }

    getSupportedExtensions(dataType: string): string[] {
        return this.moduleDataTypes.get(dataType) || ['.yaml', '.yml'];
    }

    getAllLoaders(): Map<string, DataLoader | DatabaseLoader> {
        return new Map(this.moduleLoaders);
    }

    /**
     * Check if a loader is a database loader
     */
    isDatabaseLoader(dataType: string): boolean {
        const loader = this.moduleLoaders.get(dataType);
        return loader ? isDatabaseLoader(loader) : false;
    }

    /**
     * Check if a loader is a YAML loader
     */
    isYamlLoader(dataType: string): boolean {
        const loader = this.moduleLoaders.get(dataType);
        return loader ? isYamlLoader(loader) : false;
    }
}
