/**
 * WYRT TEAMS MODULE - TYPE DEFINITIONS
 *
 * Generic team management system for multiplayer games.
 *
 * FEATURES:
 * - Support for 2+ teams
 * - Auto-balancing algorithms
 * - Team-based filtering (friendly fire, etc.)
 * - Team statistics
 *
 * USE CASES:
 * - Team Deathmatch
 * - Capture the Flag
 * - MOBA games
 * - Battle Royale squads
 */

/**
 * Unique team identifier
 */
export type TeamId = string;

/**
 * Team configuration
 */
export interface TeamConfig {
    id: TeamId;
    name: string;
    color: string;          // Hex color code (e.g., '#FF0000')
    maxPlayers?: number;    // Null = unlimited
    minPlayers?: number;    // Minimum to start match
}

/**
 * Team data with current state
 */
export interface Team extends TeamConfig {
    playerIds: Set<string>;
    score: number;
    createdAt: number;
}

/**
 * Team assignment mode
 */
export type AssignmentMode =
    | 'auto-balance'  // Assign to team with fewer players
    | 'random'        // Random assignment
    | 'manual'        // Manually specified
    | 'preference';   // Honor player preference if possible

/**
 * Team assignment options
 */
export interface AssignmentOptions {
    mode: AssignmentMode;
    preferredTeam?: TeamId;  // Used with 'preference' or 'manual' mode
}

/**
 * Team statistics
 */
export interface TeamStats {
    teamId: TeamId;
    playerCount: number;
    score: number;
    kills?: number;
    deaths?: number;
    [key: string]: any;  // Extensible for game-specific stats
}

/**
 * Player-team relationship
 */
export interface PlayerTeam {
    playerId: string;
    teamId: TeamId;
    joinedAt: number;
}
