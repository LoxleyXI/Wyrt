/**
 * CollisionManager
 *
 * Reusable collision detection system for multiplayer games
 * Extracted from wyrt_ctf for use across all game modules
 */

import { Position, Rectangle, Circle, CollisionLayer, CollisionResult } from '../types/CollisionTypes.js';

export class CollisionManager {
    private layers: CollisionLayer[] = [];

    constructor(layers: CollisionLayer[] = []) {
        this.layers = layers;
    }

    /**
     * Add a collision layer
     */
    addLayer(layer: CollisionLayer): void {
        this.layers.push(layer);
    }

    /**
     * Remove a collision layer by name
     */
    removeLayer(name: string): void {
        this.layers = this.layers.filter(layer => layer.name !== name);
    }

    /**
     * Check if a circle collides with any rectangles in the collision layers
     */
    checkCircleRectangles(circle: Circle, layers?: CollisionLayer[]): boolean {
        const layersToCheck = layers || this.layers;

        for (const layer of layersToCheck) {
            for (const block of layer.blocks) {
                if (this.circleRectangleCollision(circle, block)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if a position (with radius) collides with rectangles
     * This is the main method used by games for player movement validation
     */
    isPositionInCollisionBlock(
        position: Position,
        radius: number,
        blocks: Rectangle[]
    ): boolean {
        const circle: Circle = { x: position.x, y: position.y, radius };

        for (const block of blocks) {
            if (this.circleRectangleCollision(circle, block)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Circle-Rectangle collision detection
     * Uses closest point algorithm for accurate edge/corner detection
     */
    circleRectangleCollision(circle: Circle, rect: Rectangle): boolean {
        const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

        const distanceX = circle.x - closestX;
        const distanceY = circle.y - closestY;
        const distanceSquared = distanceX * distanceX + distanceY * distanceY;

        return distanceSquared < circle.radius * circle.radius;
    }

    /**
     * Circle-Circle collision detection
     */
    circleCircleCollision(circle1: Circle, circle2: Circle): boolean {
        const dx = circle1.x - circle2.x;
        const dy = circle1.y - circle2.y;
        const distanceSquared = dx * dx + dy * dy;
        const radiusSum = circle1.radius + circle2.radius;

        return distanceSquared < radiusSum * radiusSum;
    }

    /**
     * Calculate sliding movement when blocked by a wall
     * Tries moving along X-axis only, then Y-axis only if blocked
     * Returns the adjusted position or null if completely blocked
     */
    calculateSlidingMovement(
        currentPos: Position,
        targetPos: Position,
        radius: number,
        blocks: Rectangle[]
    ): Position | null {
        // Try full movement first
        if (!this.isPositionInCollisionBlock(targetPos, radius, blocks)) {
            return targetPos;
        }

        // Try X-only movement (slide along Y-axis)
        const xOnlyPos = { x: targetPos.x, y: currentPos.y };
        if (!this.isPositionInCollisionBlock(xOnlyPos, radius, blocks)) {
            return xOnlyPos;
        }

        // Try Y-only movement (slide along X-axis)
        const yOnlyPos = { x: currentPos.x, y: targetPos.y };
        if (!this.isPositionInCollisionBlock(yOnlyPos, radius, blocks)) {
            return yOnlyPos;
        }

        // Completely blocked
        return null;
    }

    /**
     * Get detailed collision result with normal and penetration depth
     * Useful for physics-based responses
     */
    getCollisionDetails(circle: Circle, rect: Rectangle): CollisionResult {
        if (!this.circleRectangleCollision(circle, rect)) {
            return { collided: false };
        }

        const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

        const dx = circle.x - closestX;
        const dy = circle.y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const normalX = distance > 0 ? dx / distance : 0;
        const normalY = distance > 0 ? dy / distance : 0;
        const penetration = circle.radius - distance;

        return {
            collided: true,
            normal: { x: normalX, y: normalY },
            penetration
        };
    }

    /**
     * Get all collision layers
     */
    getLayers(): CollisionLayer[] {
        return this.layers;
    }

    /**
     * Clear all collision layers
     */
    clearLayers(): void {
        this.layers = [];
    }
}
