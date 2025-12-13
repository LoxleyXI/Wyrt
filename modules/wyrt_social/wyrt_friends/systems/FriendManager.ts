import { ModuleContext } from "../../../src/module/ModuleContext";

export interface Friend {
    characterId: number;
    characterName: string;
    isOnline: boolean;
    friendSince: Date;
}

export interface FriendRequest {
    requestId: number;
    fromCharacterId: number;
    fromCharacterName: string;
    toCharacterId: number;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
}

export interface FriendAPI {
    sendFriendRequest(characterId: number, targetCharacterId: number): Promise<boolean>;
    acceptFriendRequest(characterId: number, requestId: number): Promise<boolean>;
    rejectFriendRequest(characterId: number, requestId: number): Promise<boolean>;
    removeFriend(characterId: number, friendCharacterId: number): Promise<boolean>;
    getFriends(characterId: number): Promise<{ online: Friend[], offline: Friend[] }>;
    getFriendRequests(characterId: number): Promise<FriendRequest[]>;
    blockUser(characterId: number, targetCharacterId: number): Promise<boolean>;
    unblockUser(characterId: number, blockedCharacterId: number): Promise<boolean>;
    isBlocked(characterId: number, targetCharacterId: number): Promise<boolean>;
    isFriend(characterId: number, targetCharacterId: number): Promise<boolean>;
    isOnline(characterId: number): Promise<boolean>;
}

export class FriendManager {
    private context: ModuleContext;
    private gameId: string;
    private friendsTable: string;
    private requestsTable: string;
    private blockedTable: string;
    private onlineChecker?: (characterId: number) => boolean;

    constructor(context: ModuleContext, gameId: string) {
        this.context = context;
        this.gameId = gameId;
        this.friendsTable = `${gameId}_friends`;
        this.requestsTable = `${gameId}_friend_requests`;
        this.blockedTable = `${gameId}_blocked_users`;
    }

    /**
     * Set a callback function to check if a character is online
     * The game module should provide this based on its player tracking
     */
    setOnlineChecker(checker: (characterId: number) => boolean): void {
        this.onlineChecker = checker;
    }

    getAPI(): FriendAPI {
        return {
            sendFriendRequest: this.sendFriendRequest.bind(this),
            acceptFriendRequest: this.acceptFriendRequest.bind(this),
            rejectFriendRequest: this.rejectFriendRequest.bind(this),
            removeFriend: this.removeFriend.bind(this),
            getFriends: this.getFriends.bind(this),
            getFriendRequests: this.getFriendRequests.bind(this),
            blockUser: this.blockUser.bind(this),
            unblockUser: this.unblockUser.bind(this),
            isBlocked: this.isBlocked.bind(this),
            isFriend: this.isFriend.bind(this),
            isOnline: this.isOnline.bind(this)
        };
    }

    async sendFriendRequest(characterId: number, targetCharacterId: number): Promise<boolean> {
        try {
            // Check if already friends
            if (await this.isFriend(characterId, targetCharacterId)) {
                this.context.logger.warn(`Characters ${characterId} and ${targetCharacterId} are already friends`);
                return false;
            }

            // Check if blocked
            if (await this.isBlocked(targetCharacterId, characterId)) {
                this.context.logger.warn(`Character ${characterId} is blocked by ${targetCharacterId}`);
                return false;
            }

            // Check for existing pending request
            const [existingRows] = await this.context.db.query(
                `SELECT id FROM ${this.requestsTable}
                 WHERE ((from_character_id = ? AND to_character_id = ?)
                    OR (from_character_id = ? AND to_character_id = ?))
                 AND status = 'pending'`,
                [characterId, targetCharacterId, targetCharacterId, characterId]
            ) as any;

            if (existingRows.length > 0) {
                this.context.logger.warn(`Friend request already pending between ${characterId} and ${targetCharacterId}`);
                return false;
            }

            // Create friend request
            await this.context.db.query(
                `INSERT INTO ${this.requestsTable} (from_character_id, to_character_id, status, created_at)
                 VALUES (?, ?, 'pending', NOW())`,
                [characterId, targetCharacterId]
            );

            // Emit event
            this.context.events.emit('friends:requestSent', {
                fromCharacterId: characterId,
                toCharacterId: targetCharacterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error sending friend request: ${error}`);
            return false;
        }
    }

    async acceptFriendRequest(characterId: number, requestId: number): Promise<boolean> {
        try {
            // Get request
            const [rows] = await this.context.db.query(
                `SELECT * FROM ${this.requestsTable} WHERE id = ? AND to_character_id = ? AND status = 'pending'`,
                [requestId, characterId]
            ) as any;

            if (rows.length === 0) {
                this.context.logger.warn(`Friend request ${requestId} not found for character ${characterId}`);
                return false;
            }

            const request = rows[0];
            const fromCharacterId = request.from_character_id;

            // Update request status
            await this.context.db.query(
                `UPDATE ${this.requestsTable} SET status = 'accepted' WHERE id = ?`,
                [requestId]
            );

            // Add friendship (bidirectional)
            await this.context.db.query(
                `INSERT INTO ${this.friendsTable} (character_id_1, character_id_2, created_at)
                 VALUES (?, ?, NOW())`,
                [Math.min(characterId, fromCharacterId), Math.max(characterId, fromCharacterId)]
            );

            // Emit event
            this.context.events.emit('friends:requestAccepted', {
                characterId,
                friendCharacterId: fromCharacterId,
                requestId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error accepting friend request: ${error}`);
            return false;
        }
    }

    async rejectFriendRequest(characterId: number, requestId: number): Promise<boolean> {
        try {
            const result = await this.context.db.query(
                `UPDATE ${this.requestsTable} SET status = 'rejected'
                 WHERE id = ? AND to_character_id = ? AND status = 'pending'`,
                [requestId, characterId]
            ) as any;

            if (result[0].affectedRows === 0) {
                this.context.logger.warn(`Friend request ${requestId} not found for character ${characterId}`);
                return false;
            }

            // Emit event
            this.context.events.emit('friends:requestRejected', {
                characterId,
                requestId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error rejecting friend request: ${error}`);
            return false;
        }
    }

    async removeFriend(characterId: number, friendCharacterId: number): Promise<boolean> {
        try {
            const result = await this.context.db.query(
                `DELETE FROM ${this.friendsTable}
                 WHERE (character_id_1 = ? AND character_id_2 = ?)
                    OR (character_id_1 = ? AND character_id_2 = ?)`,
                [
                    Math.min(characterId, friendCharacterId),
                    Math.max(characterId, friendCharacterId),
                    Math.min(friendCharacterId, characterId),
                    Math.max(friendCharacterId, characterId)
                ]
            ) as any;

            if (result[0].affectedRows === 0) {
                this.context.logger.warn(`Friendship not found between ${characterId} and ${friendCharacterId}`);
                return false;
            }

            // Emit event
            this.context.events.emit('friends:removed', {
                characterId,
                friendCharacterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error removing friend: ${error}`);
            return false;
        }
    }

    async getFriends(characterId: number): Promise<{ online: Friend[], offline: Friend[] }> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT
                    CASE
                        WHEN f.character_id_1 = ? THEN f.character_id_2
                        ELSE f.character_id_1
                    END as friend_character_id,
                    c.name as character_name,
                    f.created_at as friend_since
                 FROM ${this.friendsTable} f
                 JOIN characters c ON c.id = CASE
                    WHEN f.character_id_1 = ? THEN f.character_id_2
                    ELSE f.character_id_1
                 END
                 WHERE f.character_id_1 = ? OR f.character_id_2 = ?`,
                [characterId, characterId, characterId, characterId]
            ) as any;

            const online: Friend[] = [];
            const offline: Friend[] = [];

            for (const row of rows) {
                const isOnline = await this.isOnline(row.friend_character_id);
                const friend: Friend = {
                    characterId: row.friend_character_id,
                    characterName: row.character_name,
                    isOnline,
                    friendSince: row.friend_since
                };

                if (isOnline) {
                    online.push(friend);
                } else {
                    offline.push(friend);
                }
            }

            return { online, offline };
        } catch (error) {
            this.context.logger.error(`Error getting friends: ${error}`);
            return { online: [], offline: [] };
        }
    }

    async getFriendRequests(characterId: number): Promise<FriendRequest[]> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT r.id, r.from_character_id, r.to_character_id, r.status, r.created_at, c.name as from_character_name
                 FROM ${this.requestsTable} r
                 JOIN characters c ON c.id = r.from_character_id
                 WHERE r.to_character_id = ? AND r.status = 'pending'
                 ORDER BY r.created_at DESC`,
                [characterId]
            ) as any;

            return rows.map((row: any) => ({
                requestId: row.id,
                fromCharacterId: row.from_character_id,
                fromCharacterName: row.from_character_name,
                toCharacterId: row.to_character_id,
                status: row.status,
                createdAt: row.created_at
            }));
        } catch (error) {
            this.context.logger.error(`Error getting friend requests: ${error}`);
            return [];
        }
    }

    async blockUser(characterId: number, targetCharacterId: number): Promise<boolean> {
        try {
            // Remove friendship if exists
            await this.removeFriend(characterId, targetCharacterId);

            // Add to blocked list
            await this.context.db.query(
                `INSERT IGNORE INTO ${this.blockedTable} (character_id, blocked_character_id, created_at)
                 VALUES (?, ?, NOW())`,
                [characterId, targetCharacterId]
            );

            // Emit event
            this.context.events.emit('friends:userBlocked', {
                characterId,
                blockedCharacterId: targetCharacterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error blocking user: ${error}`);
            return false;
        }
    }

    async unblockUser(characterId: number, blockedCharacterId: number): Promise<boolean> {
        try {
            const result = await this.context.db.query(
                `DELETE FROM ${this.blockedTable}
                 WHERE character_id = ? AND blocked_character_id = ?`,
                [characterId, blockedCharacterId]
            ) as any;

            if (result[0].affectedRows === 0) {
                this.context.logger.warn(`User ${blockedCharacterId} not blocked by ${characterId}`);
                return false;
            }

            // Emit event
            this.context.events.emit('friends:userUnblocked', {
                characterId,
                blockedCharacterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error unblocking user: ${error}`);
            return false;
        }
    }

    async isBlocked(characterId: number, targetCharacterId: number): Promise<boolean> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT id FROM ${this.blockedTable}
                 WHERE character_id = ? AND blocked_character_id = ?`,
                [characterId, targetCharacterId]
            ) as any;

            return rows.length > 0;
        } catch (error) {
            this.context.logger.error(`Error checking if blocked: ${error}`);
            return false;
        }
    }

    async isFriend(characterId: number, targetCharacterId: number): Promise<boolean> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT id FROM ${this.friendsTable}
                 WHERE (character_id_1 = ? AND character_id_2 = ?)
                    OR (character_id_1 = ? AND character_id_2 = ?)`,
                [
                    Math.min(characterId, targetCharacterId),
                    Math.max(characterId, targetCharacterId),
                    Math.min(targetCharacterId, characterId),
                    Math.max(targetCharacterId, characterId)
                ]
            ) as any;

            return rows.length > 0;
        } catch (error) {
            this.context.logger.error(`Error checking if friend: ${error}`);
            return false;
        }
    }

    async isOnline(characterId: number): Promise<boolean> {
        try {
            // Use the online checker callback if provided
            if (this.onlineChecker) {
                return this.onlineChecker(characterId);
            }
            // Default: character is offline if no checker is set
            return false;
        } catch (error) {
            this.context.logger.error(`Error checking online status: ${error}`);
            return false;
        }
    }
}
