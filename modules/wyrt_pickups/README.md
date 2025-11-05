# Wyrt Pickups Module

Generic item pickup and spawn system for multiplayer games.

## Features

- ✅ Register spawn points for items
- ✅ Proximity-based pickup detection
- ✅ Auto-respawn with configurable timers
- ✅ Persistent items (don't despawn on pickup)
- ✅ Limited-use items (can be picked up N times)
- ✅ Event-driven architecture (games implement effects via events)
- ✅ Per-item pickup range configuration

## Installation

This module is included with Wyrt. It loads automatically if present in the `modules/` directory.

## Usage

### Access Pickup Manager

```typescript
// In your game module
const pickupManager = context.getModule('wyrt_pickups').getPickupManager();

// Or via global (for request handlers)
const pickupManager = (globalThis as any).wyrtPickupManager;
```

### Register Pickups

```typescript
// Basic pickup with respawn
pickupManager.registerPickup({
    id: 'health_pack_1',
    itemType: 'health_pack',
    position: { x: 200, y: 300 },
    respawnTime: 30000  // 30 seconds
});

// Weapon pickup with custom range
pickupManager.registerPickup({
    id: 'weapon_spawn_1',
    itemType: 'stun_gun',
    position: { x: 400, y: 500 },
    respawnTime: 15000,  // 15 seconds
    pickupRange: 32      // Default is 50
});

// Persistent pickup (always available)
pickupManager.registerPickup({
    id: 'quest_item_1',
    itemType: 'quest_scroll',
    position: { x: 100, y: 100 },
    respawnTime: 0,       // 0 = doesn't respawn
    persistent: true      // Stays after pickup
});

// Limited-use pickup (treasure chest, loot drop)
pickupManager.registerPickup({
    id: 'treasure_1',
    itemType: 'gold_coins',
    position: { x: 300, y: 400 },
    respawnTime: 0,
    maxUses: 1           // Only one player can pick it up
});
```

### Check for Pickups (Proximity Detection)

```typescript
// Check if player is near any pickups
const pickupEvents = pickupManager.checkPickups(player.position, player.id);

// Process each pickup
for (const event of pickupEvents) {
    console.log(`Player ${event.playerId} picked up ${event.itemType}`);

    // Implement game-specific effects
    if (event.itemType === 'health_pack') {
        player.health += 50;
    }
}
```

### Manual Pickup Attempt

```typescript
// Try to pick up specific item
const pickupEvent = pickupManager.attemptPickup('health_pack_1', playerId);

if (pickupEvent) {
    // Pickup successful
    console.log(`Picked up ${pickupEvent.itemType}`);
} else {
    // Pickup failed (not available, out of range, etc.)
}
```

### Query Pickup State

```typescript
// Get pickup info
const pickup = pickupManager.getPickup('health_pack_1');
if (pickup) {
    console.log(`Available: ${pickup.available}`);
    console.log(`Position: ${pickup.position.x}, ${pickup.position.y}`);
}

// Get all pickups
const allPickups = pickupManager.getAllPickups();

// Get available pickups
const available = pickupManager.getAvailablePickups();
```

### Update System (Call in Game Loop)

```typescript
// In your game loop (or setInterval)
const respawnedItems = pickupManager.update();

for (const event of respawnedItems) {
    console.log(`${event.itemType} respawned at ${event.pickupId}`);
    // Broadcast to clients to show item again
}
```

### Remove Pickups

```typescript
// Remove specific pickup
pickupManager.removePickup('health_pack_1');

// Clear all pickups
pickupManager.clearAll();
```

## Events

The module emits these events (listen via `context.events.on()`):

```typescript
// Item picked up
context.events.on('wyrt:itemPickedUp', (data) => {
    // data.pickupId, data.itemType, data.playerId, data.position, data.timestamp

    // Implement game-specific logic
    if (data.itemType === 'health_pack') {
        player.health += 50;
    } else if (data.itemType === 'ammo') {
        player.ammo += 30;
    } else if (data.itemType === 'stun_gun') {
        player.weapon = 'stun_gun';
        player.ammo = 3;
    }
});

// Item respawned
context.events.on('wyrt:itemRespawned', (data) => {
    // data.pickupId, data.itemType, data.position, data.timestamp

    // Broadcast to clients to show the item again
    broadcastToAll('itemSpawned', {
        id: data.pickupId,
        type: data.itemType,
        position: data.position
    });
});
```

## Example: CTF Game

```typescript
// Register weapon spawns from map data
for (const weaponSpawn of mapConfig.weaponSpawns) {
    pickupManager.registerPickup({
        id: `weapon_${weaponSpawn.position.x}_${weaponSpawn.position.y}`,
        itemType: weaponSpawn.type,
        position: weaponSpawn.position,
        respawnTime: 15000,  // 15 seconds
        pickupRange: 32
    });
}

// Listen for pickups
context.events.on('wyrt:itemPickedUp', (data) => {
    const player = gameState.players.get(data.playerId);
    if (!player) return;

    const WEAPON_CONFIG = {
        stun_gun: { charges: 3 },
        speed_boost: { charges: 1 },
        shield: { charges: 1 }
    };

    const config = WEAPON_CONFIG[data.itemType];
    if (config) {
        player.weapon = data.itemType;
        player.weaponCharges = config.charges;
    }

    // Broadcast to all players
    broadcastWeaponPickedUp(data.pickupId, data.playerId, data.itemType);
});

// In game loop
const respawned = pickupManager.update();
for (const event of respawned) {
    broadcastWeaponSpawned(event.pickupId, event.itemType, event.position);
}
```

## Example: Battle Royale Loot

```typescript
// One-time loot drops (no respawn)
pickupManager.registerPickup({
    id: `loot_${x}_${y}`,
    itemType: 'assault_rifle',
    position: { x, y },
    respawnTime: 0,     // Don't respawn
    maxUses: 1          // Only one player can get it
});

// Supply drop (persistent, everyone can take)
pickupManager.registerPickup({
    id: `supply_drop_${timestamp}`,
    itemType: 'medical_kit',
    position: dropLocation,
    respawnTime: 0,
    persistent: true,   // Everyone can pick it up
    maxUses: 10         // But limit to 10 players
});
```

## Example: RPG/MMO

```typescript
// Health potions at vendor location
pickupManager.registerPickup({
    id: 'vendor_health_potion',
    itemType: 'health_potion',
    position: { x: 500, y: 600 },
    respawnTime: 5000,  // Quick respawn at vendor
    pickupRange: 64,    // Larger range for vendor
    persistent: true    // Always available
});

// Quest item (one-time pickup)
pickupManager.registerPickup({
    id: 'quest_ancient_scroll',
    itemType: 'ancient_scroll',
    position: { x: 1200, y: 800 },
    respawnTime: 0,
    maxUses: 1,
    pickupRange: 32
});

// Ore node (respawns after mining)
pickupManager.registerPickup({
    id: 'iron_ore_node_1',
    itemType: 'iron_ore',
    position: { x: 300, y: 900 },
    respawnTime: 120000,  // 2 minutes
    pickupRange: 48
});
```

## API Reference

### PickupManager

#### Pickups
- `registerPickup(config: PickupConfig): Pickup`
- `removePickup(pickupId: string): boolean`
- `getPickup(pickupId: string): Pickup | null`
- `getAllPickups(): Pickup[]`
- `getAvailablePickups(): Pickup[]`

#### Pickup Actions
- `checkPickups(position: Position, playerId: string): PickupEvent[]`
- `attemptPickup(pickupId: string, playerId: string): PickupEvent | null`

#### System
- `update(): RespawnEvent[]` - Check respawn timers, call in game loop
- `clearAll(): void` - Remove all pickups

## Type Definitions

```typescript
type ItemType = string;  // Game-defined item types

interface Position {
    x: number;
    y: number;
}

interface PickupConfig {
    id: string;
    itemType: ItemType;
    position: Position;
    respawnTime: number;    // Milliseconds (0 = no respawn)
    pickupRange?: number;   // Default: 50
    persistent?: boolean;   // Default: false (pickup becomes unavailable)
    maxUses?: number;       // Default: unlimited
}

interface Pickup extends PickupConfig {
    available: boolean;
    pickedUpBy: string | null;
    respawnAt: number | null;
    usesRemaining: number | null;
}

interface PickupEvent {
    pickupId: string;
    itemType: ItemType;
    playerId: string;
    position: Position;
    timestamp: number;
}

interface RespawnEvent {
    pickupId: string;
    itemType: ItemType;
    position: Position;
    timestamp: number;
}
```

## Design Notes

### Event-Driven Architecture

This module intentionally does NOT implement item effects. It only handles:
- Proximity detection
- Pickup availability
- Respawn timers

Your game listens to `wyrt:itemPickedUp` events and implements the effects:

```typescript
context.events.on('wyrt:itemPickedUp', (data) => {
    // YOUR game logic here
    switch (data.itemType) {
        case 'health_pack':
            player.health += 50;
            break;
        case 'ammo':
            player.ammo += 30;
            break;
        // ... etc
    }
});
```

This keeps the module generic and reusable across different games.

### Distance Calculation

Uses Euclidean distance for proximity checks:

```typescript
const distance = Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) +
    Math.pow(pos1.y - pos2.y, 2)
);
```

### Performance

- O(1) pickup lookups using `Map<string, Pickup>`
- O(n) proximity checks (iterates all pickups)
- For large worlds, consider spatial partitioning in your game

## License

Part of the Wyrt MMO engine (MIT License).
