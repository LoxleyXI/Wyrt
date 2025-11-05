/**
 * Flag Manager
 *
 * Handles flag pickup, drop, return, capture, and auto-return logic for CTF game.
 */

import { Flag, CTFPlayer, Team, Position, Score, FlagState } from '../types/CTFTypes';

const FLAG_PICKUP_RANGE = 32;  // pixels
const FLAG_AUTO_RETURN_TIME = 300000;  // 5 minutes (300 seconds)

export class FlagManager {
    private flags: { red: Flag; blue: Flag };
    private scores: Score;

    constructor(flags: { red: Flag; blue: Flag }, scores: Score) {
        this.flags = flags;
        this.scores = scores;
    }

    /**
     * Attempt to pick up a flag
     *
     * VALIDATION:
     * - Player must be within FLAG_PICKUP_RANGE
     * - Can only pick up enemy team's flag
     * - Can't pick up if already carrying a flag
     * - Flag must not already be carried
     *
     * @returns Success status and message
     */
    attemptPickup(player: CTFPlayer, flagTeam: Team): { success: boolean; message: string } {
        const flag = this.flags[flagTeam];

        // Can't pick up your own team's flag (unless returning a dropped flag)
        if (player.team === flagTeam) {
            if (flag.state === 'dropped') {
                // Check distance BEFORE returning
                if (!this.isWithinRange(player.position, flag.position, FLAG_PICKUP_RANGE)) {
                    return { success: false, message: "Too far from flag" };
                }
                return this.returnFlag(flagTeam);
            }
            return { success: false, message: "Can't pick up your own flag" };
        }

        // Player already carrying a flag
        if (player.carryingFlag) {
            return { success: false, message: "Already carrying a flag" };
        }

        // Flag already carried
        if (flag.state === 'carried') {
            return { success: false, message: "Flag is already being carried" };
        }

        // Check distance
        if (!this.isWithinRange(player.position, flag.position, FLAG_PICKUP_RANGE)) {
            return { success: false, message: "Too far from flag" };
        }

        // SUCCESS! Pick up the flag
        flag.state = 'carried';
        flag.carriedBy = player.id;
        player.carryingFlag = true;

        return { success: true, message: "Flag picked up!" };
    }

    /**
     * Drop a flag (when player is stunned or disconnects)
     */
    dropFlag(playerId: string, position: Position): Team | null {
        // Find which flag this player is carrying
        for (const [team, flag] of Object.entries(this.flags)) {
            if (flag.carriedBy === playerId) {
                flag.state = 'dropped';
                flag.carriedBy = null;

                // Add random offset so flag doesn't drop directly under player corpse
                const angle = Math.random() * Math.PI * 2; // Random direction
                const distance = 40 + Math.random() * 20; // 40-60 pixels away
                flag.position = {
                    x: position.x + Math.cos(angle) * distance,
                    y: position.y + Math.sin(angle) * distance
                };
                flag.droppedAt = Date.now();

                console.log(`[FlagManager] ${team} flag dropped at (${flag.position.x}, ${flag.position.y})`);

                return team as Team;
            }
        }

        return null;
    }

    /**
     * Return a flag to its base (teammate picks up dropped flag)
     */
    returnFlag(flagTeam: Team): { success: boolean; message: string } {
        const flag = this.flags[flagTeam];

        if (flag.state !== 'dropped') {
            return { success: false, message: "Flag is not dropped" };
        }

        // Return to base
        flag.state = 'at_base';
        flag.carriedBy = null;
        flag.droppedAt = null;

        // Reset position based on team
        const basePosition = flagTeam === 'red'
            ? { x: 128, y: 128 }
            : { x: 672, y: 464 };
        flag.position = basePosition;

        console.log(`[FlagManager] ${flagTeam} flag returned to base`);

        return { success: true, message: "Flag returned!" };
    }

    /**
     * Attempt to capture the flag (score a point)
     *
     * RULES:
     * - Must be carrying enemy flag
     * - Must be at your own base
     * - Your own flag must be at base (not stolen)
     *
     * @returns Success and whether the match was won
     */
    attemptCapture(
        player: CTFPlayer,
        basePosition: Position,
        captureLimit: number
    ): { success: boolean; message: string; scored: boolean; won: boolean } {
        if (!player.carryingFlag) {
            return { success: false, message: "Not carrying a flag", scored: false, won: false };
        }

        // Check if player is at their own base
        if (!this.isWithinRange(player.position, basePosition, FLAG_PICKUP_RANGE)) {
            return { success: false, message: "Not at your base", scored: false, won: false };
        }

        // Check if your own flag is at base
        const ownFlag = this.flags[player.team];
        if (ownFlag.state !== 'at_base') {
            return {
                success: false,
                message: "Your flag must be at base to capture!",
                scored: false,
                won: false
            };
        }

        // SUCCESS! Capture the flag
        const enemyTeam: Team = player.team === 'red' ? 'blue' : 'red';
        const enemyFlag = this.flags[enemyTeam];

        // Return enemy flag to their base
        enemyFlag.state = 'at_base';
        enemyFlag.carriedBy = null;
        const enemyBasePosition = enemyTeam === 'red'
            ? { x: 128, y: 128 }
            : { x: 672, y: 464 };
        enemyFlag.position = enemyBasePosition;

        // Player no longer carrying flag
        player.carryingFlag = false;

        // Increment score
        this.scores[player.team]++;

        console.log(`[FlagManager] ${player.team} team scored! Score: Red=${this.scores.red}, Blue=${this.scores.blue}`);

        // Check for win condition
        const won = this.scores[player.team] >= captureLimit;

        return {
            success: true,
            message: `${player.team.toUpperCase()} team scored!`,
            scored: true,
            won
        };
    }

    /**
     * Update flag state (check for auto-return)
     *
     * Call this periodically (e.g., every second) to check if dropped
     * flags should auto-return.
     */
    update(): Array<{ team: Team; returned: boolean }> {
        const now = Date.now();
        const updates: Array<{ team: Team; returned: boolean }> = [];

        for (const [team, flag] of Object.entries(this.flags)) {
            if (flag.state === 'dropped' && flag.droppedAt) {
                const timeSinceDropped = now - flag.droppedAt;

                if (timeSinceDropped >= FLAG_AUTO_RETURN_TIME) {
                    this.returnFlag(team as Team);
                    updates.push({ team: team as Team, returned: true });
                }
            }
        }

        return updates;
    }

    /**
     * Get the position where a flag should be displayed
     * (follows carrier if carried)
     */
    getFlagDisplayPosition(flagTeam: Team, players: Map<string, CTFPlayer>): Position {
        const flag = this.flags[flagTeam];

        if (flag.state === 'carried' && flag.carriedBy) {
            const carrier = players.get(flag.carriedBy);
            if (carrier) {
                // Position above carrier's head
                return {
                    x: carrier.position.x,
                    y: carrier.position.y - 40
                };
            }
        }

        return flag.position;
    }

    /**
     * Utility: Check if two positions are within range
     */
    private isWithinRange(pos1: Position, pos2: Position, range: number): boolean {
        const distance = Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y);
        return distance <= range;
    }

    /**
     * Get current flag state (for sending to clients)
     */
    getFlags(): { red: Flag; blue: Flag } {
        return this.flags;
    }

    /**
     * Get current scores
     */
    getScores(): Score {
        return this.scores;
    }

    /**
     * Reset scores to 0-0
     */
    resetScores(): void {
        this.scores.red = 0;
        this.scores.blue = 0;
    }

    /**
     * Reset all flags to base positions
     */
    resetFlags(redBasePos: Position, blueBasePos: Position): void {
        this.flags.red.state = 'at_base';
        this.flags.red.carriedBy = null;
        this.flags.red.droppedAt = null;
        this.flags.red.position = redBasePos;

        this.flags.blue.state = 'at_base';
        this.flags.blue.carriedBy = null;
        this.flags.blue.droppedAt = null;
        this.flags.blue.position = blueBasePos;
    }
}
