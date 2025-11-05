[![Wyrt](https://github.com/LoxleyXI/Wyrt/blob/main/modules/wyrt_admin/www/public/Wyrt.png)](https://github.com/LoxleyXI/Wyrt)

# Wyrt - Modular MMO Engine

A TypeScript-based server framework for creating scalable multiplayer games with hot-reloadable modules, WebSocket communication, and integrated web interfaces.

## Features

- **Modular Architecture**: Game systems as independent, reusable modules
- **Hot Reload**: Modules auto-reload on file changes during development
- **WebSocket API**: Real-time JSON communication on port 8080
- **Integrated Web UIs**: Automatic Next.js/Vite frontend hosting via WebManager
- **Authentication**: JWT-based auth with bcrypt password hashing
- **Rate Limiting**: Token bucket algorithm for request throttling
- **Database Support**: MariaDB/MySQL with connection pooling

## Module System

### Core Modules (wyrt_*)

Framework modules that provide reusable game systems:

- **wyrt_core**: Base functionality, authentication, character management
- **wyrt_admin**: Web-based admin panel with server monitoring
- **wyrt_ctf**: Complete Capture the Flag demo game
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
        // Access database, events, commands, etc. via context
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
