/**
 * @module wyrt_teams
 * @description Team management with auto-balancing and player assignment
 * @category Multiplayer
 *
 * @features
 * - Automatic team balancing
 * - Multiple assignment strategies (round-robin, smallest team, random)
 * - Team size limits
 * - Team switching with cooldowns
 * - Score tracking per team
 * - Team-based event broadcasting
 *
 * @usage
 * ```typescript
 * // In your game module's initialize():
 * const teamsModule = context.getModule('wyrt_teams');
 * this.teamManager = teamsModule.createTeamManager('my_game');
 *
 * // Create teams
 * this.teamManager.createTeam('red', { maxSize: 8 });
 * this.teamManager.createTeam('blue', { maxSize: 8 });
 *
 * // Auto-assign player to smallest team
 * const team = this.teamManager.assignPlayer(playerId, 'smallest');
 *
 * // Get player's team
 * const playerTeam = this.teamManager.getPlayerTeam(playerId);
 * ```
 *
 * @exports TeamManager - Main team management class
 */

import { IModule, ModuleContext } from '../../../src/module/IModule';
import { TeamManager } from './systems/TeamManager';

export default class WyrtTeamsModule implements IModule {
    name = 'wyrt_teams';
    version = '1.0.0';
    description = 'Generic team management system';
    dependencies = [];

    private context?: ModuleContext;
    private teamManagers: Map<string, TeamManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        console.log(`[${this.name}] Initialized`);
    }

    async activate(): Promise<void> {
        console.log(`[${this.name}] Module activated`);
        console.log(`[${this.name}] Team management system ready`);
    }

    async deactivate(): Promise<void> {
        this.teamManagers.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Create a new team manager for a specific game
     *
     * @param gameId - Unique identifier for the game (e.g., 'my_game', 'battle_arena')
     * @returns The created team manager
     */
    createTeamManager(gameId: string): TeamManager {
        if (this.teamManagers.has(gameId)) {
            throw new Error(`TeamManager for game '${gameId}' already exists`);
        }

        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const manager = new TeamManager(this.context);
        this.teamManagers.set(gameId, manager);

        console.log(`[${this.name}] Created team manager for game: ${gameId}`);
        return manager;
    }

    /**
     * Get a team manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The team manager for that game
     */
    getTeamManager(gameId: string): TeamManager {
        const manager = this.teamManagers.get(gameId);
        if (!manager) {
            throw new Error(`TeamManager for game '${gameId}' not found. Did you call createTeamManager()?`);
        }
        return manager;
    }
}
