import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionManager } from '../systems/CollisionManager.js';

describe('Circle-Rectangle Collision Detection', () => {
  let collisionManager: CollisionManager;

  beforeEach(() => {
    collisionManager = new CollisionManager();
  });

  function isPositionInCollisionBlock(
    position: { x: number; y: number },
    radius: number,
    collisionLayer: Array<{ x: number; y: number; width: number; height: number }>
  ): boolean {
    return collisionManager.isPositionInCollisionBlock(position, radius, collisionLayer);
  }

  const testWall = { x: 100, y: 100, width: 50, height: 50 };
  const playerRadius = 16;

  it('should detect collision when circle overlaps rectangle', () => {
    const position = { x: 110, y: 110 };
    expect(isPositionInCollisionBlock(position, playerRadius, [testWall])).toBe(true);
  });

  it('should not detect collision when circle is far from rectangle', () => {
    const position = { x: 50, y: 50 };
    expect(isPositionInCollisionBlock(position, playerRadius, [testWall])).toBe(false);
  });

  it('should detect collision at rectangle edge', () => {
    const position = { x: 90, y: 110 };
    expect(isPositionInCollisionBlock(position, playerRadius, [testWall])).toBe(true);
  });

  it('should not detect collision just outside radius', () => {
    const position = { x: 82, y: 100 };
    expect(isPositionInCollisionBlock(position, playerRadius, [testWall])).toBe(false);
  });

  it('should handle multiple collision blocks', () => {
    const walls = [
      { x: 100, y: 100, width: 50, height: 50 },
      { x: 200, y: 200, width: 50, height: 50 }
    ];

    expect(isPositionInCollisionBlock({ x: 110, y: 110 }, playerRadius, walls)).toBe(true);
    expect(isPositionInCollisionBlock({ x: 210, y: 210 }, playerRadius, walls)).toBe(true);
    expect(isPositionInCollisionBlock({ x: 180, y: 180 }, playerRadius, walls)).toBe(false);
  });

  it('should handle empty collision layer', () => {
    expect(isPositionInCollisionBlock({ x: 100, y: 100 }, playerRadius, [])).toBe(false);
  });

  it('should detect collision at rectangle corner', () => {
    const position = { x: 90, y: 90 };
    expect(isPositionInCollisionBlock(position, playerRadius, [testWall])).toBe(true);
  });
});
