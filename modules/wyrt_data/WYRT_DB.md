# Wyrt Database Architecture

This document explains the Wyrt generic database schema and how to build games on top of it.

## Philosophy: Games as Data

In Wyrt, a **game is defined entirely by data**, not code. The database contains:
- **Content tables** - Define what exists in the game (items, mobs, locations, quests)
- **State tables** - Track player progress (inventory, quest progress, skills)

The Wyrt engine interprets this data at runtime. This means:
- New games are created by inserting records, not writing code
- Games can be cloned by copying data with a new `gameId`
- AI can generate games by producing database records
- One frontend can render any Wyrt game

## Core Concepts

### The Game Container

Every piece of content is scoped to a `Game`. Games can be standalone or hierarchical:

```
Wyrt Engine
├── MyGame (type: 'game', standalone)
├── Lairs (type: 'platform', hosts sub-games)
│   ├── Fantasy MUD (type: 'lair', parentId: lairs)
│   ├── Sci-Fi Adventure (type: 'lair', parentId: lairs)
│   └── Horror Escape (type: 'lair', parentId: lairs)
└── Wyrt AI Generated Games...
```

```sql
-- Standalone game
INSERT INTO "Game" (slug, name, type) VALUES
  ('my_game', 'MyGame', 'game');

-- Platform that hosts sub-games
INSERT INTO "Game" (slug, name, type) VALUES
  ('lairs', 'Lairs', 'platform');

-- Sub-game (lair) within the platform
INSERT INTO "Game" (slug, name, type, "parentId", "ownerId") VALUES
  ('fantasy-mud', 'Fantasy MUD', 'lair',
   (SELECT id FROM "Game" WHERE slug = 'lairs'),
   'user-123');
```

**Game Types:**
| Type | Description | Example |
|------|-------------|---------|
| `game` | Standalone game | MyGame |
| `platform` | Hosts multiple sub-games | Lairs |
| `lair` | Sub-game within a platform | A user-created MUD |
| `instance` | Per-player/party copy | Dungeon instance |

All content tables have:
- `gameId` - Foreign key to Game
- `slug` - Human-readable identifier, unique within game
- `@@unique([gameId, slug])` - Ensures uniqueness per game

### Slug-Based References

Content references other content by **slug**, not UUID:

```json
// Entity references items by slug
{
  "lootInline": [
    { "itemSlug": "iron_sword", "chance": 0.1 },
    { "itemSlug": "gold_coin", "chance": 1.0, "minQty": 5, "maxQty": 20 }
  ]
}

// Quest references entities by slug
{
  "giverSlug": "village_elder",
  "objectives": [
    { "type": "kill", "target": "goblin", "count": 10 }
  ]
}
```

**Why slugs?**
- Human-readable in data exports
- Portable across environments
- Easy to reference in code/config
- Meaningful in URLs (`/items/iron_sword`)

### Content vs State Tables

| Content Tables | State Tables |
|----------------|--------------|
| Define the game | Track player progress |
| Read-only at runtime | Read-write at runtime |
| Game, Item, Entity, Location, Quest, Recipe, Archetype, Dialogue, Skill, LootTable, Achievement | Character, InventoryItem, Equipment, QuestProgress, CharacterSkill, CharacterBuff, CharacterAchievement |

**Content** is loaded once and cached. **State** is per-player and persisted.

### JSONB Flexibility

Every table uses JSONB fields for game-specific data:

| Field | Purpose | Example |
|-------|---------|---------|
| `stats` | Numeric attributes | `{ "attack": 10, "defense": 5, "speed": 8 }` |
| `effects` | Triggered effects | `{ "onUse": [{ "heal": 50 }], "passive": [] }` |
| `requirements` | Unlock conditions | `{ "level": 10, "quest": "intro_complete" }` |
| `properties` | Game-specific extensions | `{ "customField": "value" }` |

This means:
- No schema migrations for new features
- Games can add custom fields
- Same table structure, different game logic

## Table Reference

### Content Tables

#### Game
The container for all game content.

```typescript
{
  slug: "my_game",
  name: "MyGame",
  settings: {
    combatMode: "real_time",
    tickInterval: 2000,
    startingLocation: "starting_village",
    maxPartySize: 4
  },
  features: {
    pvpEnabled: false,
    guildsEnabled: true,
    tradingEnabled: true
  }
}
```

#### Item
All items: weapons, armor, consumables, materials, quest items.

```typescript
// Weapon
{
  slug: "iron_sword",
  name: "Iron Sword",
  type: "weapon",
  subtype: "sword",
  rarity: "common",
  slot: "mainhand",
  stats: { attack: 15, speed: 10 },
  requirements: { level: 5 },
  sellPrice: 50,
  buyPrice: 100
}

// Consumable
{
  slug: "health_potion",
  name: "Health Potion",
  type: "consumable",
  effects: { onUse: [{ type: "heal", amount: 50 }] },
  stackable: true,
  maxStack: 99
}

// Material
{
  slug: "iron_ore",
  name: "Iron Ore",
  type: "material",
  subtype: "ore",
  stackable: true
}
```

#### Entity
Mobs, NPCs, bosses, pets, allies.

```typescript
// Combat mob
{
  slug: "goblin",
  name: "Goblin",
  type: "mob",
  subtype: "humanoid",
  level: 5,
  stats: { hp: 100, attack: 10, defense: 5, speed: 8 },
  abilities: ["basic_attack", "goblin_stab"],
  lootTable: "goblin_drops",
  expReward: 25,
  goldReward: 10,
  behavior: { aggression: "aggressive", preferredTargets: "random" }
}

// NPC
{
  slug: "blacksmith_tom",
  name: "Tom the Blacksmith",
  type: "npc",
  subtype: "merchant",
  dialogueSlug: "blacksmith_intro",
  shopItems: [
    { itemSlug: "iron_sword", stock: 5 },
    { itemSlug: "iron_armor", stock: 3 }
  ],
  quests: ["forge_apprentice"]
}
```

#### Location
Regions, areas, rooms, dungeons.

```typescript
{
  slug: "starting_village",
  name: "Millbrook Village",
  type: "area",
  description: "A peaceful village nestled in the hills.",
  exits: {
    north: "village_gate",
    east: "marketplace",
    south: "village_inn"
  },
  entities: ["villager", "guard"],
  isSafeZone: true,
  assets: {
    background: "village_bg.png",
    music: "peaceful_village.mp3"
  }
}
```

#### Quest
Main quests, side quests, dailies, repeatables.

```typescript
{
  slug: "kill_goblins",
  name: "Goblin Menace",
  type: "side",
  giverSlug: "village_elder",
  objectives: [
    { type: "kill", target: "goblin", count: 10, description: "Kill 10 Goblins" }
  ],
  rewards: {
    exp: 100,
    gold: 50,
    items: [{ slug: "health_potion", qty: 5 }]
  },
  requirements: { level: 3 },
  nextQuestSlug: "goblin_chief"
}
```

#### Recipe
Crafting, cooking, alchemy, smithing.

```typescript
{
  slug: "iron_sword_recipe",
  name: "Forge Iron Sword",
  type: "smithing",
  outputSlug: "iron_sword",
  outputQty: 1,
  ingredients: [
    { itemSlug: "iron_ore", quantity: 3 },
    { itemSlug: "coal", quantity: 1 }
  ],
  skillSlug: "smithing",
  skillLevel: 10,
  station: "forge",
  expReward: 50
}
```

### State Tables

#### Character
A player's character in a game.

```typescript
{
  gameId: "uuid",
  userId: "user-123",
  name: "Heroname",
  archetypeSlug: "warrior",
  level: 25,
  experience: 50000,
  stats: { hp: 500, attack: 100, defense: 75 },  // Calculated
  currency: { gold: 5000, gems: 10 },
  locationSlug: "dark_forest",
  unlocks: {
    recipes: ["iron_sword", "steel_sword"],
    locations: ["dark_cave"]
  }
}
```

#### InventoryItem
Items owned by a character.

```typescript
// Stackable items
{ characterId: "char-1", itemSlug: "health_potion", quantity: 25 }
{ characterId: "char-1", itemSlug: "iron_ore", quantity: 150 }

// Unique item with instance data
{
  characterId: "char-1",
  itemSlug: "legendary_sword",
  quantity: 1,
  instanceData: {
    enchantments: ["fire_damage", "lifesteal"],
    durability: 85,
    sockets: ["ruby", null, null]
  }
}
```

#### QuestProgress
Quest state for a character.

```typescript
{
  characterId: "char-1",
  questSlug: "kill_goblins",
  status: "active",
  progress: { "kill_goblin": 7 },  // 7/10
  completions: 0
}
```

## Common Patterns

### Type Discrimination

Instead of separate tables for weapons, armor, consumables - use one `Item` table with `type`:

```sql
-- All in one table
SELECT * FROM "Item" WHERE "gameId" = $1 AND type = 'weapon';
SELECT * FROM "Item" WHERE "gameId" = $1 AND type = 'consumable';
```

Supported by index: `@@index([gameId, type])`

### Hierarchical Locations

Use `parentSlug` for region → area → room hierarchy:

```typescript
// Region
{ slug: "verdant_forest", type: "region", parentSlug: null }

// Area within region
{ slug: "forest_clearing", type: "area", parentSlug: "verdant_forest" }

// Room within area
{ slug: "hidden_cave", type: "room", parentSlug: "forest_clearing" }
```

### Loot Tables

Two options:

1. **Reusable LootTable**:
```typescript
// Define once
{ slug: "goblin_drops", entries: [
  { itemSlug: "gold_coin", chance: 1.0, minQty: 5, maxQty: 20 },
  { itemSlug: "goblin_ear", chance: 0.5 }
]}

// Reference in entity
{ slug: "goblin", lootTable: "goblin_drops" }
```

2. **Inline loot**:
```typescript
{ slug: "rare_goblin", lootInline: [
  { itemSlug: "rare_gem", chance: 0.1 }
]}
```

### Class Progression

Use `Archetype` with `parentSlug` for class trees:

```typescript
// Base class
{ slug: "fighter", tier: 1, parentSlug: null }

// Advanced classes
{ slug: "warrior", tier: 2, parentSlug: "fighter", requirements: { level: 20 } }
{ slug: "paladin", tier: 2, parentSlug: "fighter", requirements: { level: 20, quest: "holy_trial" } }

// Master classes
{ slug: "berserker", tier: 3, parentSlug: "warrior", requirements: { level: 50 } }
```

### Requirements Pattern

All content can have requirements for access/use:

```typescript
// Level requirement
{ requirements: { level: 10 } }

// Quest prerequisite
{ requirements: { quest: "intro_complete" } }

// Class restriction
{ requirements: { class: ["mage", "wizard"] } }

// Skill level
{ requirements: { skill: { mining: 20 } } }

// Multiple requirements (AND)
{ requirements: { level: 30, quest: "advanced_training", class: ["warrior"] } }
```

## Creating a New Game

### 1. Insert Game Record

```sql
INSERT INTO "Game" (slug, name, settings, features) VALUES (
  'my-rpg',
  'My Custom RPG',
  '{"combatMode": "turn_based", "startingLocation": "town_square"}',
  '{"pvpEnabled": true, "guildsEnabled": false}'
);
```

### 2. Add Core Content

```sql
-- Starting location
INSERT INTO "Location" (gameId, slug, name, type, description) VALUES
  ((SELECT id FROM "Game" WHERE slug = 'my-rpg'),
   'town_square', 'Town Square', 'area', 'The central plaza of the town.');

-- Starting class
INSERT INTO "Archetype" (gameId, slug, name, baseStats, startingItems) VALUES
  ((SELECT id FROM "Game" WHERE slug = 'my-rpg'),
   'adventurer', 'Adventurer',
   '{"hp": 100, "attack": 10, "defense": 5}',
   '["wooden_sword", "cloth_armor"]');

-- Basic items
INSERT INTO "Item" (gameId, slug, name, type, slot, stats) VALUES
  ((SELECT id FROM "Game" WHERE slug = 'my-rpg'),
   'wooden_sword', 'Wooden Sword', 'weapon', 'mainhand', '{"attack": 5}');
```

### 3. Configure Wyrt Module

```typescript
// In your game module
const combatManager = wyrtCombat.createCombatManager({
  gameId: 'my-rpg',
  mode: 'turn_based',
  calculateDamage: (params) => {
    // Your damage formula
  }
});
```

## Exporting/Importing Games

### Export
```sql
-- Export all content for a game
COPY (
  SELECT row_to_json(t) FROM (
    SELECT * FROM "Item" WHERE "gameId" = 'uuid-of-my-game'
  ) t
) TO '/tmp/items.json';
```

### Import
```sql
-- Import with new gameId
INSERT INTO "Item" (gameId, slug, name, type, ...)
SELECT 'new-game-uuid', slug, name, type, ...
FROM json_populate_recordset(null::"Item", pg_read_file('/tmp/items.json')::json);
```

## Wyrt AI Integration

Wyrt AI generates games by producing records:

```typescript
// AI generates an item
const item = await ai.generateItem({
  prompt: "A legendary fire sword for a level 50 warrior",
  gameId: "my-rpg"
});

// Result is inserted directly
await prisma.item.create({
  data: {
    gameId: "my-rpg",
    slug: "blazing_inferno",
    name: "Blazing Inferno",
    type: "weapon",
    subtype: "sword",
    rarity: "legendary",
    stats: { attack: 150, fireDamage: 50 },
    effects: { onHit: [{ type: "burn", damage: 10, duration: 5 }] },
    requirements: { level: 50, class: ["warrior"] }
  }
});
```

The AI doesn't need to know the game's code - just the schema.

## Best Practices

1. **Use slugs consistently** - `snake_case`, descriptive, unique within game
2. **Keep JSONB structured** - Document your JSON shapes per game
3. **Index wisely** - `[gameId, type]` and `[gameId, slug]` are pre-indexed
4. **Separate content from logic** - Content in DB, formulas in config
5. **Version your content** - Use Game.version for data migrations
6. **Test with exports** - Export → modify → import for content iteration

## Migration from Game-Specific Schema

If you have existing game-specific tables:

1. Map your tables to generic equivalents
2. Convert IDs to slugs
3. Move custom fields to JSONB `properties`
4. Update queries to include `gameId` filter
5. Update code to use slug-based lookups
