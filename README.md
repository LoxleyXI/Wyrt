[![Wyrt](https://github.com/LoxleyXI/Wyrt/blob/main/www/static/img/Wyrt.png)](https://github.com/LoxleyXI/Wyrt)

Wyrt - An MMO Engine
==
Wyrt is a server for creating scalable live service games. It dynamically reloads live content, handles player connections, commands, battles, skills, quests and much more.

Overview
===
* The server handles requests in JSON over Websockets and returns JSON results
* Content is loaded live from YAML files located in the `data` directory
* Persistent storage is provided by MariaDB

Features
===
* Quests - New quests can be created by following a simple YAML template
* Skills - Any number of skills can be created with automatic checks for requirements and skillups
* Crafting - Recipes can be provided for any skill and include additional requirements
* Combat - By default, Wyrt features a turn-based combat system but its behaviour can also be overridden
* Abilities - Combat abilities can be assigned to players and mobs, with handling for cooldowns and additional effects

Setup
===
* Copy `config/default/server.json` to `config/server.json` and update the details
* For https, add any required certificates to `config/`
* Add your game data to `data/` or copy `data/example` into `data/`
* Launch the game server using `npm start`
* (Optional) launch the web client `npm run www`

Data
===

Items
====
Example:
```yaml
Gold:
  name: a gold coin
  desc: A valuable piece of traded currency.
  icon: 517
  value: 1
```

Mobs
====
Example:
```yaml
Buzzard:
  desc: An imposing predator with large wings.
  level: [12, 14]
  skills: []
  respawn: 360
  items:
    - [25, Medium_Feather]
    - [ 5, Bone_Fragment]
```

Commands
===

setvar (name) (value)
====
Create or update a player variable
