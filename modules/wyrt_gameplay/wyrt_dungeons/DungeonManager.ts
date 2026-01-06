/**
 * wyrt_dungeons - Dungeon Manager
 *
 * Per-game dungeon manager that handles room-graph dungeon progression.
 * Games provide configuration; this module provides the state machine.
 */

import { ModuleContext } from '../../../src/module/ModuleContext.js';
import {
  IDungeonConfig,
  DungeonType,
  DungeonRun,
  DungeonParty,
  DungeonResult,
  DungeonStatus,
  RoomState,
  RoomDefinition,
  Encounter,
  DungeonEvent,
  DungeonLoot,
  EventOutcome,
  RunStats,
} from './types.js';

export class DungeonManager {
  private context: ModuleContext;
  private config: IDungeonConfig;

  // Registered dungeon types
  private dungeonTypes: Map<string, DungeonType> = new Map();

  // Active runs by ID
  private activeRuns: Map<string, DungeonRun> = new Map();

  // Active runs by party member ID
  private runsByMember: Map<string, string> = new Map();

  constructor(context: ModuleContext, config: IDungeonConfig) {
    this.context = context;
    this.config = config;
  }

  // ==========================================================================
  // Dungeon Type Registration
  // ==========================================================================

  /**
   * Register a dungeon type.
   */
  registerDungeonType(type: DungeonType): void {
    if (this.dungeonTypes.has(type.id)) {
      this.context.logger.warn(
        `[wyrt_dungeons:${this.config.gameId}] Overwriting dungeon type '${type.id}'`
      );
    }
    this.dungeonTypes.set(type.id, type);
    this.context.logger.debug(
      `[wyrt_dungeons:${this.config.gameId}] Registered dungeon type '${type.id}'`
    );
  }

  /**
   * Register multiple dungeon types.
   */
  registerDungeonTypes(types: DungeonType[]): void {
    for (const type of types) {
      this.registerDungeonType(type);
    }
  }

  /**
   * Get a dungeon type by ID.
   */
  getDungeonType(dungeonId: string): DungeonType | undefined {
    return this.dungeonTypes.get(dungeonId);
  }

  /**
   * Get all registered dungeon types.
   */
  getAllDungeonTypes(): DungeonType[] {
    return Array.from(this.dungeonTypes.values());
  }

  // ==========================================================================
  // Dungeon Run Lifecycle
  // ==========================================================================

  /**
   * Start a new dungeon run.
   */
  startRun(dungeonId: string, party: DungeonParty, difficulty: string = 'normal'): DungeonRun {
    const dungeonType = this.dungeonTypes.get(dungeonId);
    if (!dungeonType) {
      throw new Error(`Unknown dungeon type: ${dungeonId}`);
    }

    // Validate party size
    if (party.memberIds.length < dungeonType.minPartySize) {
      throw new Error(
        `Party too small. Minimum: ${dungeonType.minPartySize}, provided: ${party.memberIds.length}`
      );
    }
    if (party.memberIds.length > dungeonType.maxPartySize) {
      throw new Error(
        `Party too large. Maximum: ${dungeonType.maxPartySize}, provided: ${party.memberIds.length}`
      );
    }

    // Check if any member is already in a dungeon
    for (const memberId of party.memberIds) {
      if (this.runsByMember.has(memberId)) {
        throw new Error(`Member ${memberId} is already in a dungeon`);
      }
    }

    // Game-specific validation
    if (this.config.validateParty) {
      const error = this.config.validateParty(party, dungeonType);
      if (error) {
        throw new Error(error);
      }
    }

    // Initialize room states
    const rooms = new Map<string, RoomState>();
    for (const roomDef of dungeonType.layout.rooms) {
      rooms.set(roomDef.id, {
        roomId: roomDef.id,
        status: roomDef.id === dungeonType.layout.entryRoomId ? 'available' : 'locked',
        attempts: 0,
      });
    }

    const run: DungeonRun = {
      id: this.generateId(),
      gameId: this.config.gameId,
      dungeonId,
      difficulty,
      party,
      currentRoomId: dungeonType.layout.entryRoomId,
      rooms,
      currentFloor: 0,
      status: 'active',
      startedAt: new Date(),
      revivesUsed: 0,
      collectedLoot: { currency: 0, experience: 0, items: [] },
      stats: this.createEmptyStats(),
      gameData: {},
    };

    // Store run
    this.activeRuns.set(run.id, run);
    for (const memberId of party.memberIds) {
      this.runsByMember.set(memberId, run.id);
    }

    // Emit event
    this.context.events.emit(`${this.config.gameId}:dungeon_start`, {
      run,
      dungeonType,
    });

    // Game callback
    if (this.config.onDungeonStart) {
      this.config.onDungeonStart(run);
    }

    this.context.logger.info(
      `[wyrt_dungeons:${this.config.gameId}] Started dungeon run ${run.id} ` +
        `(${dungeonType.name}) with ${party.memberIds.length} members`
    );

    return run;
  }

  /**
   * Enter a room in the dungeon.
   */
  enterRoom(runId: string, roomId: string): RoomState {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    if (run.status !== 'active') {
      throw new Error(`Run ${runId} is not active`);
    }

    const dungeonType = this.dungeonTypes.get(run.dungeonId)!;
    const roomDef = dungeonType.layout.rooms.find(r => r.id === roomId);
    if (!roomDef) {
      throw new Error(`Room not found: ${roomId}`);
    }

    const roomState = run.rooms.get(roomId)!;
    if (roomState.status === 'locked') {
      throw new Error(`Room ${roomId} is locked`);
    }
    if (roomState.status === 'completed') {
      // Allow re-entry to completed rooms (backtracking)
    }

    // Update state
    run.currentRoomId = roomId;
    run.currentFloor = roomDef.floor;
    roomState.status = 'entered';
    roomState.enteredAt = new Date();
    roomState.attempts++;

    // Generate content based on room type
    if (roomDef.type === 'combat' || roomDef.type === 'elite' || roomDef.type === 'miniboss' || roomDef.type === 'boss') {
      // Generate encounter if not already generated
      if (!roomState.encounter) {
        roomState.encounter = this.config.generateEncounter({
          dungeonType,
          room: roomDef,
          floor: roomDef.floor,
          difficulty: run.difficulty,
          partyLevel: run.party.averageLevel,
          partySize: run.party.memberIds.length,
        });
      }
      run.status = 'in_combat';
    } else if (roomDef.type === 'event') {
      // Generate event if not already generated
      if (!roomState.event && this.config.generateEvent) {
        roomState.event = this.config.generateEvent({
          dungeonType,
          room: roomDef,
          floor: roomDef.floor,
          run,
        });
      }
      run.status = 'in_event';
    } else if (roomDef.type === 'rest') {
      // Handle rest room
      const healAmount = this.config.calculateRestHealing
        ? this.config.calculateRestHealing(run)
        : this.defaultRestHealing(run);
      this.healParty(run, healAmount);
      this.completeRoom(runId, roomId);
    } else if (roomDef.type === 'treasure') {
      // Generate loot
      if (!roomState.loot) {
        roomState.loot = this.config.generateLoot({
          dungeonType,
          room: roomDef,
          difficulty: run.difficulty,
          bonusMultiplier: 1.0,
        });
      }
      this.collectLoot(run, roomState.loot);
      this.completeRoom(runId, roomId);
    } else if (roomDef.type === 'entry') {
      this.completeRoom(runId, roomId);
    }

    // Update checkpoint if applicable
    if (roomDef.isCheckpoint) {
      run.lastCheckpointId = roomId;
    }

    // Emit event
    this.context.events.emit(`${this.config.gameId}:room_enter`, {
      run,
      room: roomDef,
      roomState,
    });

    return roomState;
  }

  /**
   * Complete a room (after combat won, event resolved, etc.).
   */
  completeRoom(runId: string, roomId: string, loot?: DungeonLoot): void {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const dungeonType = this.dungeonTypes.get(run.dungeonId)!;
    const roomDef = dungeonType.layout.rooms.find(r => r.id === roomId)!;
    const roomState = run.rooms.get(roomId)!;

    roomState.status = 'completed';
    roomState.completedAt = new Date();
    run.status = 'active';
    run.stats.roomsCleared++;

    // Collect loot if provided
    if (loot) {
      this.collectLoot(run, loot);
    }

    // Unlock connected rooms
    for (const connectedId of roomDef.connections) {
      const connectedState = run.rooms.get(connectedId);
      if (connectedState && connectedState.status === 'locked') {
        connectedState.status = 'available';
      }
    }

    // Game callback
    if (this.config.onRoomComplete) {
      this.config.onRoomComplete(run, roomDef);
    }

    // Check if boss defeated
    if (roomDef.id === dungeonType.layout.bossRoomId) {
      this.endRun(runId, 'victory');
    }

    // Emit event
    this.context.events.emit(`${this.config.gameId}:room_complete`, {
      run,
      room: roomDef,
    });
  }

  /**
   * Handle combat victory in current room.
   */
  combatVictory(runId: string, combatResult: { enemiesDefeated: number; damageDealt: number; damageTaken: number }): void {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const dungeonType = this.dungeonTypes.get(run.dungeonId)!;
    const roomDef = dungeonType.layout.rooms.find(r => r.id === run.currentRoomId)!;
    const roomState = run.rooms.get(run.currentRoomId)!;

    // Update stats
    run.stats.enemiesDefeated += combatResult.enemiesDefeated;
    run.stats.totalDamageDealt += combatResult.damageDealt;
    run.stats.totalDamageTaken += combatResult.damageTaken;

    // Generate loot
    const loot = this.config.generateLoot({
      dungeonType,
      room: roomDef,
      encounter: roomState.encounter,
      difficulty: run.difficulty,
      bonusMultiplier: 1.0,
    });

    this.completeRoom(runId, run.currentRoomId, loot);

    // Emit event
    this.context.events.emit(`${this.config.gameId}:encounter_win`, {
      run,
      room: roomDef,
      loot,
    });
  }

  /**
   * Handle combat defeat / party wipe.
   */
  combatDefeat(runId: string): void {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const roomDef = this.dungeonTypes.get(run.dungeonId)!.layout.rooms.find(
      r => r.id === run.currentRoomId
    )!;
    const roomState = run.rooms.get(run.currentRoomId)!;

    roomState.status = 'failed';
    run.stats.deathCount++;

    // Ask game how to handle wipe
    let wipeResult = this.config.onPartyWipe?.(run, roomDef);
    if (!wipeResult) {
      // Default wipe handling
      wipeResult = {
        canContinue: run.lastCheckpointId !== undefined,
        lootAction: 'lose',
        respawnRoomId: run.lastCheckpointId,
      };
    }

    // Emit event
    this.context.events.emit(`${this.config.gameId}:party_wipe`, {
      run,
      room: roomDef,
      wipeResult,
    });

    if (!wipeResult.canContinue) {
      this.endRun(runId, 'defeat');
    } else {
      run.status = 'active';
      if (wipeResult.respawnRoomId) {
        run.currentRoomId = wipeResult.respawnRoomId;
      }
      if (wipeResult.lootAction === 'lose') {
        run.collectedLoot = { currency: 0, experience: 0, items: [] };
      }
    }
  }

  /**
   * Handle event choice selection.
   */
  selectEventChoice(runId: string, choiceIndex: number): EventOutcome {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    if (run.status !== 'in_event') {
      throw new Error(`Run ${runId} is not in an event`);
    }

    const roomState = run.rooms.get(run.currentRoomId)!;
    if (!roomState.event) {
      throw new Error(`No event in current room`);
    }

    let outcome: EventOutcome;
    if (this.config.resolveEventChoice) {
      outcome = this.config.resolveEventChoice(run, roomState.event, choiceIndex);
    } else {
      // Default: just succeed
      outcome = {
        description: 'You made your choice.',
        isSuccess: true,
      };
    }

    if (outcome.rewards) {
      this.collectLoot(run, outcome.rewards);
    }

    if (outcome.penalties) {
      for (const penalty of outcome.penalties) {
        if (penalty.type === 'damage') {
          // Apply damage to party
          // Game should handle this in resolveEventChoice
        }
      }
    }

    this.completeRoom(runId, run.currentRoomId, outcome.rewards);

    // Emit event
    this.context.events.emit(`${this.config.gameId}:event_choice`, {
      run,
      event: roomState.event,
      choiceIndex,
      outcome,
    });

    return outcome;
  }

  /**
   * End a dungeon run.
   */
  endRun(runId: string, status: DungeonStatus): DungeonResult {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const dungeonType = this.dungeonTypes.get(run.dungeonId)!;

    run.status = status;
    run.stats.elapsedTime = Date.now() - run.startedAt.getTime();

    // Calculate medal if applicable
    let medal: 'gold' | 'silver' | 'bronze' | 'none' | undefined;
    if (status === 'victory' && dungeonType.parTime) {
      const ratio = run.stats.elapsedTime / dungeonType.parTime;
      if (ratio <= 0.75) medal = 'gold';
      else if (ratio <= 1.0) medal = 'silver';
      else if (ratio <= 1.5) medal = 'bronze';
      else medal = 'none';
    }

    const result: DungeonResult = {
      runId,
      status,
      completionTime: run.stats.elapsedTime,
      medal,
      loot: run.collectedLoot,
      stats: run.stats,
      floorsCleared: run.currentFloor + 1,
      bossDefeated: status === 'victory',
    };

    // Cleanup member tracking
    for (const memberId of run.party.memberIds) {
      this.runsByMember.delete(memberId);
    }

    // Game callback
    if (this.config.onDungeonEnd) {
      this.config.onDungeonEnd(run, result);
    }

    // Emit event
    this.context.events.emit(`${this.config.gameId}:dungeon_complete`, {
      run,
      result,
    });

    this.context.logger.info(
      `[wyrt_dungeons:${this.config.gameId}] Completed dungeon run ${runId} ` +
        `(${status}, ${run.stats.roomsCleared} rooms, ${run.stats.elapsedTime}ms)`
    );

    return result;
  }

  /**
   * Abandon a dungeon run.
   */
  abandonRun(runId: string): DungeonResult {
    return this.endRun(runId, 'fled');
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get an active run by ID.
   */
  getRun(runId: string): DungeonRun | undefined {
    return this.activeRuns.get(runId);
  }

  /**
   * Get the active run for a member.
   */
  getMemberRun(memberId: string): DungeonRun | undefined {
    const runId = this.runsByMember.get(memberId);
    if (!runId) return undefined;
    return this.activeRuns.get(runId);
  }

  /**
   * Check if a member is in a dungeon.
   */
  isInDungeon(memberId: string): boolean {
    return this.runsByMember.has(memberId);
  }

  /**
   * Get all active runs.
   */
  getAllActiveRuns(): DungeonRun[] {
    return Array.from(this.activeRuns.values()).filter(r => r.status === 'active');
  }

  /**
   * Get available rooms in a run (for movement).
   */
  getAvailableRooms(runId: string): RoomDefinition[] {
    const run = this.activeRuns.get(runId);
    if (!run) return [];

    const dungeonType = this.dungeonTypes.get(run.dungeonId)!;

    return dungeonType.layout.rooms.filter(room => {
      const state = run.rooms.get(room.id);
      return state && (state.status === 'available' || state.status === 'completed');
    });
  }

  /**
   * Get room definition.
   */
  getRoomDefinition(dungeonId: string, roomId: string): RoomDefinition | undefined {
    const dungeonType = this.dungeonTypes.get(dungeonId);
    if (!dungeonType) return undefined;
    return dungeonType.layout.rooms.find(r => r.id === roomId);
  }

  /**
   * Get available dungeons for a player (uses game config).
   */
  getAvailableDungeons(
    playerId: string,
    level: number,
    partyId?: string,
    unlockedDungeons?: string[]
  ): DungeonType[] {
    if (this.config.getAvailableDungeons) {
      return this.config.getAvailableDungeons({
        playerId,
        level,
        partyId,
        unlockedDungeons,
      });
    }

    // Default: filter by level
    return this.getAllDungeonTypes().filter(type => level >= type.minLevel);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private collectLoot(run: DungeonRun, loot: DungeonLoot): void {
    run.collectedLoot.currency += loot.currency;
    run.collectedLoot.experience += loot.experience;
    run.collectedLoot.items.push(...loot.items);
    if (loot.special) {
      run.collectedLoot.special = run.collectedLoot.special || [];
      run.collectedLoot.special.push(...loot.special);
    }
  }

  private healParty(run: DungeonRun, amount: number): void {
    for (const [memberId, state] of run.party.memberStates) {
      if (state.isAlive) {
        state.currentHp = Math.min(state.maxHp, state.currentHp + amount);
      }
    }
    run.stats.totalHealing += amount * run.party.memberIds.length;
  }

  private defaultRestHealing(run: DungeonRun): number {
    // Default: heal 50% of average max HP
    let totalMaxHp = 0;
    for (const state of run.party.memberStates.values()) {
      totalMaxHp += state.maxHp;
    }
    return Math.floor((totalMaxHp / run.party.memberIds.length) * 0.5);
  }

  private createEmptyStats(): RunStats {
    return {
      roomsCleared: 0,
      enemiesDefeated: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      totalHealing: 0,
      deathCount: 0,
      secretsFound: 0,
      elapsedTime: 0,
    };
  }

  private generateId(): string {
    return `dun_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clean up (call on shutdown).
   */
  cleanup(): void {
    // Runs should be persisted by the game before cleanup
    this.activeRuns.clear();
    this.runsByMember.clear();
  }
}
