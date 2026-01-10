<p align="center">
  <img src="wyrt-logo.png" alt="Wyrt" width="120" height="120">
</p>

<h1 align="center">Wyrt Engine</h1>

<p align="center">
  <strong>The TypeScript MMO Framework</strong>
</p>

<p align="center">
  Build multiplayer games, not infrastructure.<br>
  Modular. Real-time. Ready to ship.
</p>

<p align="center">
  <a href="https://github.com/LoxleyXI/Wyrt/blob/main/LICENSE"><img src="https://img.shields.io/github/license/LoxleyXI/Wyrt?style=flat-square" alt="license"></a>
  <img src="https://img.shields.io/badge/runtime-Node.js-339933?style=flat-square" alt="Node.js">
  <img src="https://img.shields.io/badge/language-TypeScript-3178c6?style=flat-square" alt="TypeScript">
  <img src="https://img.shields.io/badge/modules-24+-blue?style=flat-square" alt="modules">
</p>

<p align="center">
  <a href="https://wyrt.dev">Website</a> •
  <a href="https://wyrt.dev/docs">Docs</a> •
  <a href="https://wyrt.dev/modules">Modules</a> •
  <a href="#quick-start">Quick Start</a>
</p>

---

## Why Wyrt

- **Modular architecture** — Pick only what you need: combat, inventory, quests, crafting
- **Real-time sync** — WebSocket rooms with automatic state broadcasting
- **Built-in auth** — JWT tokens, rate limiting, session management
- **Database ready** — MySQL/PostgreSQL via Prisma, shared accounts, per-game data
- **Hot reload** — YAML game data updates without restart
- **TypeScript-first** — Full type safety from server to client

## How It Works

Define game systems as modules. Wyrt handles the rest.

```typescript
export default class MyGameModule implements IModule {
  name = 'my_game';
  dependencies = ['wyrt_core', 'wyrt_combat', 'wyrt_inventory'];

  async initialize(context: ModuleContext) {
    // Your game logic here
  }
}
```

## Modules

24 reusable modules covering common MMO systems:

| Category | Modules |
|----------|---------|
| **Core** | auth, data, admin, rooms |
| **Gameplay** | combat, skills, quests, crafting |
| **Items** | inventory, equipment, pickups, loot |
| **Social** | party, friends, chat, teams |
| **World** | 2d, collision, mobs, projectiles |

## Quick Start

```bash
git clone https://github.com/LoxleyXI/Wyrt
cd Wyrt
npm install
cp config/default/server.json config/server.json
npm start
```

**Access points:**
- WebSocket: `ws://localhost:8080`
- HTTP API: `http://localhost:4040`
- Admin Panel: `http://localhost:8000`

## Configuration

```json
{
  "db": {
    "host": "localhost",
    "database": "wyrt"
  },
  "ports": {
    "web": 4040,
    "socket": 8080
  },
  "options": {
    "dev": true,
    "web": true
  }
}
```

## Links

- **Website:** [wyrt.dev](https://wyrt.dev)
- **Docs:** [wyrt.dev/docs](https://wyrt.dev/docs)
- **GitHub:** [github.com/LoxleyXI/Wyrt](https://github.com/LoxleyXI/Wyrt)

## License

GPL-3.0
