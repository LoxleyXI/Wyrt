export interface Position2D {
    x: number;
    y: number;
}

export interface Position3D extends Position2D {
    z: number;
}

export type PositionType = "none" | "2d" | "3d";

export interface Room {
    id: string;
    name: string;
    description: string;
    region?: string;
    positionType: PositionType;
    dimensions?: {
        width: number;
        height: number;
        depth?: number;
    };
    exits?: Record<string, string>; // direction -> roomId
    tiles?: TileData[][]; // For 2D/3D rooms
    npcs: Entity[];
    mobs: Entity[];
    players: Player[];
    items: Item[];
    respawnPoints?: RespawnPoint[];
}

export interface TileData {
    type: string; // floor, wall, water, etc.
    walkable: boolean;
    layer?: number;
    properties?: Record<string, any>;
}

export interface RespawnPoint {
    id: string;
    position?: Position2D | Position3D;
    mobTypes?: string[];
    maxCount: number;
    respawnTime: number;
    lastSpawn?: number;
}

export interface Entity {
    id: string;
    name: string;
    type: EntityType;
    level: number;
    position?: Position2D | Position3D;
    room: string;
    hp: [number, number]; // [current, max]
    mp?: [number, number];
    stats: EntityStats;
    behavior?: AIBehavior;
    dialogue?: DialogueTree;
    loot?: LootTable;
    respawnTime?: number;
    nextRespawn?: number;
    target?: string;
    effects: Record<string, Effect>;
    skills?: string[];
}

export enum EntityType {
    NPC = "npc",
    MOB = "mob",
    BOSS = "boss",
    VENDOR = "vendor",
    QUEST_GIVER = "quest_giver"
}

export interface EntityStats {
    strength: number;
    dexterity: number;
    intelligence: number;
    defense: number;
    agility: number;
    [key: string]: number;
}

export interface AIBehavior {
    type: AIType;
    aggroRange?: number;
    wanderRadius?: number;
    patrolPath?: Position2D[];
    attackPattern?: string[];
    fleeHealthPercent?: number;
    allyTypes?: string[];
}

export enum AIType {
    PASSIVE = "passive",
    AGGRESSIVE = "aggressive",
    DEFENSIVE = "defensive",
    PATROL = "patrol",
    WANDER = "wander",
    STATIONARY = "stationary"
}

export interface DialogueTree {
    greeting: string;
    options?: DialogueOption[];
    quests?: string[];
    shop?: ShopInventory;
}

export interface DialogueOption {
    text: string;
    response: string;
    action?: string;
    requirements?: Record<string, any>;
    nextOptions?: DialogueOption[];
}

export interface ShopInventory {
    items: ShopItem[];
    buybackMultiplier: number;
    refreshTime?: number;
}

export interface ShopItem {
    itemId: string;
    price: number;
    stock?: number;
    requirements?: Record<string, any>;
}

export interface LootTable {
    items: LootItem[];
    gold?: [number, number]; // [min, max]
    experience: number;
}

export interface LootItem {
    itemId: string;
    chance: number; // 0-100
    quantity: [number, number]; // [min, max]
}

export interface Player {
    id: string;
    accountId: string;
    name: string;
    position?: Position2D | Position3D;
    room: string;
    level: number;
    experience: number;
    class: string;
    hp: [number, number];
    mp: [number, number];
    stats: EntityStats;
    inventory: Item[];
    equipment: Record<string, Item>;
    skills: Record<string, number>;
    quests: Quest[];
    party?: string[];
    target?: string;
    effects: Record<string, Effect>;
}

export interface Item {
    id: string;
    name: string;
    type: ItemType;
    description: string;
    stackable: boolean;
    quantity: number;
    position?: Position2D | Position3D;
    stats?: Record<string, number>;
    requirements?: Record<string, any>;
    value: number;
}

export enum ItemType {
    WEAPON = "weapon",
    ARMOR = "armor",
    CONSUMABLE = "consumable",
    MATERIAL = "material",
    QUEST = "quest",
    MISC = "misc"
}

export interface Effect {
    id: string;
    name: string;
    description: string;
    duration: number;
    startTime: number;
    stats?: Record<string, number>;
    dot?: number; // damage over time
    hot?: number; // heal over time
}

export interface Quest {
    id: string;
    name: string;
    description: string;
    objectives: QuestObjective[];
    rewards: QuestReward;
    status: QuestStatus;
    startNPC?: string;
    endNPC?: string;
}

export interface QuestObjective {
    id: string;
    description: string;
    type: ObjectiveType;
    target: string;
    requiredCount: number;
    currentCount: number;
    completed: boolean;
}

export enum ObjectiveType {
    KILL = "kill",
    COLLECT = "collect",
    DELIVER = "deliver",
    TALK = "talk",
    REACH = "reach"
}

export interface QuestReward {
    experience: number;
    gold: number;
    items?: Item[];
    reputation?: Record<string, number>;
}

export enum QuestStatus {
    AVAILABLE = "available",
    ACTIVE = "active",
    COMPLETED = "completed",
    TURNED_IN = "turned_in"
}

export interface Skill {
    id: string;
    name: string;
    description: string;
    type: SkillType;
    targetType: TargetType;
    range?: number;
    area?: number;
    cooldown: number;
    manaCost?: number;
    damage?: number;
    heal?: number;
    effects?: Effect[];
    requirements?: Record<string, any>;
}

export enum SkillType {
    ATTACK = "attack",
    HEAL = "heal",
    BUFF = "buff",
    DEBUFF = "debuff",
    SUMMON = "summon",
    TELEPORT = "teleport"
}

export enum TargetType {
    SELF = "self",
    SINGLE = "single",
    AOE = "aoe",
    CONE = "cone",
    LINE = "line"
}

export interface CraftingRecipe {
    id: string;
    name: string;
    skill: string;
    level: number;
    materials: Array<{
        itemId: string;
        quantity: number;
    }>;
    result: {
        itemId: string;
        quantity: number;
    };
    experience: number;
}