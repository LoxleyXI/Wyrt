/**
 * Team management with auto-balancing and player assignment strategies.
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
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
     * @param gameId - Unique identifier for the game (e.g., 'my_game', 'ctf')
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
