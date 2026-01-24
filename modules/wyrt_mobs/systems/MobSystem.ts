/**
 * Mob System
 *
 * Manages mob templates, instances, spawning, and respawning.
 * Uses Entity table from wyrt_data for mob definitions.
 */

import type { ModuleContext } from '../../../src/module/ModuleContext.js';
import type DataModule from '../../wyrt_data/index.js';

/**
 * Mob template from database (Entity with type='mob').
 */
export interface MobTemplate {
  id: string;
  slug: string;
  name: string;
  description?: string;
  type: string;         // 'mob', 'boss', 'miniboss'
  subtype?: string;     // 'humanoid', 'beast', 'undead'
  level: number;
  stats: {
    hp: number;
    maxHp?: number;
    attack: number;
    defense: number;
    magicAttack?: number;
    magicDefense?: number;
    speed?: number;
    [key: string]: number | undefined;
  };
  abilities: string[];
  lootTable?: string;
  lootInline?: Array<{
    itemSlug: string;
    chance: number;
    minQty?: number;
    maxQty?: number;
  }>;
  expReward: number;
  goldReward: number;
  spawnConfig: {
    respawnTime?: number;  // ms
    maxCount?: number;
    spawnChance?: number;
  };
  behavior: {
    aggression?: number;
    fleeThreshold?: number;
    preferredTargets?: string[];
  };
  element?: string;
  sprite?: string;
  properties: Record<string, any>;
}

/**
 * Live mob instance in a room.
 */
export interface MobInstance {
  instanceId: string;
  templateId: string;       // Entity.id
  templateSlug: string;     // Entity.slug
  name: string;
  roomId: string;
  currentHp: number;
  maxHp: number;
  level: number;
  stats: MobTemplate['stats'];
  spawnedAt: number;
  inCombat: boolean;
  combatSessionId?: string;
  threatTable: Map<string, number>;  // characterId -> threat
}

/**
 * Spawn point definition.
 */
export interface SpawnPoint {
  id: string;
  roomId: string;
  mobSlug: string;
  respawnTime: number;      // ms
  maxCount: number;
  lastSpawned: number;
  currentCount: number;
}

/**
 * Respawn queue entry.
 */
interface RespawnEntry {
  spawnPointId: string;
  respawnAt: number;
}

/**
 * Configuration for the mob system.
 */
export interface MobSystemConfig {
  /** Default respawn time in ms */
  defaultRespawnTime?: number;
  /** Maximum mobs per room */
  maxMobsPerRoom?: number;
  /** Respawn check interval in ms */
  respawnCheckInterval?: number;
}

/**
 * API for mob operations.
 */
export interface MobAPI {
  // Templates
  getTemplate(mobSlug: string): Promise<MobTemplate | undefined>;
  loadTemplates(): Promise<void>;

  // Instances
  spawnMob(mobSlug: string, roomId: string): MobInstance | undefined;
  despawnMob(instanceId: string): void;
  getMob(instanceId: string): MobInstance | undefined;
  getMobsInRoom(roomId: string): MobInstance[];
  findMobInRoom(roomId: string, search: string): MobInstance | undefined;

  // Combat integration
  damageMob(instanceId: string, amount: number, attackerId?: string): { killed: boolean; remainingHp: number };
  healMob(instanceId: string, amount: number): number;
  addThreat(instanceId: string, characterId: string, amount: number): void;
  getHighestThreat(instanceId: string): string | undefined;

  // Spawn points
  registerSpawnPoint(roomId: string, mobSlug: string, config?: Partial<SpawnPoint>): SpawnPoint;
  removeSpawnPoint(spawnPointId: string): void;
}

export class MobSystem implements MobAPI {
  private context: ModuleContext;
  private dataModule: DataModule;
  private gameId: string;
  private config: MobSystemConfig;

  // Caches
  private templates: Map<string, MobTemplate> = new Map();
  private instances: Map<string, MobInstance> = new Map();
  private roomMobs: Map<string, Set<string>> = new Map();  // roomId -> instanceIds

  // Spawning
  private spawnPoints: Map<string, SpawnPoint> = new Map();
  private respawnQueue: RespawnEntry[] = [];
  private respawnInterval: ReturnType<typeof setInterval> | null = null;
  private instanceCounter: number = 0;

  constructor(context: ModuleContext, dataModule: DataModule, gameId: string, config: MobSystemConfig = {}) {
    this.context = context;
    this.dataModule = dataModule;
    this.gameId = gameId;
    this.config = {
      defaultRespawnTime: config.defaultRespawnTime ?? 30000,
      maxMobsPerRoom: config.maxMobsPerRoom ?? 10,
      respawnCheckInterval: config.respawnCheckInterval ?? 5000,
    };
  }

  private get db() {
    return this.dataModule.getDatabase();
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Initialize the mob system - loads templates and starts respawn timer.
   */
  async initialize(): Promise<void> {
    await this.loadTemplates();
    this.startRespawnTimer();
    console.log(`[MobSystem] Initialized for game ${this.gameId}`);
  }

  /**
   * Shutdown the mob system.
   */
  shutdown(): void {
    if (this.respawnInterval) {
      clearInterval(this.respawnInterval);
      this.respawnInterval = null;
    }
    this.instances.clear();
    this.roomMobs.clear();
    this.respawnQueue = [];
    console.log(`[MobSystem] Shutdown for game ${this.gameId}`);
  }

  // ===========================================================================
  // Templates
  // ===========================================================================

  /**
   * Load all mob templates from database.
   */
  async loadTemplates(): Promise<void> {
    try {
      const entities = await this.db.entity.findMany({
        where: {
          gameId: this.gameId,
          type: { in: ['mob', 'boss', 'miniboss'] },
        },
      });

      this.templates.clear();
      for (const entity of entities) {
        const template = this.entityToTemplate(entity);
        this.templates.set(template.slug, template);
      }

      console.log(`[MobSystem] Loaded ${this.templates.size} mob templates`);
    } catch (error) {
      this.context.logger.error(`[MobSystem] Error loading templates: ${error}`);
    }
  }

  /**
   * Convert database entity to mob template.
   */
  private entityToTemplate(entity: any): MobTemplate {
    const stats = (entity.stats as Record<string, number>) || {};
    return {
      id: entity.id,
      slug: entity.slug,
      name: entity.name,
      description: entity.description,
      type: entity.type,
      subtype: entity.subtype,
      level: entity.level,
      stats: {
        hp: stats.hp ?? stats.maxHp ?? 100,
        maxHp: stats.maxHp ?? stats.hp ?? 100,
        attack: stats.attack ?? 10,
        defense: stats.defense ?? 5,
        magicAttack: stats.magicAttack,
        magicDefense: stats.magicDefense,
        speed: stats.speed,
        ...stats,
      },
      abilities: (entity.abilities as string[]) || [],
      lootTable: entity.lootTable,
      lootInline: (entity.lootInline as any[]) || [],
      expReward: entity.expReward || entity.level * 10,
      goldReward: entity.goldReward || 0,
      spawnConfig: (entity.spawnConfig as any) || {},
      behavior: (entity.behavior as any) || {},
      element: entity.element,
      sprite: entity.sprite,
      properties: (entity.properties as Record<string, any>) || {},
    };
  }

  /**
   * Get a mob template by slug.
   */
  async getTemplate(mobSlug: string): Promise<MobTemplate | undefined> {
    // Check cache first
    if (this.templates.has(mobSlug)) {
      return this.templates.get(mobSlug);
    }

    // Try to load from database
    try {
      const entity = await this.db.entity.findFirst({
        where: {
          gameId: this.gameId,
          slug: mobSlug,
          type: { in: ['mob', 'boss', 'miniboss'] },
        },
      });

      if (entity) {
        const template = this.entityToTemplate(entity);
        this.templates.set(mobSlug, template);
        return template;
      }
    } catch (error) {
      this.context.logger.error(`[MobSystem] Error loading template ${mobSlug}: ${error}`);
    }

    return undefined;
  }

  // ===========================================================================
  // Instances
  // ===========================================================================

  /**
   * Spawn a new mob instance in a room.
   */
  spawnMob(mobSlug: string, roomId: string): MobInstance | undefined {
    const template = this.templates.get(mobSlug);
    if (!template) {
      this.context.logger.warn(`[MobSystem] Unknown mob template: ${mobSlug}`);
      return undefined;
    }

    // Check room mob limit
    const roomMobIds = this.roomMobs.get(roomId);
    if (roomMobIds && roomMobIds.size >= this.config.maxMobsPerRoom!) {
      return undefined;
    }

    const instanceId = `mob_${this.gameId}_${++this.instanceCounter}`;
    const instance: MobInstance = {
      instanceId,
      templateId: template.id,
      templateSlug: template.slug,
      name: template.name,
      roomId,
      currentHp: template.stats.hp,
      maxHp: template.stats.maxHp || template.stats.hp,
      level: template.level,
      stats: { ...template.stats },
      spawnedAt: Date.now(),
      inCombat: false,
      threatTable: new Map(),
    };

    this.instances.set(instanceId, instance);

    if (!this.roomMobs.has(roomId)) {
      this.roomMobs.set(roomId, new Set());
    }
    this.roomMobs.get(roomId)!.add(instanceId);

    this.context.events.emit('mob:spawned', {
      instanceId,
      mobSlug,
      roomId,
      name: template.name,
      level: template.level,
    });

    return instance;
  }

  /**
   * Remove a mob instance.
   */
  despawnMob(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    // Remove from room
    const roomMobIds = this.roomMobs.get(instance.roomId);
    if (roomMobIds) {
      roomMobIds.delete(instanceId);
    }

    this.instances.delete(instanceId);

    this.context.events.emit('mob:despawned', {
      instanceId,
      mobSlug: instance.templateSlug,
      roomId: instance.roomId,
    });
  }

  /**
   * Get a mob instance by ID.
   */
  getMob(instanceId: string): MobInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Get all mobs in a room.
   */
  getMobsInRoom(roomId: string): MobInstance[] {
    const roomMobIds = this.roomMobs.get(roomId);
    if (!roomMobIds) return [];

    const mobs: MobInstance[] = [];
    for (const id of roomMobIds) {
      const mob = this.instances.get(id);
      if (mob) {
        mobs.push(mob);
      }
    }
    return mobs;
  }

  /**
   * Find a mob by name in a room.
   */
  findMobInRoom(roomId: string, search: string): MobInstance | undefined {
    const mobs = this.getMobsInRoom(roomId);
    const searchLower = search.toLowerCase();

    // Exact match first
    const exact = mobs.find(m => m.name.toLowerCase() === searchLower);
    if (exact) return exact;

    // Partial match
    return mobs.find(m => m.name.toLowerCase().includes(searchLower));
  }

  // ===========================================================================
  // Combat Integration
  // ===========================================================================

  /**
   * Apply damage to a mob.
   */
  damageMob(instanceId: string, amount: number, attackerId?: string): { killed: boolean; remainingHp: number } {
    const mob = this.instances.get(instanceId);
    if (!mob) {
      return { killed: false, remainingHp: 0 };
    }

    mob.currentHp = Math.max(0, mob.currentHp - amount);
    mob.inCombat = true;

    if (attackerId) {
      this.addThreat(instanceId, attackerId, amount);
    }

    if (mob.currentHp <= 0) {
      this.handleMobDeath(mob, attackerId);
      return { killed: true, remainingHp: 0 };
    }

    return { killed: false, remainingHp: mob.currentHp };
  }

  /**
   * Heal a mob.
   */
  healMob(instanceId: string, amount: number): number {
    const mob = this.instances.get(instanceId);
    if (!mob) return 0;

    const healed = Math.min(amount, mob.maxHp - mob.currentHp);
    mob.currentHp += healed;
    return healed;
  }

  /**
   * Add threat to a mob's threat table.
   */
  addThreat(instanceId: string, characterId: string, amount: number): void {
    const mob = this.instances.get(instanceId);
    if (!mob) return;

    const current = mob.threatTable.get(characterId) || 0;
    mob.threatTable.set(characterId, current + amount);
  }

  /**
   * Get the character with highest threat.
   */
  getHighestThreat(instanceId: string): string | undefined {
    const mob = this.instances.get(instanceId);
    if (!mob || mob.threatTable.size === 0) return undefined;

    let highestId: string | undefined;
    let highestThreat = -1;

    for (const [charId, threat] of mob.threatTable) {
      if (threat > highestThreat) {
        highestThreat = threat;
        highestId = charId;
      }
    }

    return highestId;
  }

  /**
   * Handle mob death - emit event and queue respawn.
   */
  private handleMobDeath(mob: MobInstance, killerId?: string): void {
    const template = this.templates.get(mob.templateSlug);

    // Get killers from threat table
    const killers = Array.from(mob.threatTable.keys());

    this.context.events.emit('mob:killed', {
      instanceId: mob.instanceId,
      mobSlug: mob.templateSlug,
      name: mob.name,
      level: mob.level,
      roomId: mob.roomId,
      killerId,
      killers,
      expReward: template?.expReward || 0,
      goldReward: template?.goldReward || 0,
      lootTable: template?.lootTable,
      lootInline: template?.lootInline,
    });

    // Find spawn point and queue respawn
    for (const [spId, sp] of this.spawnPoints) {
      if (sp.roomId === mob.roomId && sp.mobSlug === mob.templateSlug) {
        sp.currentCount--;
        this.respawnQueue.push({
          spawnPointId: spId,
          respawnAt: Date.now() + sp.respawnTime,
        });
        break;
      }
    }

    this.despawnMob(mob.instanceId);
  }

  // ===========================================================================
  // Spawn Points
  // ===========================================================================

  /**
   * Register a spawn point for a room.
   */
  registerSpawnPoint(roomId: string, mobSlug: string, config?: Partial<SpawnPoint>): SpawnPoint {
    const template = this.templates.get(mobSlug);
    const spId = `sp_${roomId}_${mobSlug}_${this.spawnPoints.size}`;

    const spawnPoint: SpawnPoint = {
      id: spId,
      roomId,
      mobSlug,
      respawnTime: config?.respawnTime ?? template?.spawnConfig.respawnTime ?? this.config.defaultRespawnTime!,
      maxCount: config?.maxCount ?? template?.spawnConfig.maxCount ?? 1,
      lastSpawned: 0,
      currentCount: 0,
    };

    this.spawnPoints.set(spId, spawnPoint);
    return spawnPoint;
  }

  /**
   * Remove a spawn point.
   */
  removeSpawnPoint(spawnPointId: string): void {
    this.spawnPoints.delete(spawnPointId);
  }

  /**
   * Spawn initial mobs for all spawn points.
   */
  spawnAllInitial(): void {
    let totalSpawned = 0;
    for (const sp of this.spawnPoints.values()) {
      while (sp.currentCount < sp.maxCount) {
        const instance = this.spawnMob(sp.mobSlug, sp.roomId);
        if (instance) {
          sp.currentCount++;
          sp.lastSpawned = Date.now();
          totalSpawned++;
        } else {
          break;
        }
      }
    }
    console.log(`[MobSystem] Initial spawn complete: ${totalSpawned} mobs`);
  }

  // ===========================================================================
  // Respawn Timer
  // ===========================================================================

  private startRespawnTimer(): void {
    this.respawnInterval = setInterval(() => this.processRespawns(), this.config.respawnCheckInterval!);
  }

  private processRespawns(): void {
    const now = Date.now();
    const toRespawn = this.respawnQueue.filter(r => r.respawnAt <= now);
    this.respawnQueue = this.respawnQueue.filter(r => r.respawnAt > now);

    for (const entry of toRespawn) {
      const sp = this.spawnPoints.get(entry.spawnPointId);
      if (!sp || sp.currentCount >= sp.maxCount) continue;

      const instance = this.spawnMob(sp.mobSlug, sp.roomId);
      if (instance) {
        sp.currentCount++;
        sp.lastSpawned = now;
        console.log(`[MobSystem] Respawned ${instance.name} in ${sp.roomId}`);
      }
    }
  }

  // ===========================================================================
  // API
  // ===========================================================================

  getAPI(): MobAPI {
    return {
      getTemplate: this.getTemplate.bind(this),
      loadTemplates: this.loadTemplates.bind(this),
      spawnMob: this.spawnMob.bind(this),
      despawnMob: this.despawnMob.bind(this),
      getMob: this.getMob.bind(this),
      getMobsInRoom: this.getMobsInRoom.bind(this),
      findMobInRoom: this.findMobInRoom.bind(this),
      damageMob: this.damageMob.bind(this),
      healMob: this.healMob.bind(this),
      addThreat: this.addThreat.bind(this),
      getHighestThreat: this.getHighestThreat.bind(this),
      registerSpawnPoint: this.registerSpawnPoint.bind(this),
      removeSpawnPoint: this.removeSpawnPoint.bind(this),
    };
  }
}
