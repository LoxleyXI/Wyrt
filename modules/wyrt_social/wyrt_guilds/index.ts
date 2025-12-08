/**
 * @module wyrt_guilds
 * @description Guild system with ranks, permissions, bank, and recruitment
 * @category Social
 *
 * @features
 * - Guild creation with customizable settings
 * - Member ranks and permissions system
 * - Guild bank with deposit/withdraw
 * - Invite and application system
 * - Guild chat channel
 * - Member online status tracking
 * - Guild experience and leveling
 * - Guild disbanding and transfers
 *
 * @usage
 * ```typescript
 * const guildsModule = context.getModule('wyrt_guilds');
 * const guildManager = guildsModule.createGuildManager('my_game');
 *
 * // Create a guild
 * const guild = await guildManager.createGuild({
 *   name: 'Iron Knights',
 *   leaderId: playerId,
 *   tag: 'IK'
 * });
 *
 * // Invite a player
 * await guildManager.invitePlayer(guildId, inviterId, targetId);
 *
 * // Get guild members
 * const members = await guildManager.getMembers(guildId);
 *
 * // Promote a member
 * await guildManager.setRank(guildId, memberId, 'officer');
 * ```
 *
 * @exports GuildManager - Manages guilds, members, and permissions
 */
import { IModule, ModuleContext } from "../../../src/module/IModule";
import { GuildManager } from "./systems/GuildManager";
import colors from "colors/safe";

export default class WyrtGuildsModule implements IModule {
    name = "wyrt_guilds";
    version = "1.0.0";
    description = "Generic guild system for multiplayer games";
    dependencies = [];

    private context?: ModuleContext;
    private guildManagers: Map<string, GuildManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        context.logger.info(`[${this.name}] Initializing guild system...`);
        context.logger.info(`[${this.name}] ✓ Guild system ready`);
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.green("+module ") + "wyrt_guilds");
        context.events.emit('guildsModuleActivated');
    }

    async deactivate(context: ModuleContext): Promise<void> {
        this.guildManagers.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Create a new guild manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The created guild manager
     */
    createGuildManager(gameId: string): GuildManager {
        if (this.guildManagers.has(gameId)) {
            throw new Error(`GuildManager for game '${gameId}' already exists`);
        }
        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const manager = new GuildManager(this.context, gameId);
        this.guildManagers.set(gameId, manager);
        console.log(`[${this.name}] Created guild manager for game: ${gameId}`);
        return manager;
    }

    /**
     * Get a guild manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The guild manager for that game
     */
    getGuildManager(gameId: string): GuildManager {
        const manager = this.guildManagers.get(gameId);
        if (!manager) {
            throw new Error(`GuildManager for game '${gameId}' not found. Did you call createGuildManager()?`);
        }
        return manager;
    }
}
