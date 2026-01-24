/**
 * Companion Memory Manager
 * Handles loading, saving, and managing companion memories
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  CompanionMemory,
  CompanionProfile,
  CompanionStats,
  Message,
  GameEvent,
  DEFAULT_CONFIG,
  DEFAULT_COMPANION_PROFILE,
  DEFAULT_COMPANION_STATS,
  getXpForLevel,
  getXpToNextLevel
} from '../types';

export interface MemoryManagerConfig {
  dataDir: string;
  maxConversationWindow?: number;
  maxLongTermMemories?: number;
  defaultProfile?: CompanionProfile;
}

export class MemoryManager {
  private memories: Map<string, CompanionMemory> = new Map();
  private profiles: Map<string, CompanionProfile> = new Map();
  private dataDir: string;
  private maxConversationWindow: number;
  private maxLongTermMemories: number;
  private defaultProfile: CompanionProfile;

  constructor(config: MemoryManagerConfig) {
    this.dataDir = config.dataDir;
    this.maxConversationWindow = config.maxConversationWindow ?? DEFAULT_CONFIG.maxConversationWindow;
    this.maxLongTermMemories = config.maxLongTermMemories ?? DEFAULT_CONFIG.maxLongTermMemories;
    this.defaultProfile = config.defaultProfile ?? DEFAULT_COMPANION_PROFILE;
  }

  private async ensurePlayerDir(playerId: string): Promise<string> {
    const playerDir = join(this.dataDir, playerId);
    try {
      await mkdir(playerDir, { recursive: true });
    } catch {
      // Directory exists
    }
    return playerDir;
  }

  async loadMemory(playerId: string, playerName: string): Promise<CompanionMemory> {
    if (this.memories.has(playerId)) {
      return this.memories.get(playerId)!;
    }

    const playerDir = await this.ensurePlayerDir(playerId);

    let memory: CompanionMemory = {
      playerId,
      playerName,
      longTermMemory: [],
      recentSummary: '',
      conversationWindow: [],
      recentEvents: [],
      stats: { ...DEFAULT_COMPANION_STATS }
    };

    try {
      const longTermPath = join(playerDir, 'long_term.json');
      const longTermData = await readFile(longTermPath, 'utf-8');
      memory.longTermMemory = JSON.parse(longTermData);
    } catch {
      // No existing long-term memory
    }

    try {
      const recentPath = join(playerDir, 'recent.txt');
      memory.recentSummary = await readFile(recentPath, 'utf-8');
    } catch {
      // No recent summary
    }

    try {
      const conversationPath = join(playerDir, 'conversation.json');
      const conversationData = await readFile(conversationPath, 'utf-8');
      memory.conversationWindow = JSON.parse(conversationData);
    } catch {
      // No conversation history
    }

    try {
      const statsPath = join(playerDir, 'stats.json');
      const statsData = await readFile(statsPath, 'utf-8');
      memory.stats = JSON.parse(statsData);
    } catch {
      // No saved stats, use defaults
    }

    this.memories.set(playerId, memory);
    return memory;
  }

  async loadProfile(playerId: string): Promise<CompanionProfile> {
    if (this.profiles.has(playerId)) {
      return this.profiles.get(playerId)!;
    }

    const playerDir = await this.ensurePlayerDir(playerId);

    try {
      const profilePath = join(playerDir, 'profile.json');
      const profileData = await readFile(profilePath, 'utf-8');
      const profile = JSON.parse(profileData);
      this.profiles.set(playerId, profile);
      return profile;
    } catch {
      this.profiles.set(playerId, { ...this.defaultProfile });
      return this.defaultProfile;
    }
  }

  async saveMemory(playerId: string): Promise<void> {
    const memory = this.memories.get(playerId);
    if (!memory) return;

    const playerDir = await this.ensurePlayerDir(playerId);

    await writeFile(
      join(playerDir, 'long_term.json'),
      JSON.stringify(memory.longTermMemory, null, 2)
    );

    if (memory.recentSummary) {
      await writeFile(
        join(playerDir, 'recent.txt'),
        memory.recentSummary
      );
    }

    await writeFile(
      join(playerDir, 'conversation.json'),
      JSON.stringify(memory.conversationWindow, null, 2)
    );

    await writeFile(
      join(playerDir, 'stats.json'),
      JSON.stringify(memory.stats, null, 2)
    );
  }

  async saveProfile(playerId: string): Promise<void> {
    const profile = this.profiles.get(playerId);
    if (!profile) return;

    const playerDir = await this.ensurePlayerDir(playerId);
    await writeFile(
      join(playerDir, 'profile.json'),
      JSON.stringify(profile, null, 2)
    );
  }

  addMessage(playerId: string, message: Message): void {
    const memory = this.memories.get(playerId);
    if (!memory) return;

    memory.conversationWindow.push(message);

    while (memory.conversationWindow.length > this.maxConversationWindow) {
      memory.conversationWindow.shift();
    }
  }

  addLongTermMemory(playerId: string, fact: string): void {
    const memory = this.memories.get(playerId);
    if (!memory) return;

    memory.longTermMemory.push(fact);

    while (memory.longTermMemory.length > this.maxLongTermMemories) {
      memory.longTermMemory.shift();
    }
  }

  setRecentSummary(playerId: string, summary: string): void {
    const memory = this.memories.get(playerId);
    if (!memory) return;
    memory.recentSummary = summary;
  }

  updateRelationship(playerId: string, delta: number): void {
    const profile = this.profiles.get(playerId);
    if (!profile) return;
    profile.relationshipLevel = Math.max(0, Math.min(100, profile.relationshipLevel + delta));
  }

  addEvent(playerId: string, event: Omit<GameEvent, 'timestamp'>): void {
    const memory = this.memories.get(playerId);
    if (!memory) return;

    memory.recentEvents.push({
      ...event,
      timestamp: Date.now()
    });

    while (memory.recentEvents.length > 20) {
      memory.recentEvents.shift();
    }
  }

  getRecentEventsContext(playerId: string): string {
    const memory = this.memories.get(playerId);
    if (!memory || memory.recentEvents.length === 0) return '';

    const events = memory.recentEvents
      .slice(-10)
      .map(e => `- ${e.description}`)
      .join('\n');

    return `## Recent Activity\n${events}`;
  }

  clearEvents(playerId: string): void {
    const memory = this.memories.get(playerId);
    if (memory) {
      memory.recentEvents = [];
    }
  }

  getStats(playerId: string): CompanionStats | null {
    const memory = this.memories.get(playerId);
    return memory?.stats || null;
  }

  awardXp(playerId: string, amount: number): { xpGained: number; leveledUp: boolean; newLevel?: number; stats: CompanionStats } {
    const memory = this.memories.get(playerId);
    if (!memory) {
      return { xpGained: 0, leveledUp: false, stats: { ...DEFAULT_COMPANION_STATS } };
    }

    memory.stats.xp += amount;

    // Check for level up
    const xpForNextLevel = getXpForLevel(memory.stats.level + 1);
    if (memory.stats.xp >= xpForNextLevel) {
      memory.stats.level += 1;
      memory.stats.xpToLevel = getXpToNextLevel(memory.stats.level);

      // Recalculate XP within current level
      const currentLevelXp = getXpForLevel(memory.stats.level);
      memory.stats.xp = memory.stats.xp - currentLevelXp;

      console.log(`[wyrt_companion] Companion leveled up to ${memory.stats.level}!`);

      return {
        xpGained: amount,
        leveledUp: true,
        newLevel: memory.stats.level,
        stats: { ...memory.stats }
      };
    }

    return { xpGained: amount, leveledUp: false, stats: { ...memory.stats } };
  }

  async onPlayerDisconnect(playerId: string): Promise<void> {
    await this.saveMemory(playerId);
    await this.saveProfile(playerId);
    this.memories.delete(playerId);
    this.profiles.delete(playerId);
  }

  // Get cached memory without loading
  getMemory(playerId: string): CompanionMemory | null {
    return this.memories.get(playerId) || null;
  }

  // Get cached profile without loading
  getProfile(playerId: string): CompanionProfile | null {
    return this.profiles.get(playerId) || null;
  }

  // Set profile in cache
  setProfile(playerId: string, profile: CompanionProfile): void {
    this.profiles.set(playerId, profile);
  }
}
