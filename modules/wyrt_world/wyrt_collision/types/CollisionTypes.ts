/**
 * Collision Types
 *
 * Reusable collision detection types for multiplayer games
 */

export interface Position {
    x: number;
    y: number;
}

export interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Circle {
    x: number;
    y: number;
    radius: number;
}

export interface CollisionLayer {
    name?: string;
    blocks: Rectangle[];
}

export interface CollisionConfig {
    layers: CollisionLayer[];
}

export interface CollisionResult {
    collided: boolean;
    normal?: { x: number; y: number };
    penetration?: number;
}
