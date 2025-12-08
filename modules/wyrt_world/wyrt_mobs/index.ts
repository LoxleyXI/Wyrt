/**
 * @module wyrt_mobs
 * @description Generic NPC/enemy system with AI, spawning, and combat integration
 * @category World
 *
 * @features
 * - YAML-based mob definitions
 * - Spawn point management with respawn timers
 * - Basic AI behaviors (idle, patrol, chase, attack)
 * - Aggro range and leashing
 * - Loot table integration
 * - Health/damage synchronization
 * - Death and respawn events
 *
 * @usage
 * ```typescript
 * // In your game module's initialize():
 * import { MobManager, loadMobTemplates } from 'wyrt_mobs';
 *
 * // Load mob definitions
 * const templates = await loadMobTemplates('./data/mobs/');
 *
 * // Create manager with templates
 * this.mobManager = new MobManager(context, templates, {
 *   onMobDeath: (mob, killer) => { /* handle death */ }
 * });
 *
 * // Spawn a mob
 * const mob = this.mobManager.spawn('goblin', roomId, { x: 100, y: 200 });
 * ```
 *
 * @exports MobManager - Main mob management class
 * @exports Mob - Mob instance type
 * @exports loadMobTemplates - YAML loader for mob definitions
 * @dependencies wyrt_2d
 */

import { IModule, ModuleContext } from '../../../src/module/IModule';

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
