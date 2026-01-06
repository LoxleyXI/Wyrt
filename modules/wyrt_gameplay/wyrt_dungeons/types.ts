/**
 * wyrt_dungeons - Type Definitions
 *
 * Generic room-graph dungeon system types.
 * Games provide their own room content and encounter logic via IDungeonConfig.
 */

// ============================================================================
// Configuration Interface (Games implement this)
// ============================================================================

/**
 * Configuration interface that games must provide to customize dungeons.
 * This is the primary extension point for game-specific dungeon mechanics.
 */
export interface IDungeonConfig {
  /** Unique game identifier */
  gameId: string;

  /**
   * Generate encounter for a combat room.
   * Games provide their own mob spawning logic here.
   */
  generateEncounter(params: EncounterGenerationParams): Encounter;

  /**
   * Generate loot for a room (treasure, post-combat, etc.).
   * Games provide their own loot tables here.
   */
  generateLoot(params: LootGenerationParams): DungeonLoot;

  /**
   * Handle room completion (after combat won, puzzle solved, etc.).
   * Games can add rewards, unlock paths, etc.
   */
  onRoomComplete?(run: DungeonRun, room: DungeonRoom): void;

  /**
   * Handle party death in a room.
   */
  onPartyWipe?(run: DungeonRun, room: DungeonRoom): WipeResult;

  /**
   * Generate an event for event rooms.
   * Games provide their own random events here.
   */
  generateEvent?(params: EventGenerationParams): DungeonEvent;

  /**
   * Handle event choice selection.
   */
  resolveEventChoice?(run: DungeonRun, event: DungeonEvent, choiceIndex: number): EventOutcome;

  /**
   * Calculate rest room healing amount.
   */
  calculateRestHealing?(run: DungeonRun): number;

  /**
   * Get available dungeon types for a player/party.
   */
  getAvailableDungeons?(params: AvailabilityParams): DungeonType[];

  /**
   * Validate if a party can enter a dungeon.
   */
  validateParty?(party: DungeonParty, dungeonType: DungeonType): string | undefined;

  /**
   * Called when a dungeon run starts.
   */
  onDungeonStart?(run: DungeonRun): void;

  /**
   * Called when a dungeon run ends (any outcome).
   */
  onDungeonEnd?(run: DungeonRun, result: DungeonResult): void;
}

// ============================================================================
// Dungeon Types
// ============================================================================

/**
 * Definition of a dungeon type that players can enter.
 */
export interface DungeonType {
  /** Unique dungeon type ID */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Region/zone this dungeon is in */
  region?: string;

  /** Minimum level requirement */
  minLevel: number;

  /** Recommended level */
  recommendedLevel: number;

  /** Maximum level (for scaling) */
  maxLevel?: number;

  /** Minimum party size */
  minPartySize: number;

  /** Maximum party size */
  maxPartySize: number;

  /** Difficulty tier */
  difficulty: string;

  /** Number of floors */
  floorCount: number;

  /** Room layout definition */
  layout: DungeonLayout;

  /** Par time in milliseconds (for speed runs) */
  parTime?: number;

  /** Tags for filtering */
  tags?: string[];

  /** Game-specific data */
  gameData?: Record<string, any>;
}

/**
 * Defines the room layout/graph for a dungeon.
 */
export interface DungeonLayout {
  /** Room definitions */
  rooms: RoomDefinition[];

  /** Starting room ID */
  entryRoomId: string;

  /** Boss room ID (final room) */
  bossRoomId: string;

  /** Is this a linear dungeon or branching? */
  isLinear: boolean;
}

/**
 * Definition of a room in the dungeon layout.
 */
export interface RoomDefinition {
  /** Unique room ID within dungeon */
  id: string;

  /** Room type */
  type: RoomType;

  /** Floor number (0-indexed) */
  floor: number;

  /** Position on floor (for visual layout) */
  position: { x: number; y: number };

  /** IDs of rooms this connects to */
  connections: string[];

  /** Is this room optional/side path? */
  isOptional?: boolean;

  /** Is this a checkpoint room? */
  isCheckpoint?: boolean;

  /** Room-specific data */
  data?: Record<string, any>;
}

export type RoomType =
  | 'entry'
  | 'combat'
  | 'elite'
  | 'treasure'
  | 'rest'
  | 'event'
  | 'shop'
  | 'miniboss'
  | 'boss';

// ============================================================================
// Dungeon Run State
// ============================================================================

/**
 * An active dungeon run in progress.
 */
export interface DungeonRun {
  /** Unique run ID */
  id: string;

  /** Game this run belongs to */
  gameId: string;

  /** Dungeon type ID */
  dungeonId: string;

  /** Difficulty modifier applied */
  difficulty: string;

  /** Party in the dungeon */
  party: DungeonParty;

  /** Current room ID */
  currentRoomId: string;

  /** Room states (keyed by room ID) */
  rooms: Map<string, RoomState>;

  /** Current floor (0-indexed) */
  currentFloor: number;

  /** Run status */
  status: DungeonStatus;

  /** When the run started */
  startedAt: Date;

  /** Last checkpoint room ID */
  lastCheckpointId?: string;

  /** Number of revives used */
  revivesUsed: number;

  /** Loot collected during run */
  collectedLoot: DungeonLoot;

  /** Run statistics */
  stats: RunStats;

  /** Game-specific data */
  gameData: Record<string, any>;
}

export type DungeonStatus =
  | 'active'
  | 'in_combat'
  | 'in_event'
  | 'victory'
  | 'defeat'
  | 'fled'
  | 'timeout';

export interface DungeonParty {
  /** Party/character IDs */
  memberIds: string[];

  /** Member states (HP, resources, etc.) */
  memberStates: Map<string, PartyMemberState>;

  /** Average level */
  averageLevel: number;

  /** Party bonuses active */
  bonuses: string[];
}

export interface PartyMemberState {
  memberId: string;
  currentHp: number;
  maxHp: number;
  currentResource: number;
  maxResource: number;
  isAlive: boolean;
  buffs: string[];
  debuffs: string[];
}

export interface RoomState {
  roomId: string;
  status: 'locked' | 'available' | 'entered' | 'completed' | 'failed';
  encounter?: Encounter;
  event?: DungeonEvent;
  loot?: DungeonLoot;
  enteredAt?: Date;
  completedAt?: Date;
  attempts: number;
}

export interface RunStats {
  roomsCleared: number;
  enemiesDefeated: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalHealing: number;
  deathCount: number;
  secretsFound: number;
  elapsedTime: number;
}

// ============================================================================
// Encounters
// ============================================================================

export interface EncounterGenerationParams {
  dungeonType: DungeonType;
  room: RoomDefinition;
  floor: number;
  difficulty: string;
  partyLevel: number;
  partySize: number;
}

export interface Encounter {
  /** Encounter type */
  type: 'normal' | 'elite' | 'miniboss' | 'boss';

  /** Enemies to spawn */
  enemies: EncounterEnemy[];

  /** Bonus modifiers */
  modifiers?: string[];
}

export interface EncounterEnemy {
  /** Enemy type ID */
  enemyId: string;

  /** Level override */
  level?: number;

  /** Is this an elite variant? */
  isElite?: boolean;

  /** Spawn position hint */
  position?: number;
}

// ============================================================================
// Events
// ============================================================================

export interface EventGenerationParams {
  dungeonType: DungeonType;
  room: RoomDefinition;
  floor: number;
  run: DungeonRun;
}

export interface DungeonEvent {
  /** Event type ID */
  id: string;

  /** Display title */
  title: string;

  /** Event description/story */
  description: string;

  /** Available choices */
  choices: EventChoice[];

  /** Event icon/image */
  icon?: string;
}

export interface EventChoice {
  /** Choice text */
  text: string;

  /** Hint about outcome */
  hint?: string;

  /** Requirements to select this choice */
  requirements?: EventRequirement[];
}

export interface EventRequirement {
  type: 'item' | 'stat' | 'class' | 'skill';
  id: string;
  amount?: number;
}

export interface EventOutcome {
  /** Outcome description */
  description: string;

  /** Was this a success? */
  isSuccess: boolean;

  /** Rewards granted */
  rewards?: DungeonLoot;

  /** Penalties applied */
  penalties?: EventPenalty[];

  /** Buff/debuff applied */
  effects?: string[];
}

export interface EventPenalty {
  type: 'damage' | 'resource' | 'debuff';
  target: 'party' | 'random';
  value: number;
}

// ============================================================================
// Loot
// ============================================================================

export interface LootGenerationParams {
  dungeonType: DungeonType;
  room: RoomDefinition;
  encounter?: Encounter;
  difficulty: string;
  bonusMultiplier: number;
}

export interface DungeonLoot {
  /** Gold/currency */
  currency: number;

  /** Experience */
  experience: number;

  /** Items */
  items: LootItem[];

  /** Special rewards */
  special?: SpecialLoot[];
}

export interface LootItem {
  itemId: string;
  quantity: number;
  quality?: string;
}

export interface SpecialLoot {
  type: 'recipe' | 'unlock' | 'key' | 'fragment';
  id: string;
  data?: Record<string, any>;
}

// ============================================================================
// Wipe/Death Handling
// ============================================================================

export interface WipeResult {
  /** Can continue from checkpoint? */
  canContinue: boolean;

  /** Cost to revive */
  reviveCost?: { type: string; amount: number };

  /** What happens to loot */
  lootAction: 'keep' | 'lose' | 'partial';

  /** Where to respawn */
  respawnRoomId?: string;
}

// ============================================================================
// Results
// ============================================================================

export interface AvailabilityParams {
  playerId: string;
  partyId?: string;
  level: number;
  unlockedDungeons?: string[];
}

export interface DungeonResult {
  /** Run ID */
  runId: string;

  /** Final status */
  status: DungeonStatus;

  /** Time to complete */
  completionTime: number;

  /** Speed run medal (if applicable) */
  medal?: 'gold' | 'silver' | 'bronze' | 'none';

  /** Total loot collected */
  loot: DungeonLoot;

  /** Final stats */
  stats: RunStats;

  /** Floors cleared */
  floorsCleared: number;

  /** Was boss defeated? */
  bossDefeated: boolean;
}

// ============================================================================
// Logging
// ============================================================================

export interface DungeonLogEntry {
  timestamp: Date;
  runId: string;
  type: DungeonLogType;
  message: string;
  data?: Record<string, any>;
}

export type DungeonLogType =
  | 'dungeon_start'
  | 'room_enter'
  | 'room_complete'
  | 'encounter_start'
  | 'encounter_win'
  | 'encounter_lose'
  | 'event_start'
  | 'event_choice'
  | 'loot_found'
  | 'party_wipe'
  | 'revive'
  | 'dungeon_complete'
  | 'dungeon_abandon';
