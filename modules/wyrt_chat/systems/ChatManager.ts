import { ModuleContext } from "../../../src/module/ModuleContext";

export type ChannelType = 'global' | 'guild' | 'party' | 'whisper' | 'trade' | 'system';

export interface ChatMessage {
    messageId: number;
    channelType: ChannelType;
    channelId: number | null;
    fromCharacterId: number;
    fromCharacterName: string;
    toCharacterId?: number;
    message: string;
    createdAt: Date;
}

export interface ChatAPI {
    sendMessage(characterId: number, channelType: ChannelType, channelId: number | null, message: string, toCharacterId?: number): Promise<boolean>;
    whisper(characterId: number, targetCharacterId: number, message: string): Promise<boolean>;
    subscribeToChannel(characterId: number, channelType: ChannelType, channelId: number | null): Promise<boolean>;
    unsubscribeFromChannel(characterId: number, channelType: ChannelType, channelId: number | null): Promise<boolean>;
    getMessageHistory(channelType: ChannelType, channelId: number | null, limit: number): Promise<ChatMessage[]>;
    getSubscriptions(characterId: number): Promise<{ channelType: ChannelType, channelId: number | null }[]>;
    broadcastToChannel(channelType: ChannelType, channelId: number | null, message: string, fromCharacterId?: number): Promise<void>;
    systemMessage(characterId: number, message: string): Promise<void>;
}

export class ChatManager {
    private context: ModuleContext;
    private gameId: string;
    private messagesTable: string;
    private subscriptionsTable: string;
    private messageHistoryLimit = 100;
    private spamThrottleMs = 1000; // 1 second between messages
    private lastMessageTime: Map<number, number> = new Map();

    constructor(context: ModuleContext, gameId: string) {
        this.context = context;
        this.gameId = gameId;
        this.messagesTable = `${gameId}_chat_messages`;
        this.subscriptionsTable = `${gameId}_chat_subscriptions`;
    }

    getAPI(): ChatAPI {
        return {
            sendMessage: this.sendMessage.bind(this),
            whisper: this.whisper.bind(this),
            subscribeToChannel: this.subscribeToChannel.bind(this),
            unsubscribeFromChannel: this.unsubscribeFromChannel.bind(this),
            getMessageHistory: this.getMessageHistory.bind(this),
            getSubscriptions: this.getSubscriptions.bind(this),
            broadcastToChannel: this.broadcastToChannel.bind(this),
            systemMessage: this.systemMessage.bind(this)
        };
    }

    async sendMessage(
        characterId: number,
        channelType: ChannelType,
        channelId: number | null,
        message: string,
        toCharacterId?: number
    ): Promise<boolean> {
        try {
            // Anti-spam check
            const now = Date.now();
            const lastTime = this.lastMessageTime.get(characterId) || 0;
            if (now - lastTime < this.spamThrottleMs) {
                this.context.logger.warn(`Character ${characterId} is sending messages too quickly`);
                return false;
            }
            this.lastMessageTime.set(characterId, now);

            // Validate message
            if (!message || message.trim().length === 0) {
                return false;
            }

            // Truncate long messages
            message = message.substring(0, 500);

            // Validate channel access
            if (channelType === 'guild' && channelId) {
                // Check if character is in guild
                const results = await this.context.events.emitAsync('chat:validateGuildAccess', {
                    characterId,
                    guildId: channelId
                });
                if (!results || !results.some((r: any) => r === true)) {
                    this.context.logger.warn(`Character ${characterId} not in guild ${channelId}`);
                    return false;
                }
            } else if (channelType === 'party' && channelId) {
                // Check if character is in party
                const results = await this.context.events.emitAsync('chat:validatePartyAccess', {
                    characterId,
                    partyId: channelId
                });
                if (!results || !results.some((r: any) => r === true)) {
                    this.context.logger.warn(`Character ${characterId} not in party ${channelId}`);
                    return false;
                }
            }

            // Get character name
            const [charRows] = await this.context.db.query(
                `SELECT name FROM characters WHERE id = ?`,
                [characterId]
            ) as any;

            if (charRows.length === 0) {
                return false;
            }

            const characterName = charRows[0].name;

            // Store message
            const result = await this.context.db.query(
                `INSERT INTO ${this.messagesTable}
                 (channel_type, channel_id, from_character_id, to_character_id, message, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [channelType, channelId, characterId, toCharacterId || null, message]
            ) as any;

            const messageId = result[0].insertId;

            // Emit event to broadcast message to all subscribers
            this.context.events.emit('chat:messageSent', {
                messageId,
                channelType,
                channelId,
                fromCharacterId: characterId,
                fromCharacterName: characterName,
                toCharacterId,
                message,
                createdAt: new Date()
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error sending message: ${error}`);
            return false;
        }
    }

    async whisper(characterId: number, targetCharacterId: number, message: string): Promise<boolean> {
        try {
            // Check if target exists and is online
            const results = await this.context.events.emitAsync('chat:checkOnlineStatus', targetCharacterId);
            const isOnline = results && results.some((result: any) => result === true);

            if (!isOnline) {
                this.context.logger.warn(`Target ${targetCharacterId} is offline`);
                return false;
            }

            return await this.sendMessage(characterId, 'whisper', null, message, targetCharacterId);
        } catch (error) {
            this.context.logger.error(`Error sending whisper: ${error}`);
            return false;
        }
    }

    async subscribeToChannel(characterId: number, channelType: ChannelType, channelId: number | null): Promise<boolean> {
        try {
            // Check if already subscribed
            const [existingRows] = await this.context.db.query(
                `SELECT id FROM ${this.subscriptionsTable}
                 WHERE character_id = ? AND channel_type = ? AND (channel_id = ? OR (channel_id IS NULL AND ? IS NULL))`,
                [characterId, channelType, channelId, channelId]
            ) as any;

            if (existingRows.length > 0) {
                return true; // Already subscribed
            }

            // Add subscription
            await this.context.db.query(
                `INSERT INTO ${this.subscriptionsTable} (character_id, channel_type, channel_id, created_at)
                 VALUES (?, ?, ?, NOW())`,
                [characterId, channelType, channelId]
            );

            return true;
        } catch (error) {
            this.context.logger.error(`Error subscribing to channel: ${error}`);
            return false;
        }
    }

    async unsubscribeFromChannel(characterId: number, channelType: ChannelType, channelId: number | null): Promise<boolean> {
        try {
            await this.context.db.query(
                `DELETE FROM ${this.subscriptionsTable}
                 WHERE character_id = ? AND channel_type = ? AND (channel_id = ? OR (channel_id IS NULL AND ? IS NULL))`,
                [characterId, channelType, channelId, channelId]
            );

            return true;
        } catch (error) {
            this.context.logger.error(`Error unsubscribing from channel: ${error}`);
            return false;
        }
    }

    async getMessageHistory(channelType: ChannelType, channelId: number | null, limit: number = 50): Promise<ChatMessage[]> {
        try {
            limit = Math.min(limit, this.messageHistoryLimit);

            const [rows] = await this.context.db.query(
                `SELECT m.id, m.channel_type, m.channel_id, m.from_character_id, m.to_character_id, m.message, m.created_at,
                        c.name as from_character_name
                 FROM ${this.messagesTable} m
                 JOIN characters c ON c.id = m.from_character_id
                 WHERE m.channel_type = ? AND (m.channel_id = ? OR (m.channel_id IS NULL AND ? IS NULL))
                 ORDER BY m.created_at DESC
                 LIMIT ?`,
                [channelType, channelId, channelId, limit]
            ) as any;

            return rows.reverse().map((row: any) => ({
                messageId: row.id,
                channelType: row.channel_type,
                channelId: row.channel_id,
                fromCharacterId: row.from_character_id,
                fromCharacterName: row.from_character_name,
                toCharacterId: row.to_character_id,
                message: row.message,
                createdAt: row.created_at
            }));
        } catch (error) {
            this.context.logger.error(`Error getting message history: ${error}`);
            return [];
        }
    }

    async getSubscriptions(characterId: number): Promise<{ channelType: ChannelType, channelId: number | null }[]> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT channel_type, channel_id FROM ${this.subscriptionsTable}
                 WHERE character_id = ?`,
                [characterId]
            ) as any;

            return rows.map((row: any) => ({
                channelType: row.channel_type,
                channelId: row.channel_id
            }));
        } catch (error) {
            this.context.logger.error(`Error getting subscriptions: ${error}`);
            return [];
        }
    }

    async broadcastToChannel(
        channelType: ChannelType,
        channelId: number | null,
        message: string,
        fromCharacterId?: number
    ): Promise<void> {
        try {
            // Store system message
            await this.context.db.query(
                `INSERT INTO ${this.messagesTable}
                 (channel_type, channel_id, from_character_id, message, created_at)
                 VALUES (?, ?, ?, ?, NOW())`,
                [channelType, channelId, fromCharacterId || 0, message]
            );

            // Emit event to broadcast to all subscribers
            this.context.events.emit('chat:broadcast', {
                channelType,
                channelId,
                message,
                fromCharacterId
            });
        } catch (error) {
            this.context.logger.error(`Error broadcasting to channel: ${error}`);
        }
    }

    async systemMessage(characterId: number, message: string): Promise<void> {
        try {
            // Send system message directly to character (not stored in DB)
            this.context.events.emit('chat:systemMessage', {
                characterId,
                message
            });
        } catch (error) {
            this.context.logger.error(`Error sending system message: ${error}`);
        }
    }

    /**
     * Clean up old messages (should be called periodically)
     */
    async cleanupOldMessages(daysToKeep: number = 30): Promise<number> {
        try {
            const result = await this.context.db.query(
                `DELETE FROM ${this.messagesTable}
                 WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
                [daysToKeep]
            ) as any;

            const deletedCount = result[0].affectedRows;
            if (deletedCount > 0) {
                this.context.logger.debug(`Cleaned up ${deletedCount} old chat messages`);
            }

            return deletedCount;
        } catch (error) {
            this.context.logger.error(`Error cleaning up old messages: ${error}`);
            return 0;
        }
    }
}
