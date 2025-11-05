# Wyrt CTF - Capture The Flag Demo

A complete multiplayer Capture the Flag game built on the Wyrt MMO Engine, demonstrating how to build real-time multiplayer games using Wyrt's modular architecture.

## Features

- **Real-time Multiplayer**: WebSocket-based synchronization for smooth gameplay
- **Team-based Combat**: Red vs Blue teams with flag capture mechanics
- **Weapons & Pickups**: Multiple weapon types with respawn timers
- **Collision System**: Circle-rectangle collision for players and walls
- **Buff System**: Speed boosts and shields
- **Projectile Combat**: Real-time projectile firing and hit detection
- **Match Lifecycle**: Automatic game start, scoring, and match end

## Architecture

### Server-Side (TypeScript)

**Module Entry Point**: `index.ts`
- Registers event handlers
- Initializes CTFGameManager
- Broadcasts game state to all clients

**Core Systems**:
- `CTFGameManager.ts` - Main game loop, state management, player lifecycle
- `FlagManager.ts` - Flag pickup, capture, drop, and return logic
- `systems/` - Reusable game systems from core modules

**Request Handlers** (`requests/`):
- `ctfEnterGame.ts` - Player join and team assignment
- `ctfMove.ts` - Player movement with collision detection
- `ctfPickupFlag.ts` - Flag interaction
- `ctfPickupWeapon.ts` - Weapon pickup
- `ctfShoot.ts` - Projectile firing
- `ctfUseItem.ts` - Buff activation

**Map Configuration**: `data/maps/ctf_arena.json`
- Arena dimensions and walls
- Spawn points for teams
- Flag base positions
- Weapon spawn locations

### Client-Side (Next.js 15 + React)

**Frontend**: `www/` directory
- Next.js 15 with App Router
- WebSocket connection via `lib/ctfSocket.ts`
- Canvas-based rendering with 60 FPS game loop

**Key Components**:
- `Game.tsx` - Main game component, WebSocket message handling
- `GameCanvas.tsx` - 2D rendering (players, flags, projectiles, walls)
- `GameUI.tsx` - HUD (scores, timer, status)
- `NameEntry.tsx` - Player name entry and connection

**State Management**:
- Zustand store (`store/gameStore.ts`) for game state
- Real-time updates via WebSocket events

## Module Dependencies

```typescript
dependencies = [
  'wyrt_core',       // Core authentication, character management
  'wyrt_collision',  // Collision detection algorithms
  'wyrt_teams',      // Team management
  'wyrt_pickups',    // Pickup items with respawn
  'wyrt_projectiles',// Projectile system
  'wyrt_buffs'       // Temporary buff effects
]
```

## Game Flow

1. **Player Joins**: Enters name → Server assigns to team
2. **Game Start**: Automatically starts when ≥2 players
3. **Gameplay**:
   - Move around the arena (WASD)
   - Pick up enemy flag from their base
   - Return to your base with flag to score
   - Use weapons and buffs strategically
4. **Win Condition**: First team to capture limit (default: 3) wins
5. **Match End**: Shows winner, resets after 10 seconds

## Event Architecture

Server emits events via `context.events.emit()`:
- `ctf:playerJoined` - New player enters
- `ctf:playerMoved` - Position update
- `ctf:flagPickedUp` - Flag taken
- `ctf:flagCaptured` - Team scores
- `ctf:projectileFired` - Weapon fired
- `ctf:playerKilled` - Player eliminated
- `ctf:matchEnded` - Game over

Events are broadcast to all connected clients via WebSocket.

## Creating Your Own Game

Use this CTF module as a template:

1. **Copy Module Structure**:
   ```bash
   cp -r modules/wyrt_ctf modules/your_game
   ```

2. **Update Dependencies**: Modify `index.ts` to include only what you need

3. **Create Game Manager**: Build your core game loop (see `CTFGameManager.ts`)

4. **Define Request Handlers**: Create `requests/*.ts` for player actions

5. **Build Frontend**: Use `www/` as starting point for your UI

6. **Configure Map Data**: Create JSON files in `data/` for levels/maps

## Development

```bash
# Install dependencies
npm install

# Start Wyrt server (from root)
npm start

# Frontend starts automatically on http://localhost:8000
# WebSocket connects to ws://localhost:8080
```

## Configuration

Set module-specific options in `config/server.json`:

```json
{
  "modules": {
    "enabled": ["wyrt_core", "wyrt_collision", "wyrt_teams",
                "wyrt_pickups", "wyrt_projectiles", "wyrt_buffs", "wyrt_ctf"]
  },
  "options": {
    "ctf": true,
    "web": true
  }
}
```

## Testing

```bash
# Run collision tests
npm test -- tests/collision

# Run flag manager tests
npm test -- tests/flags

# Run all CTF tests
npm test
```

## Key Learnings

- **Module System**: How to structure reusable game modules
- **WebSocket Communication**: Real-time state synchronization
- **Game Loop**: Server-side game tick and client prediction
- **Collision Detection**: Circle-rectangle and circle-circle algorithms
- **State Management**: Handling game state on both server and client
- **Event-Driven Architecture**: Decoupled systems communicating via events

## License

GPL-3.0 - See main Wyrt LICENSE file
