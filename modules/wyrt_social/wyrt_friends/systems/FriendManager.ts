import { PrismaClient } from "@prisma/client";
import { EventEmitter } from "../../../../src/events/EventEmitter";

export interface Friend {
    characterId: string;
    characterName: string;
    isOnline: boolean;
    friendSince: Date;
}

export interface FriendRequest {
    requestId: string;
    fromCharacterId: string;
    fromCharacterName: string;
    toCharacterId: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
}

export interface FriendAPI {
    sendFriendRequest(characterId: string, targetCharacterId: string): Promise<boolean>;
    acceptFriendRequest(characterId: string, requestId: string): Promise<boolean>;
    rejectFriendRequest(characterId: string, requestId: string): Promise<boolean>;
    removeFriend(characterId: string, friendCharacterId: string): Promise<boolean>;
    getFriends(characterId: string): Promise<{ online: Friend[], offline: Friend[] }>;
    getFriendRequests(characterId: string): Promise<FriendRequest[]>;
    blockUser(characterId: string, targetCharacterId: string): Promise<boolean>;
    unblockUser(characterId: string, blockedCharacterId: string): Promise<boolean>;
    isBlocked(characterId: string, targetCharacterId: string): Promise<boolean>;
    isFriend(characterId: string, targetCharacterId: string): Promise<boolean>;
    isOnline(characterId: string): Promise<boolean>;
}

// Logger interface to avoid circular dependency
interface Logger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    debug(message: string): void;
}

// Character name resolver function type
export type CharacterNameResolver = (characterId: string) => Promise<string | undefined>;

export class FriendManager {
    private prisma: PrismaClient;
    private events: EventEmitter;
    private logger: Logger;
    private gameId: string;
    private onlineChecker?: (characterId: string) => boolean;
    private characterNameResolver?: CharacterNameResolver;

    constructor(
        prisma: PrismaClient,
        events: EventEmitter,
        logger: Logger,
        gameId: string,
        options?: {
            characterNameResolver?: CharacterNameResolver;
        }
    ) {
        this.prisma = prisma;
        this.events = events;
        this.logger = logger;
        this.gameId = gameId;

        if (options?.characterNameResolver) {
            this.characterNameResolver = options.characterNameResolver;
        }
    }

    /**
     * Set a callback function to check if a character is online
     * The game module should provide this based on its player tracking
     */
    setOnlineChecker(checker: (characterId: string) => boolean): void {
        this.onlineChecker = checker;
    }

    /**
     * Set a function to resolve character names from IDs
     */
    setCharacterNameResolver(resolver: CharacterNameResolver): void {
        this.characterNameResolver = resolver;
    }

    private async resolveCharacterName(characterId: string): Promise<string> {
        if (this.characterNameResolver) {
            const name = await this.characterNameResolver(characterId);
            if (name) return name;
        }
        return `Character_${characterId}`;
    }

    private getOrderedIds(id1: string, id2: string): [string, string] {
        // Always store lower ID first for consistent friendship lookups
        return id1 < id2 ? [id1, id2] : [id2, id1];
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

    async sendFriendRequest(characterId: string, targetCharacterId: string): Promise<boolean> {
        try {
            // Check if already friends
            if (await this.isFriend(characterId, targetCharacterId)) {
                this.logger.warn(`Characters ${characterId} and ${targetCharacterId} are already friends`);
                return false;
            }

            // Check if blocked
            if (await this.isBlocked(targetCharacterId, characterId)) {
                this.logger.warn(`Character ${characterId} is blocked by ${targetCharacterId}`);
                return false;
            }

            // Check for existing pending request (in either direction)
            const existingRequest = await this.prisma.friendRequest.findFirst({
                where: {
                    gameId: this.gameId,
                    status: 'pending',
                    OR: [
                        { fromCharacterId: characterId, toCharacterId: targetCharacterId },
                        { fromCharacterId: targetCharacterId, toCharacterId: characterId }
                    ]
                }
            });

            if (existingRequest) {
                this.logger.warn(`Friend request already pending between ${characterId} and ${targetCharacterId}`);
                return false;
            }

            // Create friend request
            await this.prisma.friendRequest.create({
                data: {
                    gameId: this.gameId,
                    fromCharacterId: characterId,
                    toCharacterId: targetCharacterId,
                    status: 'pending'
                }
            });

            // Emit event
            this.events.emit('friends:requestSent', {
                fromCharacterId: characterId,
                toCharacterId: targetCharacterId,
                gameId: this.gameId
            });

            return true;
        } catch (error) {
            this.logger.error(`Error sending friend request: ${error}`);
            return false;
        }
    }

    async acceptFriendRequest(characterId: string, requestId: string): Promise<boolean> {
        try {
            // Get request
            const request = await this.prisma.friendRequest.findFirst({
                where: {
                    id: requestId,
                    toCharacterId: characterId,
                    status: 'pending',
                    gameId: this.gameId
                }
            });

            if (!request) {
                this.logger.warn(`Friend request ${requestId} not found for character ${characterId}`);
                return false;
            }

            const fromCharacterId = request.fromCharacterId;
            const [id1, id2] = this.getOrderedIds(characterId, fromCharacterId);

            // Update request status and add friendship in transaction
            await this.prisma.$transaction([
                this.prisma.friendRequest.update({
                    where: { id: requestId },
                    data: { status: 'accepted' }
                }),
                this.prisma.friendship.create({
                    data: {
                        gameId: this.gameId,
                        characterId1: id1,
                        characterId2: id2
                    }
                })
            ]);

            // Emit event
            this.events.emit('friends:requestAccepted', {
                characterId,
                friendCharacterId: fromCharacterId,
                requestId,
                gameId: this.gameId
            });

            return true;
        } catch (error) {
            this.logger.error(`Error accepting friend request: ${error}`);
            return false;
        }
    }

    async rejectFriendRequest(characterId: string, requestId: string): Promise<boolean> {
        try {
            const result = await this.prisma.friendRequest.updateMany({
                where: {
                    id: requestId,
                    toCharacterId: characterId,
                    status: 'pending',
                    gameId: this.gameId
                },
                data: { status: 'rejected' }
            });

            if (result.count === 0) {
                this.logger.warn(`Friend request ${requestId} not found for character ${characterId}`);
                return false;
            }

            // Emit event
            this.events.emit('friends:requestRejected', {
                characterId,
                requestId,
                gameId: this.gameId
            });

            return true;
        } catch (error) {
            this.logger.error(`Error rejecting friend request: ${error}`);
            return false;
        }
    }

    async removeFriend(characterId: string, friendCharacterId: string): Promise<boolean> {
        try {
            const [id1, id2] = this.getOrderedIds(characterId, friendCharacterId);

            const result = await this.prisma.friendship.deleteMany({
                where: {
                    gameId: this.gameId,
                    characterId1: id1,
                    characterId2: id2
                }
            });

            if (result.count === 0) {
                this.logger.warn(`Friendship not found between ${characterId} and ${friendCharacterId}`);
                return false;
            }

            // Emit event
            this.events.emit('friends:removed', {
                characterId,
                friendCharacterId,
                gameId: this.gameId
            });

            return true;
        } catch (error) {
            this.logger.error(`Error removing friend: ${error}`);
            return false;
        }
    }

    async getFriends(characterId: string): Promise<{ online: Friend[], offline: Friend[] }> {
        try {
            // Get all friendships for this character
            const friendships = await this.prisma.friendship.findMany({
                where: {
                    gameId: this.gameId,
                    OR: [
                        { characterId1: characterId },
                        { characterId2: characterId }
                    ]
                }
            });

            const online: Friend[] = [];
            const offline: Friend[] = [];

            for (const friendship of friendships) {
                // Get the friend's ID (the one that isn't characterId)
                const friendId = friendship.characterId1 === characterId
                    ? friendship.characterId2
                    : friendship.characterId1;

                const isOnline = await this.isOnline(friendId);
                const characterName = await this.resolveCharacterName(friendId);

                const friend: Friend = {
                    characterId: friendId,
                    characterName,
                    isOnline,
                    friendSince: friendship.createdAt
                };

                if (isOnline) {
                    online.push(friend);
                } else {
                    offline.push(friend);
                }
            }

            return { online, offline };
        } catch (error) {
            this.logger.error(`Error getting friends: ${error}`);
            return { online: [], offline: [] };
        }
    }

    async getFriendRequests(characterId: string): Promise<FriendRequest[]> {
        try {
            const requests = await this.prisma.friendRequest.findMany({
                where: {
                    gameId: this.gameId,
                    toCharacterId: characterId,
                    status: 'pending'
                },
                orderBy: { createdAt: 'desc' }
            });

            const result: FriendRequest[] = [];

            for (const request of requests) {
                const fromCharacterName = await this.resolveCharacterName(request.fromCharacterId);

                result.push({
                    requestId: request.id,
                    fromCharacterId: request.fromCharacterId,
                    fromCharacterName,
                    toCharacterId: request.toCharacterId,
                    status: request.status as 'pending' | 'accepted' | 'rejected',
                    createdAt: request.createdAt
                });
            }

            return result;
        } catch (error) {
            this.logger.error(`Error getting friend requests: ${error}`);
            return [];
        }
    }

    async blockUser(characterId: string, targetCharacterId: string): Promise<boolean> {
        try {
            // Remove friendship if exists
            await this.removeFriend(characterId, targetCharacterId);

            // Add to blocked list (upsert to handle duplicates)
            await this.prisma.blockedUser.upsert({
                where: {
                    gameId_characterId_blockedCharacterId: {
                        gameId: this.gameId,
                        characterId: characterId,
                        blockedCharacterId: targetCharacterId
                    }
                },
                update: {},
                create: {
                    gameId: this.gameId,
                    characterId: characterId,
                    blockedCharacterId: targetCharacterId
                }
            });

            // Emit event
            this.events.emit('friends:userBlocked', {
                characterId,
                blockedCharacterId: targetCharacterId,
                gameId: this.gameId
            });

            return true;
        } catch (error) {
            this.logger.error(`Error blocking user: ${error}`);
            return false;
        }
    }

    async unblockUser(characterId: string, blockedCharacterId: string): Promise<boolean> {
        try {
            const result = await this.prisma.blockedUser.deleteMany({
                where: {
                    gameId: this.gameId,
                    characterId: characterId,
                    blockedCharacterId: blockedCharacterId
                }
            });

            if (result.count === 0) {
                this.logger.warn(`User ${blockedCharacterId} not blocked by ${characterId}`);
                return false;
            }

            // Emit event
            this.events.emit('friends:userUnblocked', {
                characterId,
                blockedCharacterId,
                gameId: this.gameId
            });

            return true;
        } catch (error) {
            this.logger.error(`Error unblocking user: ${error}`);
            return false;
        }
    }

    async isBlocked(characterId: string, targetCharacterId: string): Promise<boolean> {
        try {
            const blocked = await this.prisma.blockedUser.findFirst({
                where: {
                    gameId: this.gameId,
                    characterId: characterId,
                    blockedCharacterId: targetCharacterId
                }
            });

            return blocked !== null;
        } catch (error) {
            this.logger.error(`Error checking if blocked: ${error}`);
            return false;
        }
    }

    async isFriend(characterId: string, targetCharacterId: string): Promise<boolean> {
        try {
            const [id1, id2] = this.getOrderedIds(characterId, targetCharacterId);

            const friendship = await this.prisma.friendship.findFirst({
                where: {
                    gameId: this.gameId,
                    characterId1: id1,
                    characterId2: id2
                }
            });

            return friendship !== null;
        } catch (error) {
            this.logger.error(`Error checking if friend: ${error}`);
            return false;
        }
    }

    async isOnline(characterId: string): Promise<boolean> {
        try {
            // Use the online checker callback if provided
            if (this.onlineChecker) {
                return this.onlineChecker(characterId);
            }
            // Default: character is offline if no checker is set
            return false;
        } catch (error) {
            this.logger.error(`Error checking online status: ${error}`);
            return false;
        }
    }
}
