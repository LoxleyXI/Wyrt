# Wyrt Buffs Module

Generic buff/debuff system for temporary status effects in multiplayer games.

## Features

- Apply buffs with duration timers
- Stack management (stackable vs unique)
- Automatic expiration
- Apply/expire/tick callbacks
- Query active buffs
- Support for DoT/HoT (damage/healing over time)
- Buff categories (buff/debuff/neutral)
- Event-driven architecture

## Installation

This module is included with Wyrt. It loads automatically if present in the `modules/` directory.

## Usage

### Access Buff Manager

```typescript
// In your game module
const buffManager = context.getModule('wyrt_buffs').getBuffManager();

// Or via global (for request handlers)
const buffManager = (globalThis as any).wyrtBuffManager;
```

### Apply Buffs

```typescript
// Speed boost
buffManager.applyBuff(playerId, {
    type: 'speed',
    category: 'buff',
    duration: 10000,  // 10 seconds
    modifiers: { moveSpeed: 1.5 },
    onApply: (targetId, buff) => {
        const player = gameState.players.get(targetId);
        if (player) {
            player.moveSpeed *= 1.5;
        }
    },
    onExpire: (targetId, buff) => {
        const player = gameState.players.get(targetId);
        if (player) {
            player.moveSpeed /= 1.5;
        }
    }
});

// Shield buff
buffManager.applyBuff(playerId, {
    type: 'shield',
    category: 'buff',
    duration: 5000,  // 5 seconds
    stackable: false,  // Only one shield at a time
    onApply: (targetId, buff) => {
        const player = gameState.players.get(targetId);
        if (player) {
            player.shielded = true;
        }
    },
    onExpire: (targetId, buff) => {
        const player = gameState.players.get(targetId);
        if (player) {
            player.shielded = false;
        }
    }
});

// Stun debuff
buffManager.applyBuff(targetId, {
    type: 'stun',
    category: 'debuff',
    duration: 3000,  // 3 seconds
    stackable: false,
    onApply: (targetId, buff) => {
        const player = gameState.players.get(targetId);
        if (player) {
            player.stunned = true;
            player.stunnedUntil = Date.now() + 3000;
        }
    },
    onExpire: (targetId, buff) => {
        const player = gameState.players.get(targetId);
        if (player) {
            player.stunned = false;
            player.stunnedUntil = null;
        }
    }
});
```

### Stackable Buffs

```typescript
// Damage boost (can stack up to 3 times)
buffManager.applyBuff(playerId, {
    type: 'damage_boost',
    category: 'buff',
    duration: 15000,
    stackable: true,
    maxStacks: 3,
    modifiers: { damageMultiplier: 1.2 },
    onApply: (targetId, buff) => {
        // Each stack adds 20% damage
        const player = gameState.players.get(targetId);
        if (player) {
            player.damage *= 1.2;
        }
    }
});

// Applying again adds a stack
buffManager.applyBuff(playerId, {
    type: 'damage_boost',
    // ... same config
});
// Now has 2 stacks (1.44x damage total)
```

### Damage/Healing Over Time

```typescript
// Poison (damage over time)
buffManager.applyBuff(targetId, {
    type: 'poison',
    category: 'debuff',
    duration: 10000,  // 10 seconds
    stackable: false,
    onTick: (targetId, buff) => {
        // Called every second
        const player = gameState.players.get(targetId);
        if (player) {
            player.health -= 5;  // 5 damage per second
            if (player.health <= 0) {
                killPlayer(targetId);
            }
        }
    }
});

// Regeneration (healing over time)
buffManager.applyBuff(playerId, {
    type: 'regeneration',
    category: 'buff',
    duration: 30000,  // 30 seconds
    onTick: (targetId, buff) => {
        const player = gameState.players.get(targetId);
        if (player) {
            player.health = Math.min(player.maxHealth, player.health + 3);
        }
    }
});
```

### Permanent Buffs

```typescript
// Permanent buff (until manually removed)
buffManager.applyBuff(playerId, {
    type: 'zone_damage',
    category: 'debuff',
    duration: 0,  // 0 = permanent
    onTick: (targetId, buff) => {
        // Tick every second while in damage zone
        const player = gameState.players.get(targetId);
        if (player) {
            player.health -= 10;
        }
    }
});

// Manually remove when leaving zone
buffManager.removeBuffsByType(playerId, 'zone_damage');
```

### Query Buffs

```typescript
// Check if player has specific buff
if (buffManager.hasBuff(playerId, 'shield')) {
    // Player is shielded, block damage
}

if (buffManager.hasBuff(targetId, 'stun')) {
    // Can't move while stunned
}

// Get specific buff
const speedBuff = buffManager.getBuffByType(playerId, 'speed');
if (speedBuff) {
    console.log(`Speed boost has ${speedBuff.stacks} stacks`);
}

// Get all buffs on player
const allBuffs = buffManager.getBuffs(playerId);
for (const buff of allBuffs) {
    console.log(`${buff.type}: ${buff.duration}ms remaining`);
}

// Get only buffs (positive effects)
const buffs = buffManager.getBuffsByCategory(playerId, 'buff');

// Get only debuffs (negative effects)
const debuffs = buffManager.getBuffsByCategory(playerId, 'debuff');
```

### Remove Buffs

```typescript
// Remove specific buff by ID
buffManager.removeBuff(buffId);

// Remove all buffs of a type
buffManager.removeBuffsByType(playerId, 'poison');

// Remove all buffs from player
buffManager.removeAllBuffs(playerId);

// Cleanse (remove all debuffs)
const debuffs = buffManager.getBuffsByCategory(playerId, 'debuff');
for (const debuff of debuffs) {
    buffManager.removeBuff(debuff.id);
}
```

### Manual Update (Optional)

The module auto-updates every second via setInterval. You can also manually update:

```typescript
// Check for expired buffs
const expired = buffManager.update();

for (const event of expired) {
    console.log(`${event.buffType} expired on ${event.targetId}`);
}
```

## Events

The module emits these events (listen via `context.events.on()`):

```typescript
// Buff applied
context.events.on('wyrt:buffApplied', (data) => {
    // data.buffId, data.buffType, data.targetId, data.duration

    // Broadcast to clients for visual effects
    broadcastToAll('buffApplied', {
        target: data.targetId,
        type: data.buffType,
        duration: data.duration
    });
});

// Buff expired
context.events.on('wyrt:buffExpired', (data) => {
    // data.buffId, data.buffType, data.targetId, data.timestamp

    broadcastToAll('buffExpired', {
        target: data.targetId,
        type: data.buffType
    });
});

// Buff stacked
context.events.on('wyrt:buffStacked', (data) => {
    // data.buffId, data.buffType, data.targetId, data.stacks

    broadcastToAll('buffStacked', {
        target: data.targetId,
        type: data.buffType,
        stacks: data.stacks
    });
});
```

## Example: CTF Game Power-Ups

```typescript
const buffManager = context.getModule('wyrt_buffs').getBuffManager();

// Speed boost pickup
context.events.on('wyrt:itemPickedUp', (data) => {
    if (data.itemType === 'speed_boost') {
        buffManager.applyBuff(data.playerId, {
            type: 'speed_boost',
            category: 'buff',
            duration: 10000,
            stackable: false,
            modifiers: { moveSpeed: 1.5 },
            onApply: (targetId, buff) => {
                const player = gameState.players.get(targetId);
                if (player) {
                    player.activeBoost = 'speed_boost';
                    player.boostEndsAt = Date.now() + 10000;
                }
            },
            onExpire: (targetId, buff) => {
                const player = gameState.players.get(targetId);
                if (player) {
                    player.activeBoost = null;
                    player.boostEndsAt = null;
                }
            }
        });
    }

    if (data.itemType === 'shield') {
        buffManager.applyBuff(data.playerId, {
            type: 'shield',
            category: 'buff',
            duration: 5000,
            onApply: (targetId) => {
                const player = gameState.players.get(targetId);
                if (player) player.activeBoost = 'shield';
            },
            onExpire: (targetId) => {
                const player = gameState.players.get(targetId);
                if (player) player.activeBoost = null;
            }
        });
    }
});

// Shield blocks projectile hits
context.events.on('wyrt:projectileHit', (data) => {
    if (buffManager.hasBuff(data.targetId, 'shield')) {
        // Shield blocks the hit
        return;
    }

    // Apply stun
    buffManager.applyBuff(data.targetId, {
        type: 'stun',
        category: 'debuff',
        duration: 3000,
        onApply: (targetId) => {
            const player = gameState.players.get(targetId);
            if (player) {
                player.stunned = true;
                // Drop flag if carrying
                if (player.carryingFlag) {
                    dropFlag(targetId);
                }
            }
        },
        onExpire: (targetId) => {
            const player = gameState.players.get(targetId);
            if (player) player.stunned = false;
        }
    });
});
```

## Example: RPG/MOBA Abilities

```typescript
// Fireball (DoT)
function castFireball(casterId: string, targetId: string) {
    // Initial damage
    const target = gameState.players.get(targetId);
    target.health -= 100;

    // Burning effect
    buffManager.applyBuff(targetId, {
        type: 'burning',
        category: 'debuff',
        duration: 5000,
        stackable: true,
        maxStacks: 3,
        onTick: (targetId, buff) => {
            const player = gameState.players.get(targetId);
            if (player) {
                player.health -= 10 * buff.stacks;  // More stacks = more damage
            }
        }
    });
}

// Invisibility
function castInvisibility(casterId: string) {
    buffManager.applyBuff(casterId, {
        type: 'invisibility',
        category: 'buff',
        duration: 5000,
        onApply: (targetId) => {
            const player = gameState.players.get(targetId);
            if (player) player.visible = false;
        },
        onExpire: (targetId) => {
            const player = gameState.players.get(targetId);
            if (player) player.visible = true;
        }
    });
}

// Haste aura (affects nearby allies)
function castHasteAura(casterId: string) {
    const caster = gameState.players.get(casterId);
    const nearbyAllies = findAlliesNear(caster.position, 200);

    for (const ally of nearbyAllies) {
        buffManager.applyBuff(ally.id, {
            type: 'haste',
            category: 'buff',
            duration: 8000,
            stackable: false,
            modifiers: { attackSpeed: 1.3, moveSpeed: 1.2 },
            onApply: (targetId) => {
                const player = gameState.players.get(targetId);
                if (player) {
                    player.attackSpeed *= 1.3;
                    player.moveSpeed *= 1.2;
                }
            },
            onExpire: (targetId) => {
                const player = gameState.players.get(targetId);
                if (player) {
                    player.attackSpeed /= 1.3;
                    player.moveSpeed /= 1.2;
                }
            }
        });
    }
}

// Cleanse spell (removes debuffs)
function castCleanse(targetId: string) {
    const debuffs = buffManager.getBuffsByCategory(targetId, 'debuff');

    for (const debuff of debuffs) {
        buffManager.removeBuff(debuff.id);
    }
}
```

## Example: Battle Royale Zone Damage

```typescript
// Player enters damage zone
function onEnterDamageZone(playerId: string) {
    buffManager.applyBuff(playerId, {
        type: 'zone_damage',
        category: 'debuff',
        duration: 0,  // Permanent until they leave
        onTick: (targetId, buff) => {
            const player = gameState.players.get(targetId);
            if (player) {
                player.health -= 5;  // 5 damage per second
                if (player.health <= 0) {
                    eliminatePlayer(targetId);
                }
            }
        }
    });
}

// Player leaves damage zone
function onLeaveDamageZone(playerId: string) {
    buffManager.removeBuffsByType(playerId, 'zone_damage');
}
```

## API Reference

### BuffManager

#### Apply/Remove
- `applyBuff(targetId: string, config: BuffConfig): BuffResult`
- `removeBuff(buffId: string, callExpireCallback?: boolean): boolean`
- `removeBuffsByType(targetId: string, buffType: BuffType): number`
- `removeAllBuffs(targetId: string): number`

#### Query
- `hasBuff(targetId: string, buffType: BuffType): boolean`
- `getBuffByType(targetId: string, buffType: BuffType): Buff | null`
- `getBuffs(targetId: string): Buff[]`
- `getBuffsByCategory(targetId: string, category: 'buff'|'debuff'|'neutral'): Buff[]`

#### System
- `update(): BuffExpiredEvent[]` - Check expirations (auto-called every second)
- `clearAll(): void` - Remove all buffs
- `getBuffCount(): number` - Total active buffs

## Type Definitions

```typescript
type BuffType = string;  // Game-defined buff types
type BuffCategory = 'buff' | 'debuff' | 'neutral';

interface BuffConfig {
    type: BuffType;
    category?: BuffCategory;        // Default: 'neutral'
    duration: number;               // Milliseconds (0 = permanent)
    stackable?: boolean;            // Default: false
    maxStacks?: number;             // Default: 1
    modifiers?: Record<string, any>;  // Game-specific data
    onApply?: (targetId: string, buff: Buff) => void;
    onExpire?: (targetId: string, buff: Buff) => void;
    onTick?: (targetId: string, buff: Buff) => void;  // Called every second
}

interface Buff extends BuffConfig {
    id: string;
    targetId: string;
    appliedAt: number;
    expiresAt: number | null;  // null = permanent
    stacks: number;
}

interface BuffResult {
    success: boolean;
    buff?: Buff;
    message: string;
}

interface BuffExpiredEvent {
    buffId: string;
    buffType: BuffType;
    targetId: string;
    timestamp: number;
}
```

## Design Notes

### Tick System

The module has a built-in tick system that calls `onTick` every 1 second for DoT/HoT effects:

```typescript
// Poison: 50 damage over 10 seconds
buffManager.applyBuff(targetId, {
    type: 'poison',
    duration: 10000,
    onTick: (targetId, buff) => {
        player.health -= 5;  // Called 10 times
    }
});
```

### Non-Stackable Buffs

By default, applying the same buff type refreshes the duration:

```typescript
// Apply 10s speed boost
buffManager.applyBuff(playerId, {
    type: 'speed',
    duration: 10000
});

// 5 seconds later, apply again
// Result: Duration resets to 10 seconds (not 15!)
buffManager.applyBuff(playerId, {
    type: 'speed',
    duration: 10000
});
```

### Modifiers

The `modifiers` field is intentionally generic - your game uses it however needed:

```typescript
modifiers: {
    moveSpeed: 1.5,
    attackSpeed: 1.3,
    damageReduction: 0.5,
    customData: { color: 'blue', particles: true }
}
```

### Performance

- O(1) buff lookups using `Map<string, Buff>`
- O(n) expiration checks (once per second)
- Tick callbacks called every second, not every frame
