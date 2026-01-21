/**
 * @module wyrt_friends
 * @description Friend list system with requests, blocking, and online status tracking
 * @category Social
 *
 * @features
 * - Send and receive friend requests
 * - Accept/decline friend requests
 * - Remove friends from list
 * - Block/unblock players
 * - Online status tracking
 * - Friend list persistence (database)
 * - Mutual friends detection
 *
 * @usage
 * ```typescript
 * const friendsModule = context.getModule('wyrt_friends');
 * const friendManager = friendsModule.createFriendManager('my_game', {
 *   characterNameResolver: async (id) => getCharacterName(id)
 * });
 *
 * // Send a friend request
 * await friendManager.sendFriendRequest(fromPlayerId, toPlayerId);
 *
 * // Accept a request
 * await friendManager.acceptFriendRequest(characterId, requestId);
 *
 * // Get friend list with online status
 * const friends = await friendManager.getFriends(playerId);
 * friends.online.forEach(f => console.log(f.name, 'online'));
 *
 * // Block a player
 * await friendManager.blockUser(playerId, blockedId);
 * ```
 *
 * @exports FriendManager - Manages friend relationships and requests
 */
import { IModule, ModuleContext } from "../../../src/module/IModule";
import { FriendManager, CharacterNameResolver } from "./systems/FriendManager";
import { PrismaClient } from "@prisma/client";
import colors from "colors/safe";

export interface FriendManagerOptions {
    characterNameResolver?: CharacterNameResolver;
}

export default class WyrtFriendsModule implements IModule {
    name = "wyrt_friends";
    version = "2.0.0";
    description = "Generic friend system for multiplayer games";
    dependencies = ["wyrt_data"];

    private context?: ModuleContext;
    private prisma?: PrismaClient;
    private friendManagers: Map<string, FriendManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;

        // Get Prisma client from wyrt_data module
        const dataModule = context.getModule('wyrt_data');
        if (dataModule && typeof dataModule.getDatabase === 'function') {
            this.prisma = dataModule.getDatabase();
        }

        if (!this.prisma) {
            context.logger.warn(`[${this.name}] Prisma client not available - friend system will not function`);
            return;
        }

        context.logger.info(`[${this.name}] Initializing friend system...`);
        context.logger.info(`[${this.name}] ✓ Friend system ready`);
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.green("+module ") + "wyrt_friends");
        context.events.emit('friendsModuleActivated');
    }

    async deactivate(context: ModuleContext): Promise<void> {
        this.friendManagers.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Create a new friend manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @param options - Optional configuration for the friend manager
     * @returns The created friend manager
     */
    createFriendManager(gameId: string, options?: FriendManagerOptions): FriendManager {
        if (this.friendManagers.has(gameId)) {
            return this.friendManagers.get(gameId)!;
        }
        if (!this.context) {
            throw new Error('Module not initialized');
        }
        if (!this.prisma) {
            throw new Error('Prisma client not available');
        }

        const manager = new FriendManager(
            this.prisma,
            this.context.events,
            this.context.logger,
            gameId,
            options
        );

        this.friendManagers.set(gameId, manager);
        console.log(`[${this.name}] Created friend manager for game: ${gameId}`);
        return manager;
    }

    /**
     * Get a friend manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The friend manager for that game
     */
    getFriendManager(gameId: string): FriendManager {
        const manager = this.friendManagers.get(gameId);
        if (!manager) {
            throw new Error(`FriendManager for game '${gameId}' not found. Did you call createFriendManager()?`);
        }
        return manager;
    }
}

// Re-export class and types
export { FriendManager } from "./systems/FriendManager";
export type { Friend, FriendRequest, FriendAPI, CharacterNameResolver } from "./systems/FriendManager";
