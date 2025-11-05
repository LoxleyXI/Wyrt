/**
 * TEAM MANAGER - Generic Team Management System
 *
 * A reusable system for managing teams in multiplayer games.
 *
 * FEATURES:
 * - Create/remove teams dynamically
 * - Assign players with multiple strategies (auto-balance, random, manual)
 * - Track team sizes and balance
 * - Team-based queries (is friendly, get teammates, etc.)
 * - Team statistics
 *
 * USAGE EXAMPLE:
 * ```typescript
 * const teamManager = new TeamManager(context);
 *
 * // Create teams
 * teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000' });
 * teamManager.createTeam({ id: 'blue', name: 'Blue Team', color: '#0000FF' });
 *
 * // Assign player
 * const teamId = teamManager.assignPlayer('player_123', { mode: 'auto-balance' });
 *
 * // Check relationships
 * if (teamManager.isFriendly('player_1', 'player_2')) {
 *     // Don't apply friendly fire
 * }
 * ```
 *
 * EVENTS EMITTED:
 * - wyrt:teamCreated { team }
 * - wyrt:teamRemoved { teamId }
 * - wyrt:playerAssigned { playerId, teamId }
 * - wyrt:playerRemoved { playerId, teamId }
 */

import { ModuleContext } from '../../../src/module/IModule';
import { Team, TeamConfig, TeamId, AssignmentMode, AssignmentOptions, TeamStats, PlayerTeam } from '../types/TeamTypes';

export class TeamManager {
    private context: ModuleContext;
    private teams: Map<TeamId, Team>;
    private playerTeams: Map<string, TeamId>;  // playerId -> teamId

    constructor(context: ModuleContext) {
        this.context = context;
        this.teams = new Map();
        this.playerTeams = new Map();
    }

    /**
     * Create a new team
     *
     * @param config - Team configuration
     * @returns The created team
     */
    createTeam(config: TeamConfig): Team {
        if (this.teams.has(config.id)) {
            throw new Error(`Team ${config.id} already exists`);
        }

        const team: Team = {
            ...config,
            playerIds: new Set(),
            score: 0,
            createdAt: Date.now()
        };

        this.teams.set(config.id, team);

        // Emit event
        this.context.events.emit('wyrt:teamCreated', { team });

        console.log(`[TeamManager] Created team: ${config.name} (${config.id})`);

        return team;
    }

    /**
     * Remove a team
     *
     * NOTE: This will NOT remove players from the team.
     * Call removePlayer() for each player first if needed.
     */
    removeTeam(teamId: TeamId): boolean {
        const team = this.teams.get(teamId);
        if (!team) return false;

        // Remove all player associations
        for (const playerId of team.playerIds) {
            this.playerTeams.delete(playerId);
        }

        this.teams.delete(teamId);

        // Emit event
        this.context.events.emit('wyrt:teamRemoved', { teamId });

        console.log(`[TeamManager] Removed team: ${teamId}`);

        return true;
    }

    /**
     * Assign a player to a team
     *
     * @param playerId - Player to assign
     * @param options - Assignment strategy
     * @returns The assigned team ID
     */
    assignPlayer(playerId: string, options: AssignmentOptions = { mode: 'auto-balance' }): TeamId {
        // Check if player already on a team
        if (this.playerTeams.has(playerId)) {
            const currentTeam = this.playerTeams.get(playerId)!;
            console.warn(`[TeamManager] Player ${playerId} already on team ${currentTeam}`);
            return currentTeam;
        }

        let teamId: TeamId;

        switch (options.mode) {
            case 'auto-balance':
                teamId = this.getSmallestTeam();
                break;

            case 'random':
                teamId = this.getRandomTeam();
                break;

            case 'manual':
            case 'preference':
                if (!options.preferredTeam) {
                    throw new Error('preferredTeam required for manual/preference mode');
                }
                // For preference mode, fall back to auto-balance if team is full
                if (options.mode === 'preference' && this.isTeamFull(options.preferredTeam)) {
                    teamId = this.getSmallestTeam();
                } else {
                    teamId = options.preferredTeam;
                }
                break;

            default:
                throw new Error(`Unknown assignment mode: ${options.mode}`);
        }

        // Validate team exists
        const team = this.teams.get(teamId);
        if (!team) {
            throw new Error(`Team ${teamId} does not exist`);
        }

        // Check team capacity
        if (team.maxPlayers && team.playerIds.size >= team.maxPlayers) {
            throw new Error(`Team ${teamId} is full`);
        }

        // Assign player
        team.playerIds.add(playerId);
        this.playerTeams.set(playerId, teamId);

        // Emit event
        this.context.events.emit('wyrt:playerAssigned', { playerId, teamId });

        console.log(`[TeamManager] Assigned player ${playerId} to team ${teamId}`);

        return teamId;
    }

    /**
     * Remove a player from their team
     */
    removePlayer(playerId: string): boolean {
        const teamId = this.playerTeams.get(playerId);
        if (!teamId) return false;

        const team = this.teams.get(teamId);
        if (team) {
            team.playerIds.delete(playerId);
        }

        this.playerTeams.delete(playerId);

        // Emit event
        this.context.events.emit('wyrt:playerRemoved', { playerId, teamId });

        console.log(`[TeamManager] Removed player ${playerId} from team ${teamId}`);

        return true;
    }

    /**
     * Get player's current team ID
     */
    getPlayerTeam(playerId: string): TeamId | null {
        return this.playerTeams.get(playerId) || null;
    }

    /**
     * Get all players on a team
     */
    getTeamPlayers(teamId: TeamId): string[] {
        const team = this.teams.get(teamId);
        return team ? Array.from(team.playerIds) : [];
    }

    /**
     * Check if two players are on the same team (friendly)
     */
    isFriendly(playerId1: string, playerId2: string): boolean {
        const team1 = this.playerTeams.get(playerId1);
        const team2 = this.playerTeams.get(playerId2);

        return team1 !== undefined && team1 === team2;
    }

    /**
     * Check if two players are on different teams (enemy)
     */
    isEnemy(playerId1: string, playerId2: string): boolean {
        const team1 = this.playerTeams.get(playerId1);
        const team2 = this.playerTeams.get(playerId2);

        return team1 !== undefined && team2 !== undefined && team1 !== team2;
    }

    /**
     * Get team by ID
     */
    getTeam(teamId: TeamId): Team | null {
        return this.teams.get(teamId) || null;
    }

    /**
     * Get all teams
     */
    getAllTeams(): Team[] {
        return Array.from(this.teams.values());
    }

    /**
     * Get team statistics
     */
    getTeamStats(teamId: TeamId): TeamStats | null {
        const team = this.teams.get(teamId);
        if (!team) return null;

        return {
            teamId: team.id,
            playerCount: team.playerIds.size,
            score: team.score
        };
    }

    /**
     * Get all team statistics
     */
    getAllTeamStats(): TeamStats[] {
        return Array.from(this.teams.values()).map(team => ({
            teamId: team.id,
            playerCount: team.playerIds.size,
            score: team.score
        }));
    }

    /**
     * Check if teams are balanced (difference <= 1 player)
     */
    areTeamsBalanced(): boolean {
        const teams = Array.from(this.teams.values());
        if (teams.length < 2) return true;

        const sizes = teams.map(t => t.playerIds.size);
        const min = Math.min(...sizes);
        const max = Math.max(...sizes);

        return (max - min) <= 1;
    }

    /**
     * Add score to a team
     */
    addScore(teamId: TeamId, points: number): void {
        const team = this.teams.get(teamId);
        if (!team) {
            throw new Error(`Team ${teamId} does not exist`);
        }

        team.score += points;

        console.log(`[TeamManager] Team ${teamId} score: ${team.score}`);
    }

    /**
     * Set team score
     */
    setScore(teamId: TeamId, score: number): void {
        const team = this.teams.get(teamId);
        if (!team) {
            throw new Error(`Team ${teamId} does not exist`);
        }

        team.score = score;
    }

    /**
     * Reset all team scores
     */
    resetScores(): void {
        for (const team of this.teams.values()) {
            team.score = 0;
        }

        console.log('[TeamManager] Reset all team scores');
    }

    // ===== PRIVATE HELPER METHODS =====

    /**
     * Get team ID with smallest player count (for auto-balance)
     */
    private getSmallestTeam(): TeamId {
        if (this.teams.size === 0) {
            throw new Error('No teams available');
        }

        let smallestTeam: Team | null = null;
        let smallestSize = Infinity;

        for (const team of this.teams.values()) {
            const size = team.playerIds.size;

            // Skip full teams
            if (team.maxPlayers && size >= team.maxPlayers) {
                continue;
            }

            if (size < smallestSize) {
                smallestSize = size;
                smallestTeam = team;
            }
        }

        if (!smallestTeam) {
            throw new Error('All teams are full');
        }

        return smallestTeam.id;
    }

    /**
     * Get random team ID
     */
    private getRandomTeam(): TeamId {
        const availableTeams = Array.from(this.teams.values()).filter(
            team => !team.maxPlayers || team.playerIds.size < team.maxPlayers
        );

        if (availableTeams.length === 0) {
            throw new Error('No available teams');
        }

        const randomIndex = Math.floor(Math.random() * availableTeams.length);
        return availableTeams[randomIndex].id;
    }

    /**
     * Check if a team is at max capacity
     */
    private isTeamFull(teamId: TeamId): boolean {
        const team = this.teams.get(teamId);
        if (!team) return true;

        return team.maxPlayers ? team.playerIds.size >= team.maxPlayers : false;
    }
}
