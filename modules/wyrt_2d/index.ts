/**
 * 2D position tracking and synchronization for multiplayer games.
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
import { PositionManager } from './systems/PositionManager';

export default class Wyrt2DModule implements IModule {
    name = 'wyrt_2d';
    version = '1.0.0';
    description = '2D multiplayer position tracking and synchronization';
    dependencies: string[] = [];

    private positionManagers: Map<string, PositionManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        context.logger.info('[wyrt_2d] Initialized');
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.info('[wyrt_2d] 2D position tracking active');
    }

    async deactivate(context: ModuleContext): Promise<void> {
        this.positionManagers.clear();
        context.logger.info('[wyrt_2d] 2D position tracking deactivated');
    }

    createPositionManager(gameId: string): PositionManager {
        if (this.positionManagers.has(gameId)) {
            throw new Error(`PositionManager for game '${gameId}' already exists`);
        }

        const manager = new PositionManager();
        this.positionManagers.set(gameId, manager);
        console.log(`[wyrt_2d] Created position manager for game: ${gameId}`);
        return manager;
    }

    getPositionManager(gameId: string): PositionManager {
        const manager = this.positionManagers.get(gameId);
        if (!manager) {
            throw new Error(`PositionManager for game '${gameId}' not found. Did you call createPositionManager()?`);
        }
        return manager;
    }
}

// Re-export types for convenience
export * from './types/Position2D';
export { PositionManager } from './systems/PositionManager';
