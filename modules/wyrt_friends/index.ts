import { IModule, ModuleContext } from "../../src/module/IModule";
import { FriendManager } from "./systems/FriendManager";
import colors from "colors/safe";

export default class WyrtFriendsModule implements IModule {
    name = "wyrt_friends";
    version = "1.0.0";
    description = "Generic friend system for multiplayer games";
    dependencies = [];

    private context?: ModuleContext;
    private friendManagers: Map<string, FriendManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
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
     * @returns The created friend manager
     */
    createFriendManager(gameId: string): FriendManager {
        if (this.friendManagers.has(gameId)) {
            throw new Error(`FriendManager for game '${gameId}' already exists`);
        }
        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const manager = new FriendManager(this.context, gameId);
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
