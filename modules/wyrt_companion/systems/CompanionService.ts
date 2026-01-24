/**
 * Companion Service
 * Handles AI interactions for companions using Claude API
 */

import Anthropic from '@anthropic-ai/sdk';
import { MemoryManager } from './MemoryManager';
import {
  CompanionConfig,
  CompanionMemory,
  CompanionProfile,
  GameContext,
  GameEvent,
  MilestoneEvent,
  DEFAULT_CONFIG,
  SubscriptionTier,
  TierCompanionConfig,
  DEFAULT_TIER_CONFIG,
  CompanionStats,
} from '../types';

export interface CompanionServiceConfig extends Partial<CompanionConfig> {
  apiKey?: string;
  memoryManager: MemoryManager;
  tierConfig?: Record<string, TierCompanionConfig>;
  gameName?: string;
  gameDescription?: string;
}

export class CompanionService {
  private client: Anthropic | null = null;
  private memory: MemoryManager;
  private config: CompanionConfig;
  private tierConfig: Record<string, TierCompanionConfig>;
  private enabled: boolean = false;
  private gameName: string;
  private gameDescription: string;

  constructor(serviceConfig: CompanionServiceConfig) {
    this.config = { ...DEFAULT_CONFIG, ...serviceConfig };
    this.memory = serviceConfig.memoryManager;
    this.tierConfig = serviceConfig.tierConfig || DEFAULT_TIER_CONFIG;
    this.gameName = serviceConfig.gameName || 'Adventure Game';
    this.gameDescription = serviceConfig.gameDescription || 'a text-based adventure game';

    const apiKey = serviceConfig.apiKey || process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.enabled = true;
      console.log('[wyrt_companion] Service enabled (Claude API connected)');
    } else {
      console.log('[wyrt_companion] Service disabled (no API key)');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async onPlayerConnect(playerId: string, playerName: string): Promise<string | null> {
    if (!this.enabled) return null;
    await this.memory.loadMemory(playerId, playerName);
    return null;
  }

  async onPlayerMessage(
    playerId: string,
    message: string,
    context: GameContext,
    tier: SubscriptionTier = 'free'
  ): Promise<string | null> {
    if (!this.enabled) return null;

    const tierConfig = this.tierConfig[tier] || this.tierConfig.free || DEFAULT_TIER_CONFIG.free;

    this.memory.addMessage(playerId, {
      role: 'player',
      content: message,
      timestamp: Date.now()
    });

    const isDeepQuestion = this.requiresDeepThinking(message);
    const mode = (isDeepQuestion && tierConfig.canDeepThink) ? 'deep' : 'quick';

    return this.generateResponse(playerId, message, context, mode, tierConfig);
  }

  async onCombatEvent(
    playerId: string,
    event: string,
    context: GameContext,
    tier: SubscriptionTier = 'free'
  ): Promise<string | null> {
    if (!this.enabled) return null;

    const tierConfig = this.tierConfig[tier] || DEFAULT_TIER_CONFIG.free;
    return this.generateResponse(
      playerId,
      `[Combat event: ${event}]`,
      context,
      'quick',
      tierConfig
    );
  }

  async onPlayerDisconnect(playerId: string): Promise<void> {
    if (!this.enabled) return;

    await this.summarizeSession(playerId);
    await this.memory.onPlayerDisconnect(playerId);
  }

  logEvent(playerId: string, type: GameEvent['type'], description: string): void {
    this.memory.addEvent(playerId, { type, description });
  }

  async onMilestone(
    playerId: string,
    event: MilestoneEvent,
    context: GameContext,
    tier: SubscriptionTier = 'free'
  ): Promise<string | null> {
    if (!this.enabled) return null;

    let prompt: string;
    switch (event.type) {
      case 'level_up':
        prompt = `[MILESTONE: The player just leveled up to level ${event.newLevel}! React with excitement and encouragement. Keep it brief - 1-2 sentences.]`;
        break;
      case 'boss_kill':
        prompt = `[MILESTONE: The party just defeated ${event.bossName}! Celebrate this victory. Keep it brief - 1-2 sentences.]`;
        break;
      case 'dungeon_enter':
        prompt = `[MILESTONE: The party just entered ${event.dungeonName}. Express anticipation or caution about what lies ahead. Keep it brief - 1-2 sentences.]`;
        break;
      case 'rare_loot':
        prompt = `[MILESTONE: A ${event.rarity} item dropped: ${event.itemName}! React with appropriate excitement. Keep it brief - 1-2 sentences.]`;
        break;
      case 'quest_complete':
        prompt = `[MILESTONE: Quest completed: "${event.questName}"! Congratulate the player. Keep it brief - 1-2 sentences.]`;
        break;
      case 'player_death':
        prompt = `[MILESTONE: The player just died! Express concern and encourage them. Keep it brief - 1-2 sentences.]`;
        break;
      case 'party_wipe':
        prompt = `[MILESTONE: The entire party was defeated! React with shock and offer comfort. Keep it brief - 1-2 sentences.]`;
        break;
      case 'first_kill':
        prompt = `[MILESTONE: The player killed their first ${event.mobName}! Congratulate this achievement. Keep it brief - 1-2 sentences.]`;
        break;
      case 'companion_join':
        prompt = `[You have just been summoned to join the player's adventure. Greet them warmly, introduce yourself briefly, and offer to help explore. Keep it brief - 2-3 sentences.]`;
        break;
      case 'custom':
        prompt = `[MILESTONE: ${event.description}. React appropriately. Keep it brief - 1-2 sentences.]`;
        break;
      default:
        return null;
    }

    const tierConfig = this.tierConfig[tier] || DEFAULT_TIER_CONFIG.free;
    return this.generateResponse(playerId, prompt, context, 'quick', tierConfig);
  }

  async onAreaEnter(
    playerId: string,
    roomName: string,
    context: GameContext,
    tier: SubscriptionTier = 'free',
    chance: number = 0.3
  ): Promise<string | null> {
    if (!this.enabled) return null;

    // Only comment occasionally
    if (Math.random() > chance) return null;

    const prompt = `[You just entered "${roomName}" with the player. Make a brief, natural observation about the area - comment on the atmosphere, something you notice, or a tactical consideration. Keep it to 1 sentence, conversational and in-character. Don't be overly dramatic.]`;

    const tierConfig = this.tierConfig[tier] || DEFAULT_TIER_CONFIG.free;
    return this.generateResponse(playerId, prompt, context, 'quick', tierConfig);
  }

  async onPartyChat(
    playerId: string,
    recentMessages: { sender: string; text: string }[],
    triggerMessage: string,
    context: GameContext,
    tier: SubscriptionTier = 'free'
  ): Promise<string | null> {
    if (!this.enabled) return null;

    let chatContext = '[PARTY CHAT - You were mentioned in party chat and should respond naturally.]\n\n';
    chatContext += 'Recent party messages:\n';
    for (const msg of recentMessages) {
      chatContext += `${msg.sender}: ${msg.text}\n`;
    }
    chatContext += '\n[Respond to the conversation naturally as a party member. Keep it brief - 1-2 sentences. Speak conversationally, not formally.]';

    const tierConfig = this.tierConfig[tier] || DEFAULT_TIER_CONFIG.free;
    return this.generateResponse(playerId, chatContext, context, 'quick', tierConfig);
  }

  private async generateResponse(
    playerId: string,
    playerInput: string,
    context: GameContext,
    mode: 'quick' | 'deep',
    tierConfig: TierCompanionConfig
  ): Promise<string | null> {
    if (!this.client) return null;

    try {
      const memory = await this.memory.loadMemory(playerId, playerInput);
      const profile = await this.memory.loadProfile(playerId);

      const systemPrompt = this.buildSystemPrompt(profile, memory, context);
      const messages = this.buildMessages(memory, playerInput);

      let model: string;
      if (mode === 'deep' && tierConfig.canDeepThink) {
        model = this.config.modelDeep;
      } else {
        model = tierConfig.model;
      }

      const response = await this.client.messages.create({
        model,
        max_tokens: mode === 'quick' ? 150 : 500,
        system: systemPrompt,
        messages
      });

      const content = response.content[0];
      if (content.type !== 'text') return null;

      const companionMessage = content.text;

      this.memory.addMessage(playerId, {
        role: 'companion',
        content: companionMessage,
        timestamp: Date.now()
      });

      return companionMessage;
    } catch (err) {
      console.error('[wyrt_companion] API error:', err);
      return null;
    }
  }

  private buildSystemPrompt(
    profile: CompanionProfile,
    memory: CompanionMemory,
    context: GameContext
  ): string {
    let prompt = `You are ${profile.name}, an AI companion in ${this.gameName}, ${this.gameDescription}.

## Your Character
${profile.personality}

## Background
${profile.background}

## How You Speak
${profile.speechStyle}

## Relationship
Your relationship with ${memory.playerName} is at level ${profile.relationshipLevel}/100.
${profile.relationshipLevel < 20 ? 'You are still getting to know each other.' : ''}
${profile.relationshipLevel >= 50 ? 'You trust each other deeply.' : ''}
${profile.relationshipLevel >= 80 ? 'You would die for each other.' : ''}

## Current Situation
Location: ${context.roomName}
${context.roomDescription ? `Description: ${context.roomDescription}` : ''}
${context.inCombat ? `IN COMBAT with: ${context.currentTarget}` : ''}
${context.nearbyMobs.length > 0 ? `Nearby enemies: ${context.nearbyMobs.join(', ')}` : ''}
${context.nearbyNpcs.length > 0 ? `Nearby NPCs: ${context.nearbyNpcs.join(', ')}` : ''}
${context.exits?.length > 0 ? `Exits: ${context.exits.map(e => `${e.direction} leads to ${e.destination}`).join(', ')}` : ''}
Player health: ${context.playerHealth}/${context.playerMaxHealth}
`;

    if (memory.longTermMemory.length > 0) {
      prompt += `\n## Things You Remember About ${memory.playerName}\n`;
      for (const fact of memory.longTermMemory) {
        prompt += `- ${fact}\n`;
      }
    }

    if (memory.recentSummary) {
      prompt += `\n## Last Time You Were Together\n${memory.recentSummary}\n`;
    }

    const recentEvents = this.memory.getRecentEventsContext(memory.playerId);
    if (recentEvents) {
      prompt += `\n${recentEvents}\n`;
    }

    prompt += `
## Guidelines
- Keep responses concise (1-3 sentences usually)
- React to the game situation naturally
- Be helpful but not overbearing
- During combat, be brief and urgent
- Reference shared memories when relevant
- Never break character or mention being an AI
- You fight alongside the player - you're a companion, not just a voice
`;

    return prompt;
  }

  private buildMessages(
    memory: CompanionMemory,
    currentInput: string
  ): Anthropic.MessageParam[] {
    const messages: Anthropic.MessageParam[] = [];

    for (const msg of memory.conversationWindow) {
      messages.push({
        role: msg.role === 'player' ? 'user' : 'assistant',
        content: msg.content
      });
    }

    messages.push({
      role: 'user',
      content: currentInput
    });

    return messages;
  }

  private requiresDeepThinking(message: string): boolean {
    const deepPatterns = [
      /what (do you|should i|can we)/i,
      /tell me about/i,
      /explain/i,
      /why/i,
      /how do/i,
      /what happened/i,
      /remember when/i,
      /advice/i,
      /help me/i
    ];

    return deepPatterns.some(pattern => pattern.test(message));
  }

  private async summarizeSession(playerId: string): Promise<void> {
    if (!this.client) return;

    const memory = await this.memory.loadMemory(playerId, '');
    if (memory.conversationWindow.length < 3) return;

    try {
      const conversationText = memory.conversationWindow
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const response = await this.client.messages.create({
        model: this.config.modelQuick,
        max_tokens: 200,
        system: 'Summarize this game session conversation in 2-3 sentences. Focus on key events, decisions, and emotional moments. Be concise.',
        messages: [{
          role: 'user',
          content: conversationText
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        this.memory.setRecentSummary(playerId, content.text);
      }
    } catch (err) {
      console.error('[wyrt_companion] Failed to summarize session:', err);
    }
  }

  async extractMemories(playerId: string): Promise<void> {
    if (!this.client) return;

    const memory = await this.memory.loadMemory(playerId, '');
    if (memory.conversationWindow.length < 5) return;

    try {
      const conversationText = memory.conversationWindow
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const response = await this.client.messages.create({
        model: this.config.modelQuick,
        max_tokens: 150,
        system: `Extract 0-2 important facts worth remembering about the player from this conversation.
Format as a JSON array of strings. Only include significant things like:
- Player preferences ("prefers stealth over combat")
- Important events ("defeated the Dragon together")
- Character traits ("always helps NPCs in need")
Return [] if nothing notable.`,
        messages: [{
          role: 'user',
          content: conversationText
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          const facts = JSON.parse(content.text);
          for (const fact of facts) {
            this.memory.addLongTermMemory(playerId, fact);
          }
        } catch {
          // Failed to parse, ignore
        }
      }
    } catch (err) {
      console.error('[wyrt_companion] Failed to extract memories:', err);
    }
  }

  async getRelationshipLevel(playerId: string): Promise<number> {
    try {
      const profile = await this.memory.loadProfile(playerId);
      return profile.relationshipLevel;
    } catch {
      return 10;
    }
  }

  async getCompanionName(playerId: string): Promise<string> {
    try {
      const profile = await this.memory.loadProfile(playerId);
      return profile.name;
    } catch {
      return 'Companion';
    }
  }

  increaseRelationship(playerId: string, amount: number = 1): void {
    this.memory.updateRelationship(playerId, amount);
  }

  getStats(playerId: string): CompanionStats | null {
    return this.memory.getStats(playerId);
  }

  awardXp(playerId: string, amount: number): { xpGained: number; leveledUp: boolean; newLevel?: number; stats: CompanionStats } {
    return this.memory.awardXp(playerId, amount);
  }

  // Get memory manager for direct access
  getMemoryManager(): MemoryManager {
    return this.memory;
  }
}
