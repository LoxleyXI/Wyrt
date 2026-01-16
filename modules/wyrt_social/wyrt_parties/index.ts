/**
 * @module wyrt_parties
 * @description Party system for temporary groups with invites, loot sharing, and XP distribution
 * @category Social
 *
 * @features
 * - Party creation and disbanding
 * - Invite and kick members
 * - Party leader transfer
 * - Loot distribution modes (free-for-all, round-robin, need/greed)
 * - XP sharing among party members
 * - Configurable party size limits
 * - Invite expiration
 *
 * @usage
 * ```typescript
 * const partiesModule = context.getModule('wyrt_parties');
 * const partyManager = partiesModule.createPartyManager('my_game', {
 *   maxPartySize: 5,
 *   characterNameResolver: async (id) => getCharacterName(id)
 * });
 *
 * // Create a party
 * const party = await partyManager.createParty(leaderId);
 *
 * // Invite a player
 * await partyManager.inviteToParty(leaderId, targetId);
 *
 * // Accept invite
 * await partyManager.acceptPartyInvite(targetId, inviteId);
 *
 * // Distribute XP to party
 * await partyManager.distributeXP(partyId, baseXP);
 *
 * // Get party members
 * const members = await partyManager.getPartyMembers(partyId);
 * ```
 *
 * @exports PartyManager - Manages temporary player groups
 */
import { IModule, ModuleContext } from "../../../src/module/IModule";
import { PartyManager, CharacterNameResolver } from "./systems/PartyManager";
import { PrismaClient } from "@prisma/client";
import colors from "colors/safe";

export interface PartyManagerOptions {
    maxPartySize?: number;
    inviteExpirationMinutes?: number;
    characterNameResolver?: CharacterNameResolver;
}

export default class WyrtPartiesModule implements IModule {
    name = "wyrt_parties";
    version = "2.0.0";
    description = "Generic party system for multiplayer games";
    dependencies = ["wyrt_data"];

    private context?: ModuleContext;
    private prisma?: PrismaClient;
    private partyManagers: Map<string, PartyManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;

        // Get Prisma client from wyrt_data module
        const dataModule = context.getModule('wyrt_data');
        if (dataModule && typeof dataModule.getDatabase === 'function') {
            this.prisma = dataModule.getDatabase();
        }

        if (!this.prisma) {
            context.logger.warn(`[${this.name}] Prisma client not available - party system will not function`);
            return;
        }

        context.logger.info(`[${this.name}] Initializing party system...`);
        context.logger.info(`[${this.name}] ✓ Party system ready`);
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.green("+module ") + "wyrt_parties");
        context.events.emit('partiesModuleActivated');
    }

    async deactivate(context: ModuleContext): Promise<void> {
        this.partyManagers.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Create a new party manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @param options - Optional configuration for the party manager
     * @returns The created party manager
     */
    createPartyManager(gameId: string, options?: PartyManagerOptions): PartyManager {
        if (this.partyManagers.has(gameId)) {
            return this.partyManagers.get(gameId)!;
        }
        if (!this.context) {
            throw new Error('Module not initialized');
        }
        if (!this.prisma) {
            throw new Error('Prisma client not available');
        }

        const manager = new PartyManager(
            this.prisma,
            this.context.events,
            this.context.logger,
            gameId,
            options
        );

        this.partyManagers.set(gameId, manager);
        console.log(`[${this.name}] Created party manager for game: ${gameId}`);
        return manager;
    }

    /**
     * Get a party manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The party manager for that game
     */
    getPartyManager(gameId: string): PartyManager {
        const manager = this.partyManagers.get(gameId);
        if (!manager) {
            throw new Error(`PartyManager for game '${gameId}' not found. Did you call createPartyManager()?`);
        }
        return manager;
    }
}

// Re-export class and types
export { PartyManager } from "./systems/PartyManager";
export type { Party, PartyMember, PartyInvite, PartyAPI, LootItem, CharacterNameResolver } from "./systems/PartyManager";
