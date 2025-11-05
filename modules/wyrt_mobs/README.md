# wyrt_mobs

Generic NPC/enemy system for Wyrt games with AI, spawning, combat, and respawning.

## Features

- MobManager for lifecycle management
- YAML-based mob template loading
- AI behaviors (roaming, chasing, aggro)
- Health regeneration and respawning
- Combat system integration

## Usage

```typescript
import { MobManager, MobTemplate, MobEventCallbacks } from 'wyrt_mobs';

const templates: Record<string, MobTemplate> = {
  wolf: {
    id: 'wolf',
    name: 'Gray Wolf',
    baseHp: 15,
    hpPerLevel: 5,
    damage: 3,
    respawn: 30,
    hostile: true,
    roaming: true
  }
};

const callbacks: MobEventCallbacks = {
  onBroadcastToRoom: (roomPath, message) => {
    // Broadcast to players in room
  }
};

const mobManager = new MobManager(context, templates, callbacks);
mobManager.startRespawnTimer();
mobManager.startAI(getPlayerPositionCallback);
```

## License

GPL-3.0
