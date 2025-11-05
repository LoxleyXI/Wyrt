/**
 * WYRT_MOBS MODULE
 *
 * Generic NPC/enemy system for Wyrt games.
 *
 * Provides:
 * - MobManager for spawning, combat, AI, and respawning
 * - Mob data loaders (YAML support)
 * - Type definitions for mob templates and instances
 *
 * Used by: Ironwood and any game that needs NPCs/enemies
 *
 * NOTE: This is a library module - it doesn't run on its own.
 * Game modules instantiate MobManager with their own mob templates and callbacks.
 */

import { IModule, ModuleContext } from '../../src/module/IModule';

export default class WyrtMobsModule implements IModule {
    name = 'wyrt_mobs';
    version = '1.0.0';
    description = 'Generic NPC/enemy system with AI, spawning, and combat';
    dependencies = ['wyrt_2d'];

    async initialize(context: ModuleContext): Promise<void> {
        context.logger.info('[wyrt_mobs] Mob system library loaded');
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.info('[wyrt_mobs] Mob system ready for use');
    }

    async deactivate(context: ModuleContext): Promise<void> {
        context.logger.info('[wyrt_mobs] Mob system deactivated');
    }
}

// Re-export for game modules
export * from './types/Mob';
export { MobManager } from './systems/MobManager';
export { loadMobTemplates, loadMobTemplateFile } from './loaders/mobs';
