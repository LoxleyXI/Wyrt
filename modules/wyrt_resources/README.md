# wyrt_resources - Generic Resource Node System

Generic resource node system for gathering, mining, fishing, and any harvestable object mechanics.

## Features

- **Node HP Tracking** - Each node has current/max HP
- **Depletion Mechanics** - Nodes deplete when HP reaches 0
- **Respawn Timers** - Configurable respawn delays per node type
- **Loot Tables** - Weighted random item selection
- **Event-Based** - No game-specific logic, emit events for integration
- **Game-Scoped** - Each game gets isolated resource manager

## Installation

Module auto-loads when placed in `Wyrt/modules/wyrt_resources/`

## Usage

### 1. Create Game-Scoped Manager

```typescript
// In your game module's initialize()
const resourcesModule = context.getModule('wyrt_resources');
this.resourceManager = resourcesModule.createResourceManager('my_game');
```

### 2. Register Node Types

```typescript
// Define node configurations (from YAML or hardcoded)
this.resourceManager.registerNodeType('Copper_Ore', {
    name: 'Copper Ore Deposit',
    maxHp: 100,
    respawnTime: 300000,  // 5 minutes
    items: [
        [80, 'Copper_Ore'],      // 80% weight
        [20, 'Stone_Fragment']   // 20% weight
    ]
});

this.resourceManager.registerNodeType('Oak_Tree', {
    name: 'Oak Tree',
    maxHp: 150,
    respawnTime: 600000,  // 10 minutes
    items: [
        [90, 'Oak_Log'],
        [10, 'Hardwood']
    ]
});
```

### 3. Spawn Node Instances

```typescript
// Spawn nodes at specific positions
this.resourceManager.spawnNode(
    'copper_001',           // Unique instance ID
    'Copper_Ore',          // Node type
    { x: 400, y: 300 }     // World position
);

this.resourceManager.spawnNode(
    'oak_001',
    'Oak_Tree',
    { x: 800, y: 450 }
);
```

### 4. Handle Gathering Actions

```typescript
// When player gathers a node
const result = this.resourceManager.damageNode('copper_001', 50);

if (result) {
    console.log(`Remaining HP: ${result.remaining}`);

    if (result.depleted) {
        console.log(`Node depleted! Looted: ${result.item}`);
        // Handle loot (give to player, spawn pickup, etc.)
    }
}
```

### 5. Listen to Events

```typescript
// Listen for node depletion
this.resourceManager.on('node:depleted', (data) => {
    const { gameId, nodeId, type, position, lootItem } = data;

    // Game-specific handling:
    // - Broadcast to room that node is depleted
    // - Spawn pickup at position
    // - Grant XP to player
    // - Update player inventory
    // - Play depletion animation

    this.zoneManager.broadcastToRoom(room, {
        type: 'nodeDepleted',
        nodeId,
        position
    });

    if (lootItem) {
        this.pickupManager.spawnPickup(lootItem, position);
    }
});

// Listen for node respawn
this.resourceManager.on('node:respawned', (data) => {
    const { gameId, nodeId, type, position } = data;

    // Broadcast that node is available again
    this.zoneManager.broadcastToRoom(room, {
        type: 'nodeRespawn',
        nodeId,
        position
    });
});

// Listen for node spawn
this.resourceManager.on('node:spawned', (data) => {
    const { gameId, nodeId, type, position } = data;
    // Handle initial spawn visualization
});
```

## Events

### `node:spawned`
Emitted when a node instance is created.

**Data:**
```typescript
{
    gameId: string,
    nodeId: string,
    type: string,
    position: { x: number, y: number }
}
```

### `node:depleted`
Emitted when a node's HP reaches 0.

**Data:**
```typescript
{
    gameId: string,
    nodeId: string,
    type: string,
    position: { x: number, y: number },
    lootItem: string | null
}
```

### `node:respawned`
Emitted when a depleted node respawns.

**Data:**
```typescript
{
    gameId: string,
    nodeId: string,
    type: string,
    position: { x: number, y: number }
}
```

### `node:removed`
Emitted when a node is removed (cleanup).

**Data:**
```typescript
{
    gameId: string,
    nodeId: string
}
```

## API Reference

### `registerNodeType(type: string, config: ResourceNodeConfig)`
Register a node type configuration.

### `spawnNode(id: string, type: string, position: { x, y }): ResourceNodeState | null`
Create a node instance at a position.

### `damageNode(nodeId: string, damage: number): DamageResult | null`
Damage a node, potentially depleting it.

Returns:
```typescript
{
    damage: number,
    remaining: number,  // HP left
    depleted: boolean,
    item: string | null  // Loot from table if depleted
}
```

### `isNodeDepleted(nodeId: string): boolean`
Check if node is currently depleted and respawning.

### `getNodeState(nodeId: string): ResourceNodeState | undefined`
Get current node state.

### `removeNode(nodeId: string): void`
Remove a node instance.

### `cleanup(): void`
Clean up all nodes and timers (called on deactivate).

## Example: Fishing Integration

```typescript
// Register fishing spot
this.resourceManager.registerNodeType('Salmon_Spot', {
    name: 'Salmon Fishing Spot',
    maxHp: 50,
    respawnTime: 120000,  // 2 minutes
    items: [
        [70, 'Raw_Salmon'],
        [20, 'Raw_Trout'],
        [10, 'Old_Boot']  // Junk item
    ]
});

// Spawn fishing spots around lake
this.resourceManager.spawnNode('fishing_spot_001', 'Salmon_Spot', { x: 500, y: 600 });
this.resourceManager.spawnNode('fishing_spot_002', 'Salmon_Spot', { x: 520, y: 630 });

// When player casts fishing rod
const result = this.resourceManager.damageNode('fishing_spot_001', 25);
if (result?.depleted) {
    // Fishing spot depleted, will respawn in 2 minutes
    player.inventory.addItem(result.item);
}
```

## License

GPL-3.0
