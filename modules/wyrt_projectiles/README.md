# Wyrt Projectiles Module

Generic projectile physics and collision system for multiplayer games.

## Features

- ✅ Velocity-based movement (pixels per second)
- ✅ Circle-circle collision detection
- ✅ Configurable hit filters (can't hit same team, can't hit self, etc.)
- ✅ Hit callbacks for game-specific effects
- ✅ Time-to-live (TTL) system
- ✅ Helper methods for direction and velocity
- ✅ Event-driven architecture

## Installation

This module is included with Wyrt. It loads automatically if present in the `modules/` directory.

## Usage

### Access Projectile Manager

```typescript
// In your game module
const projectileManager = context.getModule('wyrt_projectiles').getProjectileManager();

// Or via global (for request handlers)
const projectileManager = (globalThis as any).wyrtProjectileManager;
```

### Fire Projectiles

```typescript
// Basic projectile
const projectile = projectileManager.fireProjectile({
    ownerId: playerId,
    position: { x: 100, y: 200 },
    velocity: { x: 300, y: 0 },  // 300 pixels/second to the right
    radius: 8,
    ttl: 3000  // 3 seconds
});

// Projectile with hit filter (can't hit self)
projectileManager.fireProjectile({
    ownerId: playerId,
    position: player.position,
    velocity: { x: 0, y: -400 },  // 400 px/s upward
    radius: 10,
    ttl: 5000,
    hitFilter: (target) => target.id !== playerId
});

// Projectile with team filtering
projectileManager.fireProjectile({
    ownerId: playerId,
    position: player.position,
    velocity: { x: 200, y: 200 },
    hitFilter: (target) => {
        // Can't hit yourself
        if (target.id === playerId) return false;
        // Can't hit teammates
        return !teamManager.isFriendly(playerId, target.id);
    },
    onHit: (projectile, target) => {
        // Apply damage
        target.health -= 25;
        // Apply stun
        target.stunned = true;
    }
});
```

### Helper Methods

```typescript
// Normalize direction vector
const direction = { x: 3, y: 4 };
const normalized = ProjectileManager.normalizeDirection(direction);
// { x: 0.6, y: 0.8 }

// Create velocity from direction and speed
const direction = { x: 1, y: 1 };  // Northeast
const speed = 400;  // pixels per second
const velocity = ProjectileManager.createVelocity(direction, speed);
// { x: 282.84, y: 282.84 }  (normalized to magnitude 400)

// Fire in player's facing direction
const velocity = ProjectileManager.createVelocity(
    player.facingDirection,
    300  // projectile speed
);
projectileManager.fireProjectile({
    ownerId: player.id,
    position: player.position,
    velocity: velocity
});
```

### Update Projectiles (Call in Game Loop)

```typescript
// In your game loop
const deltaTime = (now - lastUpdate) / 1000;  // Convert to seconds

// Get all hittable entities (players, mobs, etc.)
const entities = Array.from(gameState.players.values());

// Update projectiles
const hitEvents = projectileManager.update(deltaTime, entities);

// Process hits
for (const hit of hitEvents) {
    console.log(`Projectile ${hit.projectileId} hit ${hit.targetId}`);
    // onHit callback already executed if provided
}
```

### Query Projectiles

```typescript
// Get specific projectile
const projectile = projectileManager.getProjectile('proj_123');

// Get all projectiles
const allProjectiles = projectileManager.getAllProjectiles();

// Get projectiles by owner
const playerProjectiles = projectileManager.getProjectilesByOwner(playerId);
```

### Remove Projectiles

```typescript
// Remove specific projectile
projectileManager.removeProjectile('proj_123');

// Clear all projectiles
projectileManager.clearAll();
```

## Events

The module emits these events (listen via `context.events.on()`):

```typescript
// Projectile fired
context.events.on('wyrt:projectileFired', (data) => {
    // data.projectileId, data.ownerId, data.position, data.velocity

    // Broadcast to clients for rendering
    broadcastToAll('projectileSpawned', {
        id: data.projectileId,
        owner: data.ownerId,
        position: data.position,
        velocity: data.velocity
    });
});

// Projectile hit target
context.events.on('wyrt:projectileHit', (data) => {
    // data.projectileId, data.ownerId, data.targetId, data.position

    // onHit callback already executed
    // This event is for visual/audio effects

    broadcastToAll('projectileHit', {
        id: data.projectileId,
        target: data.targetId,
        position: data.position
    });
});

// Projectile expired (TTL elapsed)
context.events.on('wyrt:projectileExpired', (data) => {
    // data.projectileId, data.position

    // Remove from client
    broadcastToAll('projectileExpired', {
        id: data.projectileId
    });
});
```

## Example: CTF Game (Stun Gun)

```typescript
const projectileManager = context.getModule('wyrt_projectiles').getProjectileManager();
const teamManager = context.getModule('wyrt_teams').getTeamManager();
const buffManager = context.getModule('wyrt_buffs').getBuffManager();

// Player shoots
function shoot(playerId: string, direction: { x: number; y: number }) {
    const player = gameState.players.get(playerId);
    if (!player) return;

    // Fire projectile
    const projectile = projectileManager.fireProjectile({
        ownerId: playerId,
        position: { ...player.position },
        velocity: ProjectileManager.createVelocity(direction, 300),
        radius: 8,
        ttl: 3000,
        hitFilter: (target) => {
            // Can't hit yourself
            if (target.id === playerId) return false;
            // Can't hit teammates
            return !teamManager.isFriendly(playerId, target.id);
        },
        onHit: (proj, target) => {
            // Check if target has shield
            if (buffManager.hasBuff(target.id, 'shield')) {
                return;  // Shield blocks
            }

            // Apply stun
            buffManager.applyBuff(target.id, {
                type: 'stun',
                category: 'debuff',
                duration: 3000,
                onApply: (targetId) => {
                    const t = gameState.players.get(targetId);
                    if (t) {
                        t.stunned = true;
                        // Drop flag if carrying
                        if (t.carryingFlag) {
                            dropFlag(targetId);
                        }
                    }
                },
                onExpire: (targetId) => {
                    const t = gameState.players.get(targetId);
                    if (t) t.stunned = false;
                }
            });
        }
    });

    return projectile.id;
}

// In game loop (60 FPS)
function update() {
    const deltaTime = 1 / 60;
    const entities = Array.from(gameState.players.values());

    projectileManager.update(deltaTime, entities);
}
```

## Example: Twin-Stick Shooter

```typescript
// Fire projectile toward mouse position
function shootTowardMouse(playerId: string, mouseX: number, mouseY: number) {
    const player = gameState.players.get(playerId);
    if (!player) return;

    // Calculate direction
    const direction = {
        x: mouseX - player.position.x,
        y: mouseY - player.position.y
    };

    // Fire fast projectile
    projectileManager.fireProjectile({
        ownerId: playerId,
        position: player.position,
        velocity: ProjectileManager.createVelocity(direction, 600),  // Fast!
        radius: 6,
        ttl: 2000,
        hitFilter: (target) => target.id !== playerId,
        onHit: (proj, target) => {
            target.health -= 10;
            if (target.health <= 0) {
                killTarget(target.id);
            }
        }
    });
}

// Rapid fire
let lastShot = 0;
const FIRE_RATE = 100;  // 10 shots per second

function tryShoot(playerId: string, direction: { x: number; y: number }) {
    const now = Date.now();
    if (now - lastShot < FIRE_RATE) return;

    shootTowardMouse(playerId, direction.x, direction.y);
    lastShot = now;
}
```

## Example: RPG Spell System

```typescript
// Fireball spell
function castFireball(casterId: string, targetPosition: { x: number; y: number }) {
    const caster = gameState.players.get(casterId);
    if (!caster || caster.mana < 50) return;

    caster.mana -= 50;

    const direction = {
        x: targetPosition.x - caster.position.x,
        y: targetPosition.y - caster.position.y
    };

    projectileManager.fireProjectile({
        ownerId: casterId,
        position: caster.position,
        velocity: ProjectileManager.createVelocity(direction, 200),
        radius: 16,  // Larger projectile
        ttl: 5000,
        hitFilter: (target) => target.id !== casterId,
        onHit: (proj, target) => {
            // Fireball does area damage
            const nearbyEnemies = findEntitiesNear(proj.position, 50);
            for (const enemy of nearbyEnemies) {
                enemy.health -= 100;
                applyBurn(enemy.id, 5000);  // 5 second burn
            }
        }
    });
}

// Healing orb (helps allies)
function castHealingOrb(casterId: string, direction: { x: number; y: number }) {
    const caster = gameState.players.get(casterId);

    projectileManager.fireProjectile({
        ownerId: casterId,
        position: caster.position,
        velocity: ProjectileManager.createVelocity(direction, 150),
        radius: 12,
        ttl: 8000,
        hitFilter: (target) => {
            // Only hit allies (including self)
            return teamManager.isFriendly(casterId, target.id);
        },
        onHit: (proj, target) => {
            target.health = Math.min(target.maxHealth, target.health + 50);
        }
    });
}
```

## API Reference

### ProjectileManager

#### Projectiles
- `fireProjectile(config: ProjectileConfig): Projectile`
- `removeProjectile(projectileId: string): boolean`
- `getProjectile(projectileId: string): Projectile | null`
- `getAllProjectiles(): Projectile[]`
- `getProjectilesByOwner(ownerId: string): Projectile[]`

#### System
- `update(deltaTime: number, entities: HittableEntity[]): ProjectileHitEvent[]`
- `clearAll(): void`

#### Static Helpers
- `ProjectileManager.normalizeDirection(direction: {x, y}): {x, y}`
- `ProjectileManager.createVelocity(direction: {x, y}, speed: number): {x, y}`

## Type Definitions

```typescript
interface Position {
    x: number;
    y: number;
}

interface Velocity {
    x: number;  // Pixels per second
    y: number;
}

interface HittableEntity {
    id: string;
    position: Position;
    radius?: number;  // Default: 16
    [key: string]: any;  // Can have other properties
}

interface ProjectileConfig {
    ownerId: string;
    position: Position;
    velocity: Velocity;
    radius?: number;         // Default: 8
    ttl?: number;            // Time to live (ms), default: 5000
    hitFilter?: (target: HittableEntity) => boolean;
    onHit?: (projectile: Projectile, target: HittableEntity) => void;
}

interface Projectile extends ProjectileConfig {
    id: string;
    createdAt: number;
    expiresAt: number;
}

interface ProjectileHitEvent {
    projectileId: string;
    ownerId: string;
    targetId: string;
    position: Position;
    timestamp: number;
}
```

## Physics Details

### Velocity-Based Movement

Projectiles move based on velocity (pixels per second), not fixed distance per frame:

```typescript
// Each frame, move by velocity * deltaTime
projectile.position.x += projectile.velocity.x * deltaTime;
projectile.position.y += projectile.velocity.y * deltaTime;
```

This ensures consistent speed regardless of frame rate.

### Collision Detection

Uses circle-circle collision detection:

```typescript
const distance = Math.sqrt(
    Math.pow(proj.position.x - entity.position.x, 2) +
    Math.pow(proj.position.y - entity.position.y, 2)
);

const combinedRadius = proj.radius + entity.radius;

if (distance < combinedRadius) {
    // Collision!
}
```

### Performance

- O(n * m) collision checks (n projectiles × m entities)
- For large games, consider spatial partitioning
- Hit projectiles are removed immediately to reduce checks

## Design Notes

### Event-Driven Architecture

The module handles physics and collision detection. Your game implements hit effects via callbacks:

```typescript
onHit: (projectile, target) => {
    // YOUR damage logic here
    target.health -= 25;
}
```

This keeps the module generic and reusable.

### Filter-Based Targeting

Use `hitFilter` for complex targeting rules:

```typescript
hitFilter: (target) => {
    // Can't hit self
    if (target.id === ownerId) return false;

    // Can't hit teammates
    if (teamManager.isFriendly(ownerId, target.id)) return false;

    // Can't hit players with shields
    if (buffManager.hasBuff(target.id, 'shield')) return false;

    // Can't hit dead players
    if (target.health <= 0) return false;

    return true;
}
```

## License

Part of the Wyrt MMO engine (MIT License).
