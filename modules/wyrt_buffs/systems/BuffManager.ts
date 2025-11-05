/**
 * BUFF MANAGER - Generic Buff/Debuff System
 *
 * A reusable system for temporary status effects in games.
 *
 * FEATURES:
 * - Apply buffs with duration
 * - Stack management (stackable vs unique)
 * - Automatic expiration
 * - Apply/expire callbacks
 * - Tick callbacks (for DoT, HoT, etc.)
 * - Query active buffs
 *
 * USAGE EXAMPLE:
 * ```typescript
 * const buffManager = new BuffManager(context);
 *
 * // Apply speed boost
 * buffManager.applyBuff('player_123', {
 *     type: 'speed',
 *     category: 'buff',
 *     duration: 10000,
 *     modifiers: { moveSpeed: 1.5 },
 *     onApply: (targetId, buff) => {
 *         player.moveSpeed *= 1.5;
 *     },
 *     onExpire: (targetId, buff) => {
 *         player.moveSpeed /= 1.5;
 *     }
 * });
 *
 * // Check if buffed
 * if (buffManager.hasBuff('player_123', 'speed')) {
 *     // Player is fast
 * }
 * ```
 *
 * EVENTS EMITTED:
 * - wyrt:buffApplied { buffId, buffType, targetId }
 * - wyrt:buffExpired { buffId, buffType, targetId }
 * - wyrt:buffStacked { buffId, buffType, targetId, stacks }
 */

import { ModuleContext } from '../../../src/module/IModule';
import { Buff, BuffConfig, BuffType, BuffResult, BuffExpiredEvent } from '../types/BuffTypes';

export class BuffManager {
    private context: ModuleContext;
    private buffs: Map<string, Buff>;  // buffId -> buff
    private targetBuffs: Map<string, Set<string>>;  // targetId -> Set<buffId>
    private nextBuffId: number = 0;
    private tickInterval?: NodeJS.Timeout;

    constructor(context: ModuleContext) {
        this.context = context;
        this.buffs = new Map();
        this.targetBuffs = new Map();

        // Start tick system (for DoT, HoT, etc.)
        this.tickInterval = setInterval(() => this.tick(), 1000);
    }

    /**
     * Apply a buff to a target
     *
     * @param targetId - Entity receiving the buff
     * @param config - Buff configuration
     * @returns Result with buff instance if successful
     */
    applyBuff(targetId: string, config: BuffConfig): BuffResult {
        const now = Date.now();

        // Check for existing buff of same type
        const existing = this.getBuffByType(targetId, config.type);

        if (existing) {
            // Not stackable - refresh duration
            if (!config.stackable) {
                existing.appliedAt = now;
                existing.expiresAt = config.duration > 0 ? now + config.duration : null;

                console.log(`[BuffManager] Refreshed ${config.type} on ${targetId}`);

                return {
                    success: true,
                    buff: existing,
                    message: 'Buff refreshed'
                };
            }

            // Stackable - check max stacks
            if (config.maxStacks && existing.stacks >= config.maxStacks) {
                return {
                    success: false,
                    message: 'Max stacks reached'
                };
            }

            // Add stack
            existing.stacks++;

            // Emit stack event
            this.context.events.emit('wyrt:buffStacked', {
                buffId: existing.id,
                buffType: config.type,
                targetId,
                stacks: existing.stacks
            });

            console.log(`[BuffManager] Stacked ${config.type} on ${targetId} (${existing.stacks} stacks)`);

            return {
                success: true,
                buff: existing,
                message: 'Buff stacked'
            };
        }

        // Create new buff
        const buffId = `buff_${this.nextBuffId++}`;

        const buff: Buff = {
            id: buffId,
            targetId,
            ...config,
            category: config.category || 'neutral',
            stackable: config.stackable || false,
            maxStacks: config.maxStacks || 1,
            appliedAt: now,
            expiresAt: config.duration > 0 ? now + config.duration : null,
            stacks: 1
        };

        this.buffs.set(buffId, buff);

        // Track target's buffs
        if (!this.targetBuffs.has(targetId)) {
            this.targetBuffs.set(targetId, new Set());
        }
        this.targetBuffs.get(targetId)!.add(buffId);

        // Call onApply callback
        if (buff.onApply) {
            buff.onApply(targetId, buff);
        }

        // Emit event
        this.context.events.emit('wyrt:buffApplied', {
            buffId,
            buffType: config.type,
            targetId,
            duration: config.duration
        });

        console.log(`[BuffManager] Applied ${config.type} to ${targetId} for ${config.duration}ms`);

        return {
            success: true,
            buff,
            message: 'Buff applied'
        };
    }

    /**
     * Remove a specific buff
     *
     * @param buffId - Buff ID to remove
     * @param callExpireCallback - Whether to call onExpire (default: true)
     */
    removeBuff(buffId: string, callExpireCallback: boolean = true): boolean {
        const buff = this.buffs.get(buffId);
        if (!buff) return false;

        // Call onExpire callback
        if (callExpireCallback && buff.onExpire) {
            buff.onExpire(buff.targetId, buff);
        }

        // Remove from maps
        this.buffs.delete(buffId);

        const targetBuffSet = this.targetBuffs.get(buff.targetId);
        if (targetBuffSet) {
            targetBuffSet.delete(buffId);
            if (targetBuffSet.size === 0) {
                this.targetBuffs.delete(buff.targetId);
            }
        }

        // Emit event
        this.context.events.emit('wyrt:buffExpired', {
            buffId,
            buffType: buff.type,
            targetId: buff.targetId,
            timestamp: Date.now()
        });

        console.log(`[BuffManager] Removed ${buff.type} from ${buff.targetId}`);

        return true;
    }

    /**
     * Remove all buffs of a type from a target
     */
    removeBuffsByType(targetId: string, buffType: BuffType): number {
        const buffsToRemove: string[] = [];

        for (const buff of this.buffs.values()) {
            if (buff.targetId === targetId && buff.type === buffType) {
                buffsToRemove.push(buff.id);
            }
        }

        buffsToRemove.forEach(id => this.removeBuff(id));

        return buffsToRemove.length;
    }

    /**
     * Remove all buffs from a target
     */
    removeAllBuffs(targetId: string): number {
        const buffSet = this.targetBuffs.get(targetId);
        if (!buffSet) return 0;

        const buffsToRemove = Array.from(buffSet);
        buffsToRemove.forEach(id => this.removeBuff(id));

        return buffsToRemove.length;
    }

    /**
     * Check if target has a specific buff type
     */
    hasBuff(targetId: string, buffType: BuffType): boolean {
        return this.getBuffByType(targetId, buffType) !== null;
    }

    /**
     * Get a specific buff by type
     */
    getBuffByType(targetId: string, buffType: BuffType): Buff | null {
        const buffSet = this.targetBuffs.get(targetId);
        if (!buffSet) return null;

        for (const buffId of buffSet) {
            const buff = this.buffs.get(buffId);
            if (buff && buff.type === buffType) {
                return buff;
            }
        }

        return null;
    }

    /**
     * Get all buffs on a target
     */
    getBuffs(targetId: string): Buff[] {
        const buffSet = this.targetBuffs.get(targetId);
        if (!buffSet) return [];

        const result: Buff[] = [];
        for (const buffId of buffSet) {
            const buff = this.buffs.get(buffId);
            if (buff) result.push(buff);
        }

        return result;
    }

    /**
     * Get buffs by category
     */
    getBuffsByCategory(targetId: string, category: 'buff' | 'debuff' | 'neutral'): Buff[] {
        return this.getBuffs(targetId).filter(b => b.category === category);
    }

    /**
     * Update buff system (check expirations)
     *
     * Call this periodically or in game loop.
     *
     * @returns Array of expired buffs
     */
    update(): BuffExpiredEvent[] {
        const now = Date.now();
        const expired: BuffExpiredEvent[] = [];
        const toRemove: string[] = [];

        for (const buff of this.buffs.values()) {
            // Check expiration
            if (buff.expiresAt && now >= buff.expiresAt) {
                expired.push({
                    buffId: buff.id,
                    buffType: buff.type,
                    targetId: buff.targetId,
                    timestamp: now
                });

                toRemove.push(buff.id);
            }
        }

        // Remove expired buffs
        toRemove.forEach(id => this.removeBuff(id));

        return expired;
    }

    /**
     * Tick system (called every second for DoT/HoT effects)
     */
    private tick(): void {
        for (const buff of this.buffs.values()) {
            if (buff.onTick) {
                buff.onTick(buff.targetId, buff);
            }
        }
    }

    /**
     * Stop the tick system (cleanup)
     */
    destroy(): void {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
        }
    }

    /**
     * Get total buff count
     */
    getBuffCount(): number {
        return this.buffs.size;
    }

    /**
     * Clear all buffs
     */
    clearAll(): void {
        this.buffs.clear();
        this.targetBuffs.clear();
        console.log('[BuffManager] Cleared all buffs');
    }
}
