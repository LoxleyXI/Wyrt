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
 * - Party chat channel
 * - Configurable party size limits
 * - Auto-disband on leader disconnect
 *
 * @usage
 * ```typescript
 * const partiesModule = context.getModule('wyrt_parties');
 * const partyManager = partiesModule.createPartyManager('my_game');
 *
 * // Create a party
 * const party = partyManager.createParty(leaderId);
 *
 * // Invite a player
 * partyManager.invite(partyId, leaderId, targetId);
 *
 * // Accept invite
 * partyManager.acceptInvite(targetId, partyId);
 *
 * // Distribute XP to party
 * partyManager.distributeXP(partyId, baseXP);
 *
 * // Get party members
 * const members = partyManager.getMembers(partyId);
 * ```
 *
 * @exports PartyManager - Manages temporary player groups
 */
import { IModule, ModuleContext } from "../../../src/module/IModule";
import { PartyManager } from "./systems/PartyManager";
import colors from "colors/safe";

export default class WyrtPartiesModule implements IModule {
    name = "wyrt_parties";
    version = "1.0.0";
    description = "Generic party system for multiplayer games";
    dependencies = [];

    private context?: ModuleContext;
    private partyManagers: Map<string, PartyManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
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
     * @returns The created party manager
     */
    createPartyManager(gameId: string): PartyManager {
        if (this.partyManagers.has(gameId)) {
            throw new Error(`PartyManager for game '${gameId}' already exists`);
        }
        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const manager = new PartyManager(this.context, gameId);
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
