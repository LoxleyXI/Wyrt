import { IModule, ModuleContext } from "../../src/module/IModule";
import { ChatManager } from "./systems/ChatManager";
import colors from "colors/safe";

export default class WyrtChatModule implements IModule {
    name = "wyrt_chat";
    version = "1.0.0";
    description = "Generic chat system with multiple channels for multiplayer games";
    dependencies = [];

    private context?: ModuleContext;
    private chatManagers: Map<string, ChatManager> = new Map();

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        context.logger.info(`[${this.name}] Initializing chat system...`);
        context.logger.info(`[${this.name}] ✓ Chat system ready`);
    }

    async activate(context: ModuleContext): Promise<void> {
        context.logger.debug(colors.green("+module ") + "wyrt_chat");
        context.events.emit('chatModuleActivated');
    }

    async deactivate(context: ModuleContext): Promise<void> {
        this.chatManagers.clear();
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Create a new chat manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The created chat manager
     */
    createChatManager(gameId: string): ChatManager {
        if (this.chatManagers.has(gameId)) {
            throw new Error(`ChatManager for game '${gameId}' already exists`);
        }
        if (!this.context) {
            throw new Error('Module not initialized');
        }

        const manager = new ChatManager(this.context, gameId);
        this.chatManagers.set(gameId, manager);
        console.log(`[${this.name}] Created chat manager for game: ${gameId}`);
        return manager;
    }

    /**
     * Get a chat manager for a specific game
     *
     * @param gameId - Unique identifier for the game
     * @returns The chat manager for that game
     */
    getChatManager(gameId: string): ChatManager {
        const manager = this.chatManagers.get(gameId);
        if (!manager) {
            throw new Error(`ChatManager for game '${gameId}' not found. Did you call createChatManager()?`);
        }
        return manager;
    }
}
