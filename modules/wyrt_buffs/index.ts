/**
 * WYRT BUFFS MODULE
 *
 * Generic buff/debuff system for multiplayer games.
 *
 * PROVIDES:
 * - BuffManager class
 * - Temporary status effects
 * - Duration-based timers
 * - Stack management
 * - Apply/expire callbacks
 * - Event-driven architecture
 *
 * USAGE IN OTHER MODULES:
 * ```typescript
 * const buffManager = context.getModule('wyrt_buffs').getBuffManager();
 *
 * // Apply buff
 * buffManager.applyBuff(playerId, {
 *     type: 'speed',
 *     duration: 10000,
 *     modifiers: { moveSpeed: 1.5 },
 *     onApply: (targetId, buff) => {
 *         // Increase speed
 *     },
 *     onExpire: (targetId, buff) => {
 *         // Restore speed
 *     }
 * });
 *
 * // Check buff
 * if (buffManager.hasBuff(playerId, 'shield')) {
 *     // Player is shielded
 * }
 * ```
 *
 * EVENTS:
 * - wyrt:buffApplied
 * - wyrt:buffExpired
 * - wyrt:buffStacked
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
import { BuffManager } from './systems/BuffManager';

export default class WyrtBuffsModule implements IModule {
    name = 'wyrt_buffs';
    version = '1.0.0';
    description = 'Generic buff/debuff system';
    dependencies = [];

    private context?: ModuleContext;
    private buffManager?: BuffManager;
    private updateInterval?: NodeJS.Timeout;

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;

        // Create buff manager
        this.buffManager = new BuffManager(context);

        // Store globally for easy access
        (globalThis as any).wyrtBuffManager = this.buffManager;

        console.log(`[${this.name}] Initialized`);
    }

    async activate(): Promise<void> {
        // Start update loop (check expirations every second)
        this.updateInterval = setInterval(() => {
            this.buffManager?.update();
        }, 1000);

        console.log(`[${this.name}] Module activated`);
        console.log(`[${this.name}] Buff system ready`);
    }

    async deactivate(): Promise<void> {
        // Stop update loop
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Cleanup buff manager
        this.buffManager?.destroy();

        delete (globalThis as any).wyrtBuffManager;
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Get the buff manager instance
     */
    getBuffManager(): BuffManager {
        if (!this.buffManager) {
            throw new Error('BuffManager not initialized');
        }
        return this.buffManager;
    }
}
