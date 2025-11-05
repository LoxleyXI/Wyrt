/**
 * WYRT TEAMS MODULE
 *
 * Generic team management system for multiplayer games.
 *
 * PROVIDES:
 * - TeamManager class (accessible via context)
 * - Team creation and removal
 * - Player assignment with multiple strategies
 * - Team-based queries (friendly, enemy, teammates)
 * - Team statistics and scoring
 *
 * USAGE IN OTHER MODULES:
 * ```typescript
 * const teamManager = context.getModule('wyrt_teams').getTeamManager();
 *
 * // Create teams
 * teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000' });
 *
 * // Assign players
 * const teamId = teamManager.assignPlayer(playerId, { mode: 'auto-balance' });
 *
 * // Check relationships
 * if (teamManager.isFriendly(player1, player2)) {
 *     // Same team
 * }
 * ```
 *
 * EVENTS:
 * - wyrt:teamCreated
 * - wyrt:teamRemoved
 * - wyrt:playerAssigned
 * - wyrt:playerRemoved
 */

import { IModule, ModuleContext } from '../../src/module/IModule';
import { TeamManager } from './systems/TeamManager';

export default class WyrtTeamsModule implements IModule {
    name = 'wyrt_teams';
    version = '1.0.0';
    description = 'Generic team management system';
    dependencies = [];

    private context?: ModuleContext;
    private teamManager?: TeamManager;

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;

        // Create team manager
        this.teamManager = new TeamManager(context);

        // Store globally for easy access
        (globalThis as any).wyrtTeamManager = this.teamManager;

        console.log(`[${this.name}] Initialized`);
    }

    async activate(): Promise<void> {
        console.log(`[${this.name}] Module activated`);
        console.log(`[${this.name}] Team management system ready`);
    }

    async deactivate(): Promise<void> {
        delete (globalThis as any).wyrtTeamManager;
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Get the team manager instance
     *
     * This allows other modules to access the team manager via:
     * context.getModule('wyrt_teams').getTeamManager()
     */
    getTeamManager(): TeamManager {
        if (!this.teamManager) {
            throw new Error('TeamManager not initialized');
        }
        return this.teamManager;
    }
}
