/**
 * @module wyrt_data
 * @description Generic game data layer for Wyrt games
 * @category Core
 *
 * Provides a database-driven game content system where games are defined
 * entirely by data. All content is scoped by gameId, allowing multiple
 * games to share one database.
 *
 * @features
 * - Multi-game support with gameId scoping
 * - Slug-based content references (human-readable, portable)
 * - JSONB flexibility for game-specific extensions
 * - Content vs State separation
 * - Ready for Wyrt AI game generation
 *
 * @usage
 * ```typescript
 * const dataModule = context.getModule('wyrt_data');
 * const db = dataModule.getDatabase();
 *
 * // Load all items for a game
 * const items = await db.item.findMany({
 *   where: { gameId: 'my_game' }
 * });
 *
 * // Get item by slug
 * const sword = await dataModule.getItem('my_game', 'iron_sword');
 * ```
 */

import { IModule } from '../../src/module/IModule.js';
import { ModuleContext } from '../../src/module/ModuleContext.js';
import { PrismaClient } from '@prisma/client';

// Re-export Prisma types
export * from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface GameContent {
  items: Map<string, any>;
  entities: Map<string, any>;
  locations: Map<string, any>;
  abilities: Map<string, any>;
  quests: Map<string, any>;
  recipes: Map<string, any>;
  archetypes: Map<string, any>;
  dialogues: Map<string, any>;
  skills: Map<string, any>;
  lootTables: Map<string, any>;
  achievements: Map<string, any>;
}

// =============================================================================
// Module
// =============================================================================

export default class DataModule implements IModule {
  name = 'wyrt_data';
  version = '1.0.0';
  description = 'Generic game data layer for Wyrt games';
  dependencies = [];

  private context?: ModuleContext;
  private prisma?: PrismaClient;

  // Cached content per game
  private contentCache: Map<string, GameContent> = new Map();

  async initialize(context: ModuleContext): Promise<void> {
    this.context = context;
    context.logger.info('[wyrt_data] Initializing data module...');

    // Initialize Prisma client
    this.prisma = new PrismaClient();
    await this.prisma.$connect();

    context.logger.info('[wyrt_data] ✓ Database connected');
  }

  async activate(context: ModuleContext): Promise<void> {
    context.logger.info('[wyrt_data] Data module activated');
  }

  async deactivate(context: ModuleContext): Promise<void> {
    // Disconnect from database
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
    this.contentCache.clear();
    context.logger.info('[wyrt_data] Data module deactivated');
  }

  // ===========================================================================
  // Database Access
  // ===========================================================================

  /**
   * Get the Prisma client for direct database access.
   */
  getDatabase(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Data module not initialized');
    }
    return this.prisma;
  }

  // ===========================================================================
  // Game Management
  // ===========================================================================

  /**
   * Get a game by slug.
   */
  async getGame(slug: string) {
    return this.prisma!.game.findUnique({
      where: { slug },
    });
  }

  /**
   * List all active games.
   */
  async listGames(publicOnly = false) {
    return this.prisma!.game.findMany({
      where: {
        isActive: true,
        ...(publicOnly ? { isPublic: true } : {}),
      },
    });
  }

  /**
   * Get a platform and its lairs.
   */
  async getPlatformWithLairs(platformSlug: string) {
    return this.prisma!.game.findUnique({
      where: { slug: platformSlug },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  /**
   * List lairs for a platform.
   */
  async listLairs(platformId: string, options: { publicOnly?: boolean; ownerId?: string } = {}) {
    return this.prisma!.game.findMany({
      where: {
        parentId: platformId,
        type: 'lair',
        isActive: true,
        ...(options.publicOnly ? { isPublic: true } : {}),
        ...(options.ownerId ? { ownerId: options.ownerId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Create a new lair under a platform.
   */
  async createLair(platformId: string, data: {
    slug: string;
    name: string;
    description?: string;
    ownerId: string;
    settings?: any;
    isPublic?: boolean;
  }) {
    // Get platform for default settings
    const platform = await this.prisma!.game.findUnique({
      where: { id: platformId },
    });

    if (!platform || platform.type !== 'platform') {
      throw new Error('Invalid platform');
    }

    // Merge platform defaults with lair settings
    const template = (platform.template as any) || {};
    const defaultSettings = template.defaultSettings || {};
    const mergedSettings = { ...defaultSettings, ...data.settings };

    return this.prisma!.game.create({
      data: {
        slug: data.slug,
        name: data.name,
        description: data.description,
        type: 'lair',
        parentId: platformId,
        ownerId: data.ownerId,
        settings: mergedSettings,
        isPublic: data.isPublic ?? false,
        isActive: true,
      },
    });
  }

  // ===========================================================================
  // Content Loading
  // ===========================================================================

  /**
   * Resolve a game identifier (slug or ID) to a game ID.
   */
  private async resolveGameId(gameIdOrSlug: string): Promise<string> {
    // If it looks like a UUID, use it directly
    if (gameIdOrSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return gameIdOrSlug;
    }

    // Otherwise, look up by slug
    const game = await this.prisma!.game.findUnique({
      where: { slug: gameIdOrSlug },
      select: { id: true },
    });

    if (!game) {
      throw new Error(`Game not found: ${gameIdOrSlug}`);
    }

    return game.id;
  }

  /**
   * Load all content for a game into memory.
   * Accepts either game ID (UUID) or game slug.
   * Returns cached content if already loaded.
   */
  async loadGameContent(gameIdOrSlug: string): Promise<GameContent> {
    // Resolve slug to ID if needed
    const gameId = await this.resolveGameId(gameIdOrSlug);

    // Check cache
    if (this.contentCache.has(gameId)) {
      return this.contentCache.get(gameId)!;
    }

    this.context?.logger.info(`[wyrt_data] Loading content for game: ${gameIdOrSlug}`);

    const [
      items,
      entities,
      locations,
      abilities,
      quests,
      recipes,
      archetypes,
      dialogues,
      skills,
      lootTables,
      achievements,
    ] = await Promise.all([
      this.prisma!.item.findMany({ where: { gameId } }),
      this.prisma!.entity.findMany({ where: { gameId } }),
      this.prisma!.location.findMany({ where: { gameId } }),
      this.prisma!.ability.findMany({ where: { gameId } }),
      this.prisma!.quest.findMany({ where: { gameId } }),
      this.prisma!.recipe.findMany({ where: { gameId } }),
      this.prisma!.archetype.findMany({ where: { gameId } }),
      this.prisma!.dialogue.findMany({ where: { gameId } }),
      this.prisma!.skill.findMany({ where: { gameId } }),
      this.prisma!.lootTable.findMany({ where: { gameId } }),
      this.prisma!.achievement.findMany({ where: { gameId } }),
    ]);

    const content: GameContent = {
      items: new Map(items.map((i) => [i.slug, i])),
      entities: new Map(entities.map((e) => [e.slug, e])),
      locations: new Map(locations.map((l) => [l.slug, l])),
      abilities: new Map(abilities.map((a) => [a.slug, a])),
      quests: new Map(quests.map((q) => [q.slug, q])),
      recipes: new Map(recipes.map((r) => [r.slug, r])),
      archetypes: new Map(archetypes.map((a) => [a.slug, a])),
      dialogues: new Map(dialogues.map((d) => [d.slug, d])),
      skills: new Map(skills.map((s) => [s.slug, s])),
      lootTables: new Map(lootTables.map((l) => [l.slug, l])),
      achievements: new Map(achievements.map((a) => [a.slug, a])),
    };

    this.contentCache.set(gameId, content);

    this.context?.logger.info(
      `[wyrt_data] ✓ Loaded content: ${items.length} items, ${entities.length} entities, ` +
        `${locations.length} locations, ${abilities.length} abilities, ${quests.length} quests`
    );

    return content;
  }

  /**
   * Reload content for a game (clears cache first).
   */
  async reloadGameContent(gameId: string): Promise<GameContent> {
    this.contentCache.delete(gameId);
    return this.loadGameContent(gameId);
  }

  /**
   * Get cached content for a game.
   * Returns undefined if not loaded.
   */
  getGameContent(gameId: string): GameContent | undefined {
    return this.contentCache.get(gameId);
  }

  // ===========================================================================
  // Content Accessors (by slug)
  // ===========================================================================

  /**
   * Get an item by slug (from cache or database).
   */
  async getItem(gameId: string, slug: string) {
    const cached = this.contentCache.get(gameId)?.items.get(slug);
    if (cached) return cached;

    return this.prisma!.item.findUnique({
      where: { gameId_slug: { gameId, slug } },
    });
  }

  /**
   * Get an entity by slug.
   */
  async getEntity(gameId: string, slug: string) {
    const cached = this.contentCache.get(gameId)?.entities.get(slug);
    if (cached) return cached;

    return this.prisma!.entity.findUnique({
      where: { gameId_slug: { gameId, slug } },
    });
  }

  /**
   * Get a location by slug.
   */
  async getLocation(gameId: string, slug: string) {
    const cached = this.contentCache.get(gameId)?.locations.get(slug);
    if (cached) return cached;

    return this.prisma!.location.findUnique({
      where: { gameId_slug: { gameId, slug } },
    });
  }

  /**
   * Get an ability by slug.
   */
  async getAbility(gameId: string, slug: string) {
    const cached = this.contentCache.get(gameId)?.abilities.get(slug);
    if (cached) return cached;

    return this.prisma!.ability.findUnique({
      where: { gameId_slug: { gameId, slug } },
    });
  }

  /**
   * Get a quest by slug.
   */
  async getQuest(gameId: string, slug: string) {
    const cached = this.contentCache.get(gameId)?.quests.get(slug);
    if (cached) return cached;

    return this.prisma!.quest.findUnique({
      where: { gameId_slug: { gameId, slug } },
    });
  }

  /**
   * Get a recipe by slug.
   */
  async getRecipe(gameId: string, slug: string) {
    const cached = this.contentCache.get(gameId)?.recipes.get(slug);
    if (cached) return cached;

    return this.prisma!.recipe.findUnique({
      where: { gameId_slug: { gameId, slug } },
    });
  }

  /**
   * Get an archetype by slug.
   */
  async getArchetype(gameId: string, slug: string) {
    const cached = this.contentCache.get(gameId)?.archetypes.get(slug);
    if (cached) return cached;

    return this.prisma!.archetype.findUnique({
      where: { gameId_slug: { gameId, slug } },
    });
  }

  /**
   * Get a dialogue by slug.
   */
  async getDialogue(gameId: string, slug: string) {
    const cached = this.contentCache.get(gameId)?.dialogues.get(slug);
    if (cached) return cached;

    return this.prisma!.dialogue.findUnique({
      where: { gameId_slug: { gameId, slug } },
    });
  }

  /**
   * Get a skill by slug.
   */
  async getSkill(gameId: string, slug: string) {
    const cached = this.contentCache.get(gameId)?.skills.get(slug);
    if (cached) return cached;

    return this.prisma!.skill.findUnique({
      where: { gameId_slug: { gameId, slug } },
    });
  }

  /**
   * Get a loot table by slug.
   */
  async getLootTable(gameId: string, slug: string) {
    const cached = this.contentCache.get(gameId)?.lootTables.get(slug);
    if (cached) return cached;

    return this.prisma!.lootTable.findUnique({
      where: { gameId_slug: { gameId, slug } },
    });
  }

  // ===========================================================================
  // Query Helpers
  // ===========================================================================

  /**
   * Get items by type.
   */
  async getItemsByType(gameId: string, type: string) {
    const cached = this.contentCache.get(gameId)?.items;
    if (cached) {
      return Array.from(cached.values()).filter((i) => i.type === type);
    }

    return this.prisma!.item.findMany({
      where: { gameId, type },
    });
  }

  /**
   * Get entities by type.
   */
  async getEntitiesByType(gameId: string, type: string) {
    const cached = this.contentCache.get(gameId)?.entities;
    if (cached) {
      return Array.from(cached.values()).filter((e) => e.type === type);
    }

    return this.prisma!.entity.findMany({
      where: { gameId, type },
    });
  }

  /**
   * Get entities at a location.
   */
  async getEntitiesAtLocation(gameId: string, locationSlug: string) {
    const cached = this.contentCache.get(gameId)?.entities;
    if (cached) {
      return Array.from(cached.values()).filter((e) => e.locationSlug === locationSlug);
    }

    return this.prisma!.entity.findMany({
      where: { gameId, locationSlug },
    });
  }

  /**
   * Get quests by type.
   */
  async getQuestsByType(gameId: string, type: string) {
    const cached = this.contentCache.get(gameId)?.quests;
    if (cached) {
      return Array.from(cached.values()).filter((q) => q.type === type);
    }

    return this.prisma!.quest.findMany({
      where: { gameId, type },
    });
  }

  /**
   * Get recipes by skill.
   */
  async getRecipesBySkill(gameId: string, skillSlug: string) {
    const cached = this.contentCache.get(gameId)?.recipes;
    if (cached) {
      return Array.from(cached.values()).filter((r) => r.skillSlug === skillSlug);
    }

    return this.prisma!.recipe.findMany({
      where: { gameId, skillSlug },
    });
  }

  /**
   * Get child locations.
   */
  async getChildLocations(gameId: string, parentSlug: string) {
    const cached = this.contentCache.get(gameId)?.locations;
    if (cached) {
      return Array.from(cached.values()).filter((l) => l.parentSlug === parentSlug);
    }

    return this.prisma!.location.findMany({
      where: { gameId, parentSlug },
    });
  }

  // ===========================================================================
  // Loot Generation
  // ===========================================================================

  /**
   * Roll loot from a loot table.
   */
  async rollLoot(
    gameId: string,
    lootTableSlug: string,
    bonusChance = 0
  ): Promise<Array<{ itemSlug: string; quantity: number }>> {
    const table = await this.getLootTable(gameId, lootTableSlug);
    if (!table) return [];

    const results: Array<{ itemSlug: string; quantity: number }> = [];

    // Guaranteed drops
    const guaranteed = (table.guaranteed as any[]) || [];
    for (const drop of guaranteed) {
      results.push({
        itemSlug: drop.itemSlug,
        quantity: drop.qty || drop.quantity || 1,
      });
    }

    // Roll entries
    const entries = (table.entries as any[]) || [];
    const rolls = table.rolls || 1;

    for (let i = 0; i < rolls; i++) {
      for (const entry of entries) {
        const chance = (entry.chance || 0) + bonusChance;
        if (Math.random() < chance) {
          const minQty = entry.minQty || 1;
          const maxQty = entry.maxQty || entry.minQty || 1;
          const quantity = Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;

          results.push({
            itemSlug: entry.itemSlug,
            quantity,
          });
        }
      }
    }

    return results;
  }
}
