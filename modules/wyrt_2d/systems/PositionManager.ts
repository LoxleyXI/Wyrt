/**
 * Position Manager
 *
 * Centralized 2D position tracking for multiplayer games.
 * Manages player positions, directions, and provides utilities for:
 * - Position updates and validation
 * - Distance calculations
 * - Direction helpers
 * - Room-based position grouping
 */

import { Position, Direction, PlayerPosition, MovementUpdate } from '../types/Position2D';

export class PositionManager {
    private playerPositions: Map<string, PlayerPosition> = new Map();

    /**
     * Update a player's position
     */
    updatePosition(playerId: string, position: Position, direction: Direction, roomId?: string): void {
        this.playerPositions.set(playerId, {
            playerId,
            position,
            direction,
            roomId,
            timestamp: Date.now()
        });
    }

    /**
     * Get a player's current position
     */
    getPosition(playerId: string): PlayerPosition | undefined {
        return this.playerPositions.get(playerId);
    }

    /**
     * Get all players in a specific room
     */
    getPlayersInRoom(roomId: string): PlayerPosition[] {
        return Array.from(this.playerPositions.values())
            .filter(pos => pos.roomId === roomId);
    }

    /**
     * Remove a player from tracking
     */
    removePlayer(playerId: string): void {
        this.playerPositions.delete(playerId);
    }

    /**
     * Get all tracked positions
     */
    getAllPositions(): PlayerPosition[] {
        return Array.from(this.playerPositions.values());
    }

    /**
     * Calculate distance between two positions
     */
    static distance(pos1: Position, pos2: Position): number {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate Manhattan distance (grid-based distance)
     */
    static manhattanDistance(pos1: Position, pos2: Position): number {
        return Math.abs(pos2.x - pos1.x) + Math.abs(pos2.y - pos1.y);
    }

    /**
     * Get direction from one position to another
     */
    static getDirectionBetween(from: Position, to: Position): Direction {
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        // Determine primary axis
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 'right' : 'left';
        } else {
            return dy > 0 ? 'down' : 'up';
        }
    }

    /**
     * Get normalized direction vector for a direction
     */
    static getDirectionVector(direction: Direction): { x: number; y: number } {
        switch (direction) {
            case 'up': return { x: 0, y: -1 };
            case 'down': return { x: 0, y: 1 };
            case 'left': return { x: -1, y: 0 };
            case 'right': return { x: 1, y: 0 };
        }
    }

    /**
     * Move a position in a direction by a distance
     */
    static moveInDirection(position: Position, direction: Direction, distance: number): Position {
        const vector = PositionManager.getDirectionVector(direction);
        return {
            x: position.x + vector.x * distance,
            y: position.y + vector.y * distance
        };
    }

    /**
     * Check if a position is within bounds
     */
    static isWithinBounds(position: Position, width: number, height: number): boolean {
        return position.x >= 0 && position.x < width &&
               position.y >= 0 && position.y < height;
    }

    /**
     * Clamp position to bounds
     */
    static clampToBounds(position: Position, width: number, height: number): Position {
        return {
            x: Math.max(0, Math.min(width, position.x)),
            y: Math.max(0, Math.min(height, position.y))
        };
    }

    /**
     * Check if two positions are within a certain range
     */
    static isWithinRange(pos1: Position, pos2: Position, range: number): boolean {
        return PositionManager.distance(pos1, pos2) <= range;
    }

    /**
     * Get all players within range of a position
     */
    getPlayersWithinRange(position: Position, range: number, roomId?: string): PlayerPosition[] {
        let positions = this.getAllPositions();

        if (roomId) {
            positions = positions.filter(pos => pos.roomId === roomId);
        }

        return positions.filter(pos =>
            PositionManager.isWithinRange(position, pos.position, range)
        );
    }

    /**
     * Cleanup old positions (for disconnected players)
     */
    cleanupOldPositions(maxAge: number = 300000): void { // 5 minutes default
        const now = Date.now();
        for (const [playerId, pos] of this.playerPositions.entries()) {
            if (now - pos.timestamp > maxAge) {
                this.playerPositions.delete(playerId);
            }
        }
    }
}
