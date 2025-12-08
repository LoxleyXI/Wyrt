# Wyrt Collision Module

Collision detection system for multiplayer games with support for circle-rectangle and circle-circle collision detection.

## Features

- Circle-rectangle collision detection
- Circle-circle collision detection
- Wall sliding for smooth movement
- Collision layers for organized level design
- Detailed collision results with normals and penetration depth

## Installation

This module is included with Wyrt. It loads automatically if present in the `modules/` directory.

## Usage

### Basic Collision Check

```typescript
import { CollisionManager } from './modules/wyrt_collision/systems/CollisionManager';

const collision = new CollisionManager();

const walls = [
  { x: 100, y: 100, width: 50, height: 50 },
  { x: 200, y: 200, width: 50, height: 50 }
];

const playerPos = { x: 110, y: 110 };
const playerRadius = 16;

if (collision.isPositionInCollisionBlock(playerPos, playerRadius, walls)) {
  console.log('Player collided with wall');
}
```

### Collision Layers

```typescript
const collision = new CollisionManager();

collision.addLayer({
  name: 'walls',
  blocks: [
    { x: 100, y: 100, width: 50, height: 50 },
    { x: 200, y: 200, width: 50, height: 50 }
  ]
});

collision.addLayer({
  name: 'barriers',
  blocks: [
    { x: 300, y: 300, width: 100, height: 20 }
  ]
});

const circle = { x: 110, y: 110, radius: 16 };
if (collision.checkCircleRectangles(circle)) {
  console.log('Collision detected in any layer');
}
```

### Wall Sliding

```typescript
const currentPos = { x: 100, y: 100 };
const targetPos = { x: 110, y: 110 };
const radius = 16;

const walls = [
  { x: 105, y: 90, width: 50, height: 10 }
];

const adjustedPos = collision.calculateSlidingMovement(
  currentPos,
  targetPos,
  radius,
  walls
);

if (adjustedPos) {
  player.position = adjustedPos;
} else {
  console.log('Movement completely blocked');
}
```

### Circle-Circle Collision

```typescript
const player = { x: 100, y: 100, radius: 16 };
const enemy = { x: 110, y: 110, radius: 16 };

if (collision.circleCircleCollision(player, enemy)) {
  console.log('Player and enemy collided');
}
```

### Detailed Collision Information

```typescript
const circle = { x: 110, y: 110, radius: 16 };
const rect = { x: 100, y: 100, width: 50, height: 50 };

const result = collision.getCollisionDetails(circle, rect);

if (result.collided) {
  console.log('Normal:', result.normal);
  console.log('Penetration:', result.penetration);
}
```

## API Reference

### CollisionManager

#### Constructor

```typescript
constructor(layers?: CollisionLayer[])
```

Create a new collision manager with optional initial layers.

#### Methods

**addLayer(layer: CollisionLayer): void**

Add a collision layer.

**removeLayer(name: string): void**

Remove a collision layer by name.

**isPositionInCollisionBlock(position: Position, radius: number, blocks: Rectangle[]): boolean**

Check if a circle at position with radius collides with any rectangles. Primary method for movement validation.

**checkCircleRectangles(circle: Circle, layers?: CollisionLayer[]): boolean**

Check if a circle collides with rectangles in specified layers or all layers.

**circleRectangleCollision(circle: Circle, rect: Rectangle): boolean**

Test collision between a circle and rectangle using closest point algorithm.

**circleCircleCollision(circle1: Circle, circle2: Circle): boolean**

Test collision between two circles.

**calculateSlidingMovement(currentPos: Position, targetPos: Position, radius: number, blocks: Rectangle[]): Position | null**

Calculate adjusted position when movement is blocked. Returns null if completely blocked.

**getCollisionDetails(circle: Circle, rect: Rectangle): CollisionResult**

Get detailed collision information including normal vector and penetration depth.

## Types

```typescript
interface Position {
  x: number;
  y: number;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Circle {
  x: number;
  y: number;
  radius: number;
}

interface CollisionLayer {
  name: string;
  blocks: Rectangle[];
}

interface CollisionResult {
  collided: boolean;
  normal?: { x: number; y: number };
  penetration?: number;
}
```

## Examples

### CTF Game Movement

```typescript
const collision = context.getModule('wyrt_collision').collision;

const walls = mapConfig.collisionLayers.walls;
const player = gameState.players.get(playerId);

const targetPos = {
  x: player.position.x + velocity.x * deltaTime,
  y: player.position.y + velocity.y * deltaTime
};

const newPos = collision.calculateSlidingMovement(
  player.position,
  targetPos,
  player.radius,
  walls
);

if (newPos) {
  player.position = newPos;
}
```

### Platformer Collision

```typescript
const collision = new CollisionManager();

collision.addLayer({
  name: 'platforms',
  blocks: [
    { x: 0, y: 400, width: 800, height: 50 },
    { x: 200, y: 300, width: 200, height: 20 }
  ]
});

const playerCircle = {
  x: player.x,
  y: player.y + player.height / 2,
  radius: player.width / 2
};

if (collision.checkCircleRectangles(playerCircle)) {
  player.grounded = true;
  player.velocityY = 0;
}
```

### Bullet Collision

```typescript
const bulletCircle = {
  x: bullet.position.x,
  y: bullet.position.y,
  radius: bullet.radius
};

for (const enemy of enemies) {
  const enemyCircle = {
    x: enemy.position.x,
    y: enemy.position.y,
    radius: enemy.radius
  };

  if (collision.circleCircleCollision(bulletCircle, enemyCircle)) {
    applyDamage(enemy, bullet.damage);
    destroyBullet(bullet);
    break;
  }
}
```

## Algorithm Details

### Circle-Rectangle Collision

Uses the closest point algorithm for accurate edge and corner detection:

1. Find the closest point on the rectangle to the circle center
2. Calculate distance from circle center to closest point
3. Compare distance to circle radius

This provides accurate collision detection at edges and corners.

### Wall Sliding

When movement is blocked:

1. Try moving to target position
2. If blocked, try moving on X-axis only
3. If still blocked, try moving on Y-axis only
4. If all blocked, return null

This creates smooth sliding along walls when moving diagonally into them.

## Testing

Run tests with:

```bash
npm test
```

The module includes comprehensive tests for:
- Circle-rectangle collision detection
- Edge and corner cases
- Multiple collision blocks
- Empty collision layers
