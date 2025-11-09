[![Wyrt](https://github.com/LoxleyXI/Wyrt/blob/main/modules/wyrt_admin/www/public/Wyrt.png)](https://github.com/LoxleyXI/Wyrt)

# Wyrt - Modular MMO Engine

A TypeScript-based server framework for creating scalable multiplayer games with hot-reloadable modules, WebSocket communication, and integrated web interfaces.

## Features

- **Modular Architecture**: Game systems as independent, reusable modules
- **Unified Authentication**: JWT tokens + bcrypt hashing, shared across all games
- **WebSocket API**: Real-time JSON communication on port 8080
- **HTTP REST API**: Authentication and data endpoints on port 4040
- **Database**: MariaDB/MySQL with mysql2/promise (async/await)
- **Character Hooks**: Game-specific data tied to shared account system
- **Integrated Web UIs**: Automatic Next.js/Vite frontend hosting via WebManager
- **Hot Reload**: Modules auto-reload on file changes during development
- **Rate Limiting**: Token bucket algorithm for request throttling

## Module System

### Core Modules (wyrt_*)

Framework modules that provide reusable game systems:

- **wyrt_core**: Base functionality, authentication, character management
- **wyrt_admin**: Web-based admin panel with server monitoring
- **wyrt_ctf**: Complete Capture the Flag demo game
- **wyrt_skills**: Skill progression system with quadratic XP scaling
- **wyrt_2d**: 2D position tracking and utilities
- **wyrt_mobs**: Generic NPC/enemy system with AI
- **wyrt_collision**: Collision detection with sliding movement
- **wyrt_teams**: Team management with auto-balancing
- **wyrt_pickups**: Item pickup/spawn system
- **wyrt_projectiles**: Projectile physics and collision
- **wyrt_buffs**: Buff/debuff system with timers
- **wyrt_respawn**: Configurable respawn system
- **wyrt_combat**: Turn-based combat system
- **wyrt_items**: Item management
- **wyrt_rooms**: Abstract room system (2D/3D/text)

### Module Structure

```
modules/
  wyrt_example/
    index.ts          # Module entry point (implements IModule)
    package.json      # Module metadata with test scripts
    requests/         # WebSocket request handlers (auto-loaded)
    commands/         # Chat commands (auto-loaded)
    systems/          # Game logic classes
    data/             # YAML data files (auto-loaded)
    tests/            # Vitest unit tests
    www/              # Next.js/Vite frontend (auto-hosted)
```

### Creating a Module

```typescript
import { IModule, ModuleContext } from '../../src/module/IModule';

export default class MyGameModule implements IModule {
    name = 'my_game';
    version = '1.0.0';
    description = 'My awesome game';
    dependencies = ['wyrt_core', 'wyrt_teams'];

    async initialize(context: ModuleContext): Promise<void> {
        // Register character hooks for game-specific data
        context.registerCharacterCreateHook('my_game', async (data, db) => {
            await db.query(
                "INSERT INTO my_game_stats (character_id, level, xp) VALUES (?, ?, ?)",
                [data.characterId, 1, 0]
            );
        });

        context.registerCharacterSelectHook('my_game', async ({user, character, db}) => {
            const [stats] = await db.query(
                "SELECT * FROM my_game_stats WHERE character_id = ?",
                [character.id]
            );
            user.player.stats = stats[0];
        });
    }

    async activate(): Promise<void> {
        // Module is ready, start game loops
    }

    async deactivate(): Promise<void> {
        // Cleanup on shutdown
    }
}
```

### Request Handlers

Request handlers in `requests/` are automatically registered:

```typescript
// requests/enterGame.ts
import { Request } from '../../../src/types/Request';
import { User } from '../../../src/types/User';

const handler: Request = {
    cost: 5,        // Rate limit cost
    auth: false,    // Requires authentication?

    exec: async function(u: User, data: any, payload: any, context?: any) {
        // Handle request
        u.send(JSON.stringify({ type: 'gameState', data: {...} }));
    }
};

export default handler;
```

## Authentication

Wyrt provides unified authentication for all games:

**HTTP Endpoints** (`/api/auth/*`):
- `POST /api/auth/register` - Create account (bcrypt hashed)
- `POST /api/auth/login` - Get JWT token
- `GET /api/auth/verify` - Validate token

**WebSocket Handlers** (`wyrt_core/requests/*`):
- `auth` - Authenticate with JWT token
- `createCharacter` - Create game character (requires auth)
- `listCharacters` - List player's characters
- `selectCharacter` - Load character (triggers game hooks)

**Database Schema**:
- `accounts` - Shared across all games (username, password_hash, email)
- `characters` - Per-game characters (linked by account_id, game_id)
- `{game}_stats` - Game-specific data (linked by character_id)

See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) for complete implementation guide.

## WebManager

Automatically discovers and serves module frontends:

- Scans `modules/*/www/` for Next.js/Vite projects
- Assigns ports 8000-8099 alphabetically
- Installs dependencies and starts dev servers
- Module names starting with `wyrt_` load first

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Database**
   ```bash
   cp config/default/server.json config/server.json
   # Edit config/server.json with your database credentials
   ```

3. **Start Server**
   ```bash
   npm start
   ```

4. **Access Interfaces**
   - Admin Panel: http://localhost:8000
   - CTF Demo: http://localhost:8001
   - HTTP API: http://localhost:4040
   - WebSocket: ws://localhost:8080

## Demo: Capture the Flag

The `wyrt_ctf` module demonstrates a complete multiplayer game:

- Team-based gameplay with auto-balancing
- Real-time position sync and collision
- Flag capture mechanics with scoring
- Weapon pickups and projectile combat
- Buffs (speed boost, shield)
- Respawn system with spawn points
- Next.js frontend with Phaser.js rendering

**Play Online**: https://ctf.loxley.games

## Configuration

```json
{
  "db": {
    "host": "localhost",
    "user": "root",
    "password": "your-password",
    "database": "wyrt"
  },
  "ports": {
    "web": 4040,     // HTTP API
    "socket": 8080   // WebSocket
  },
  "options": {
    "dev": true,     // Enable hot reload
    "web": true,     // Enable WebManager
    "nodb": false    // Run without database
  }
}
```

## Architecture

- **TypeScript** with ES modules
- **WebSocket** for real-time communication
- **ModuleManager**: Two-phase loading (initialize → activate)
- **Event System**: EventEmitter for module communication
- **Data Loaders**: Automatic YAML file loading
- **Hot Reload**: File watchers for development

## Development

```bash
# Watch mode (auto-restart on changes)
npm start

# Run all module tests (auto-discovers modules with tests/)
npm test

# Test a specific module directly
npm --prefix modules/wyrt_collision test
npm --prefix modules/wyrt_respawn test
npm --prefix modules/wyrt_ctf test
```

### Testing

Tests are organized per-module in each module's `tests/` directory. The root `npm test` command automatically discovers and runs tests for all modules that have a `tests/` directory.

**Benefits:**
- Automatic test discovery (no hardcoded module lists)
- Independent testing of each module
- Clear test ownership
- Easy module extraction/publishing
- Test code living alongside implementation

**Module test scripts:**
Each module with tests includes these scripts in its `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

The root test runner (`scripts/test-modules.js`) automatically finds all modules with `tests/` directories and runs their test suites.

## License

GPL-3.0 - See LICENSE file for details

## Links

- **Repository**: https://github.com/LoxleyXI/Wyrt
- **Live Demo**: https://ctf.loxley.games
- **Admin Panel**: https://wyrt.loxley.games
