/**
 * WYRT_2D MODULE
 *
 * 2D multiplayer position tracking and synchronization for Wyrt games.
 *
 * Provides:
 * - Common 2D position/direction types
 * - PositionManager for centralized position tracking
 * - Utility functions for distance, direction, and range calculations
 * - Room-based position grouping
 *
 * Used by: Ironwood, wyrt_ctf, and other 2D games
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
import { PositionManager } from './systems/PositionManager';

export default class Wyrt2DModule implements IModule {
    name = 'wyrt_2d';
    version = '1.0.0';
    description = '2D multiplayer position tracking and synchronization';
    dependencies: string[] = [];

    private positionManager?: PositionManager;

    async initialize(context: ModuleContext): Promise<void> {
        this.positionManager = new PositionManager();
        context.logger.info('[wyrt_2d] Position Manager initialized');
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.info('[wyrt_2d] 2D position tracking active');
    }

    async deactivate(context: ModuleContext): Promise<void> {
        context.logger.info('[wyrt_2d] 2D position tracking deactivated');
    }

    // Public API for other modules
    getPositionManager(): PositionManager {
        if (!this.positionManager) {
            throw new Error('[wyrt_2d] PositionManager not initialized');
        }
        return this.positionManager;
    }
}

// Re-export types for convenience
export * from './types/Position2D';
export { PositionManager } from './systems/PositionManager';
