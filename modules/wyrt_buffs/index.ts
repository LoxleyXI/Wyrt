/**
 * Generic buff/debuff system with timers and event callbacks.
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
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
