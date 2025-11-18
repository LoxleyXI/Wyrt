/**
 * 2D Position and Direction Types
 *
 * Common type definitions for 2D multiplayer games in Wyrt.
 * Used by MyGame, CTF, and other 2D games for position tracking.
 */

/**
 * Position in 2D space
 */
export interface Position {
    x: number;
    y: number;
}

/**
 * Velocity vector for movement and projectiles
 */
export interface Velocity {
    x: number;
    y: number;
}

/**
 * Player/entity direction for sprite animations
 */
export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Extended player position data with direction
 */
export interface PlayerPosition {
    playerId: string;
    position: Position;
    direction: Direction;
    roomId?: string; // Optional room identifier
    timestamp: number; // When position was last updated
}

/**
 * Movement data sent between client/server
 */
export interface MovementUpdate {
    playerId: string;
    position: Position;
    direction: Direction;
}
