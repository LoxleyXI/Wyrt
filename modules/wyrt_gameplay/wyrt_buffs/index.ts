/**
 * @module wyrt_buffs
 * @description Buff/debuff system with duration timers and stat modifiers
 * @category Gameplay
 *
 * @features
 * - Timed buffs with automatic expiration
 * - Stackable and non-stackable buff types
 * - Stat modifiers (additive and multiplicative)
 * - Buff refresh and extend mechanics
 * - On-apply/on-expire callbacks
 * - Periodic tick effects (DoT, HoT)
 *
 * @usage
 * ```typescript
 * // In your game module's initialize():
 * const buffsModule = context.getModule('wyrt_buffs');
 * this.buffManager = buffsModule.createBuffManager('my_game');
 *
 * // Apply a buff
 * this.buffManager.applyBuff(playerId, {
 *   id: 'strength_potion',
 *   duration: 30000, // 30 seconds
 *   stats: { strength: 10 },
 *   stackable: false
 * });
 *
 * // Check active buffs
 * const buffs = this.buffManager.getActiveBuffs(playerId);
 *
 * // Remove a buff early
 * this.buffManager.removeBuff(playerId, 'strength_potion');
 * ```
 *
 * @exports BuffManager - Main buff management class
 */

import { IModule, ModuleContext } from '../../../src/module/IModule';
import { BuffManager } from './systems/BuffManager';

export default class WyrtBuffsModule implements IModule {
    name = 'wyrt_buffs';
    version = '1.0.0';
    description = 'Generic buff/debuff system';
    dependencies = [];

    private context?: ModuleContext;
    private buffManagers: Map<string, BuffManager> = new Map();
    private updateInterval?: NodeJS.Timeout;

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        console.log(`[${this.name}] Initialized`);
    }

    async activate(): Promise<void> {
        this.updateInterval = setInterval(() => {
            for (const manager of this.buffManagers.values()) {
                manager.update();
            }
        }, 1000);

        console.log(`[${this.name}] Module activated`);
        console.log(`[${this.name}] Buff system ready`);
    }

    async deactivate(): Promise<void> {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        for (const manager of this.buffManagers.values()) {
            manager.destroy();
        }

        this.buffManagers.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    createBuffManager(gameId: string): BuffManager {
        if (this.buffManagers.has(gameId)) {
            throw new Error(`BuffManager for game '${gameId}' already exists`);
        }

        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const manager = new BuffManager(this.context);
        this.buffManagers.set(gameId, manager);

        console.log(`[${this.name}] Created buff manager for game: ${gameId}`);
        return manager;
    }

    getBuffManager(gameId: string): BuffManager {
        const manager = this.buffManagers.get(gameId);
        if (!manager) {
            throw new Error(`BuffManager for game '${gameId}' not found. Did you call createBuffManager()?`);
        }
        return manager;
    }
}
