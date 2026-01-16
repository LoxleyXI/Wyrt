import { PrismaClient, Party as PrismaParty, PartyMember as PrismaMember, PartyInvite as PrismaInvite } from "@prisma/client";
import { EventEmitter } from "../../../src/events/EventEmitter";

export interface Party {
    id: string;
    leaderId: string;
    leaderName?: string;
    lootMode: string;
    maxMembers: number;
    createdAt: Date;
}

export interface PartyMember {
    id: string;
    characterId: string;
    characterName?: string;
    isLeader: boolean;
    joinedAt: Date;
    isOnline?: boolean;
}

export interface PartyInvite {
    id: string;
    partyId: string;
    characterId: string;
    invitedBy: string;
    invitedByName?: string;
    status: string;
    expiresAt: Date;
    createdAt: Date;
}

export interface LootItem {
    itemId: string;
    quantity: number;
}

export interface PartyAPI {
    createParty(characterId: string): Promise<Party | null>;
    disbandParty(characterId: string): Promise<boolean>;
    inviteToParty(characterId: string, targetCharacterId: string): Promise<boolean>;
    acceptPartyInvite(characterId: string, inviteId: string): Promise<boolean>;
    declinePartyInvite(characterId: string, inviteId: string): Promise<boolean>;
    leaveParty(characterId: string): Promise<boolean>;
    kickFromParty(characterId: string, targetCharacterId: string): Promise<boolean>;
    transferLeadership(characterId: string, targetCharacterId: string): Promise<boolean>;
    getParty(partyId: string): Promise<Party | null>;
    getPartyMembers(partyId: string): Promise<PartyMember[]>;
    getCharacterParty(characterId: string): Promise<Party | null>;
    getPartyInvites(characterId: string): Promise<PartyInvite[]>;
    distributeXP(partyId: string, totalXP: number): Promise<void>;
    distributeLoot(partyId: string, items: LootItem[]): Promise<void>;
    setLootMode(characterId: string, mode: string): Promise<boolean>;
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

export class PartyManager {
    private prisma: PrismaClient;
    private events: EventEmitter;
    private logger: Logger;
    private gameId: string;
    private maxPartySize = 5;
    private inviteExpirationMinutes = 5;
    private characterNameResolver?: CharacterNameResolver;

    constructor(
        prisma: PrismaClient,
        events: EventEmitter,
        logger: Logger,
        gameId: string,
        options?: {
            maxPartySize?: number;
            inviteExpirationMinutes?: number;
            characterNameResolver?: CharacterNameResolver;
        }
    ) {
        this.prisma = prisma;
        this.events = events;
        this.logger = logger;
        this.gameId = gameId;

        if (options?.maxPartySize) {
            this.maxPartySize = options.maxPartySize;
        }
        if (options?.inviteExpirationMinutes) {
            this.inviteExpirationMinutes = options.inviteExpirationMinutes;
        }
        if (options?.characterNameResolver) {
            this.characterNameResolver = options.characterNameResolver;
        }
    }

    getAPI(): PartyAPI {
        return {
            createParty: this.createParty.bind(this),
            disbandParty: this.disbandParty.bind(this),
            inviteToParty: this.inviteToParty.bind(this),
            acceptPartyInvite: this.acceptPartyInvite.bind(this),
            declinePartyInvite: this.declinePartyInvite.bind(this),
            leaveParty: this.leaveParty.bind(this),
            kickFromParty: this.kickFromParty.bind(this),
            transferLeadership: this.transferLeadership.bind(this),
            getParty: this.getParty.bind(this),
            getPartyMembers: this.getPartyMembers.bind(this),
            getCharacterParty: this.getCharacterParty.bind(this),
            getPartyInvites: this.getPartyInvites.bind(this),
            distributeXP: this.distributeXP.bind(this),
            distributeLoot: this.distributeLoot.bind(this),
            setLootMode: this.setLootMode.bind(this)
        };
    }

    private async resolveCharacterName(characterId: string): Promise<string | undefined> {
        if (this.characterNameResolver) {
            return this.characterNameResolver(characterId);
        }
        return undefined;
    }

    async createParty(characterId: string): Promise<Party | null> {
        try {
            // Check if character is already in a party
            const existingParty = await this.getCharacterParty(characterId);
            if (existingParty) {
                this.logger.warn(`Character ${characterId} is already in party ${existingParty.id}`);
                return null;
            }

            // Create party with leader as first member
            const party = await this.prisma.party.create({
                data: {
                    gameId: this.gameId,
                    leaderId: characterId,
                    lootMode: 'ffa',
                    members: {
                        create: {
                            characterId: characterId
                        }
                    }
                },
                include: {
                    members: true
                }
            });

            // Emit event
            this.events.emit('parties:created', {
                partyId: party.id,
                leaderId: characterId,
                gameId: this.gameId
            });

            const leaderName = await this.resolveCharacterName(characterId);

            return {
                id: party.id,
                leaderId: party.leaderId,
                leaderName,
                lootMode: party.lootMode,
                maxMembers: this.maxPartySize,
                createdAt: party.createdAt
            };
        } catch (error) {
            this.logger.error(`Error creating party: ${error}`);
            return null;
        }
    }

    async disbandParty(characterId: string): Promise<boolean> {
        try {
            // Get character's party
            const party = await this.getCharacterParty(characterId);
            if (!party) {
                this.logger.warn(`Character ${characterId} is not in a party`);
                return false;
            }

            // Check if character is party leader
            if (party.leaderId !== characterId) {
                this.logger.warn(`Character ${characterId} is not party leader of ${party.id}`);
                return false;
            }

            // Delete party (cascade will delete members and invites)
            await this.prisma.party.delete({
                where: { id: party.id }
            });

            // Emit event
            this.events.emit('parties:disbanded', {
                partyId: party.id,
                leaderId: characterId,
                gameId: this.gameId
            });

            return true;
        } catch (error) {
            this.logger.error(`Error disbanding party: ${error}`);
            return false;
        }
    }

    async inviteToParty(characterId: string, targetCharacterId: string): Promise<boolean> {
        try {
            // Get inviter's party
            const party = await this.getCharacterParty(characterId);
            if (!party) {
                this.logger.warn(`Character ${characterId} is not in a party`);
                return false;
            }

            // Check if inviter is party leader
            if (party.leaderId !== characterId) {
                this.logger.warn(`Character ${characterId} is not party leader`);
                return false;
            }

            // Check if target is already in a party
            const targetParty = await this.getCharacterParty(targetCharacterId);
            if (targetParty) {
                this.logger.warn(`Target ${targetCharacterId} is already in party ${targetParty.id}`);
                return false;
            }

            // Check if party is full
            const members = await this.getPartyMembers(party.id);
            if (members.length >= this.maxPartySize) {
                this.logger.warn(`Party ${party.id} is full`);
                return false;
            }

            // Check if target already has pending invite from this party
            const existingInvite = await this.prisma.partyInvite.findFirst({
                where: {
                    partyId: party.id,
                    characterId: targetCharacterId,
                    status: 'pending'
                }
            });

            if (existingInvite) {
                this.logger.warn(`Target ${targetCharacterId} already has pending invite`);
                return false;
            }

            // Create invite
            const expiresAt = new Date(Date.now() + this.inviteExpirationMinutes * 60 * 1000);

            await this.prisma.partyInvite.create({
                data: {
                    partyId: party.id,
                    characterId: targetCharacterId,
                    invitedBy: characterId,
                    status: 'pending',
                    expiresAt
                }
            });

            // Emit event
            this.events.emit('parties:inviteSent', {
                partyId: party.id,
                targetCharacterId,
                invitedBy: characterId,
                gameId: this.gameId
            });

            return true;
        } catch (error) {
            this.logger.error(`Error inviting to party: ${error}`);
            return false;
        }
    }

    async acceptPartyInvite(characterId: string, inviteId: string): Promise<boolean> {
        try {
            // Get invite
            const invite = await this.prisma.partyInvite.findFirst({
                where: {
                    id: inviteId,
                    characterId: characterId,
                    status: 'pending'
                },
                include: {
                    party: true
                }
            });

            if (!invite) {
                this.logger.warn(`Invite ${inviteId} not found for character ${characterId}`);
                return false;
            }

            // Check if invite is expired
            if (invite.expiresAt < new Date()) {
                await this.prisma.partyInvite.update({
                    where: { id: inviteId },
                    data: { status: 'expired' }
                });
                this.logger.warn(`Invite ${inviteId} has expired`);
                return false;
            }

            // Check if character is already in a party
            const existingParty = await this.getCharacterParty(characterId);
            if (existingParty) {
                this.logger.warn(`Character ${characterId} is already in party ${existingParty.id}`);
                return false;
            }

            // Check if party is full
            const members = await this.getPartyMembers(invite.partyId);
            if (members.length >= this.maxPartySize) {
                this.logger.warn(`Party ${invite.partyId} is full`);
                return false;
            }

            // Update invite status and add member in transaction
            await this.prisma.$transaction([
                this.prisma.partyInvite.update({
                    where: { id: inviteId },
                    data: { status: 'accepted' }
                }),
                this.prisma.partyMember.create({
                    data: {
                        partyId: invite.partyId,
                        characterId: characterId
                    }
                })
            ]);

            // Emit event
            this.events.emit('parties:memberJoined', {
                partyId: invite.partyId,
                characterId,
                inviteId,
                gameId: this.gameId
            });

            return true;
        } catch (error) {
            this.logger.error(`Error accepting party invite: ${error}`);
            return false;
        }
    }

    async declinePartyInvite(characterId: string, inviteId: string): Promise<boolean> {
        try {
            const result = await this.prisma.partyInvite.updateMany({
                where: {
                    id: inviteId,
                    characterId: characterId,
                    status: 'pending'
                },
                data: { status: 'declined' }
            });

            if (result.count === 0) {
                this.logger.warn(`Invite ${inviteId} not found for character ${characterId}`);
                return false;
            }

            return true;
        } catch (error) {
            this.logger.error(`Error declining party invite: ${error}`);
            return false;
        }
    }

    async leaveParty(characterId: string): Promise<boolean> {
        try {
            const party = await this.getCharacterParty(characterId);
            if (!party) {
                this.logger.warn(`Character ${characterId} is not in a party`);
                return false;
            }

            // If leader leaves, transfer leadership or disband if solo
            if (party.leaderId === characterId) {
                const members = await this.getPartyMembers(party.id);
                if (members.length === 1) {
                    // Solo party, just disband
                    return await this.disbandParty(characterId);
                } else {
                    // Transfer leadership to next member
                    const nextLeader = members.find(m => m.characterId !== characterId);
                    if (nextLeader) {
                        await this.prisma.party.update({
                            where: { id: party.id },
                            data: { leaderId: nextLeader.characterId }
                        });

                        // Emit leadership transfer event
                        this.events.emit('parties:leadershipTransferred', {
                            partyId: party.id,
                            oldLeaderId: characterId,
                            newLeaderId: nextLeader.characterId,
                            gameId: this.gameId
                        });
                    }
                }
            }

            // Remove member
            const result = await this.prisma.partyMember.deleteMany({
                where: {
                    partyId: party.id,
                    characterId: characterId
                }
            });

            if (result.count === 0) {
                this.logger.warn(`Character ${characterId} not in party ${party.id}`);
                return false;
            }

            // Emit event
            this.events.emit('parties:memberLeft', {
                partyId: party.id,
                characterId,
                gameId: this.gameId
            });

            return true;
        } catch (error) {
            this.logger.error(`Error leaving party: ${error}`);
            return false;
        }
    }

    async kickFromParty(characterId: string, targetCharacterId: string): Promise<boolean> {
        try {
            // Get kicker's party
            const party = await this.getCharacterParty(characterId);
            if (!party) {
                this.logger.warn(`Character ${characterId} is not in a party`);
                return false;
            }

            // Check if kicker is party leader
            if (party.leaderId !== characterId) {
                this.logger.warn(`Character ${characterId} is not party leader`);
                return false;
            }

            // Cannot kick self
            if (characterId === targetCharacterId) {
                this.logger.warn(`Cannot kick self from party`);
                return false;
            }

            // Remove member
            const result = await this.prisma.partyMember.deleteMany({
                where: {
                    partyId: party.id,
                    characterId: targetCharacterId
                }
            });

            if (result.count === 0) {
                this.logger.warn(`Target ${targetCharacterId} not in party ${party.id}`);
                return false;
            }

            // Emit event
            this.events.emit('parties:memberKicked', {
                partyId: party.id,
                characterId: targetCharacterId,
                kickedBy: characterId,
                gameId: this.gameId
            });

            return true;
        } catch (error) {
            this.logger.error(`Error kicking from party: ${error}`);
            return false;
        }
    }

    async transferLeadership(characterId: string, targetCharacterId: string): Promise<boolean> {
        try {
            // Get current leader's party
            const party = await this.getCharacterParty(characterId);
            if (!party) {
                this.logger.warn(`Character ${characterId} is not in a party`);
                return false;
            }

            // Check if current leader
            if (party.leaderId !== characterId) {
                this.logger.warn(`Character ${characterId} is not party leader`);
                return false;
            }

            // Check if target is in party
            const members = await this.getPartyMembers(party.id);
            if (!members.find(m => m.characterId === targetCharacterId)) {
                this.logger.warn(`Target ${targetCharacterId} not in party ${party.id}`);
                return false;
            }

            // Update party leader
            await this.prisma.party.update({
                where: { id: party.id },
                data: { leaderId: targetCharacterId }
            });

            // Emit event
            this.events.emit('parties:leadershipTransferred', {
                partyId: party.id,
                oldLeaderId: characterId,
                newLeaderId: targetCharacterId,
                gameId: this.gameId
            });

            return true;
        } catch (error) {
            this.logger.error(`Error transferring leadership: ${error}`);
            return false;
        }
    }

    async setLootMode(characterId: string, mode: string): Promise<boolean> {
        const validModes = ['ffa', 'round-robin', 'need-greed'];
        if (!validModes.includes(mode)) {
            this.logger.warn(`Invalid loot mode: ${mode}`);
            return false;
        }

        try {
            const party = await this.getCharacterParty(characterId);
            if (!party) {
                this.logger.warn(`Character ${characterId} is not in a party`);
                return false;
            }

            if (party.leaderId !== characterId) {
                this.logger.warn(`Character ${characterId} is not party leader`);
                return false;
            }

            await this.prisma.party.update({
                where: { id: party.id },
                data: { lootMode: mode }
            });

            this.events.emit('parties:lootModeChanged', {
                partyId: party.id,
                mode,
                changedBy: characterId,
                gameId: this.gameId
            });

            return true;
        } catch (error) {
            this.logger.error(`Error setting loot mode: ${error}`);
            return false;
        }
    }

    async getParty(partyId: string): Promise<Party | null> {
        try {
            const party = await this.prisma.party.findUnique({
                where: { id: partyId }
            });

            if (!party || party.gameId !== this.gameId) {
                return null;
            }

            const leaderName = await this.resolveCharacterName(party.leaderId);

            return {
                id: party.id,
                leaderId: party.leaderId,
                leaderName,
                lootMode: party.lootMode,
                maxMembers: this.maxPartySize,
                createdAt: party.createdAt
            };
        } catch (error) {
            this.logger.error(`Error getting party: ${error}`);
            return null;
        }
    }

    async getPartyMembers(partyId: string): Promise<PartyMember[]> {
        try {
            const party = await this.getParty(partyId);
            if (!party) {
                return [];
            }

            const members = await this.prisma.partyMember.findMany({
                where: { partyId },
                orderBy: { joinedAt: 'asc' }
            });

            const result: PartyMember[] = [];

            for (const member of members) {
                // Check online status via event hook
                const onlineResults = await this.events.emitAsync('parties:checkOnlineStatus', member.characterId);
                const isOnline = onlineResults && onlineResults.some((r: any) => r === true);

                const characterName = await this.resolveCharacterName(member.characterId);

                result.push({
                    id: member.id,
                    characterId: member.characterId,
                    characterName,
                    isLeader: member.characterId === party.leaderId,
                    joinedAt: member.joinedAt,
                    isOnline
                });
            }

            return result;
        } catch (error) {
            this.logger.error(`Error getting party members: ${error}`);
            return [];
        }
    }

    async getCharacterParty(characterId: string): Promise<Party | null> {
        try {
            const membership = await this.prisma.partyMember.findFirst({
                where: { characterId },
                include: { party: true }
            });

            if (!membership || membership.party.gameId !== this.gameId) {
                return null;
            }

            const leaderName = await this.resolveCharacterName(membership.party.leaderId);

            return {
                id: membership.party.id,
                leaderId: membership.party.leaderId,
                leaderName,
                lootMode: membership.party.lootMode,
                maxMembers: this.maxPartySize,
                createdAt: membership.party.createdAt
            };
        } catch (error) {
            this.logger.error(`Error getting character party: ${error}`);
            return null;
        }
    }

    async getPartyInvites(characterId: string): Promise<PartyInvite[]> {
        try {
            // Clean up expired invites first
            await this.prisma.partyInvite.updateMany({
                where: {
                    characterId,
                    status: 'pending',
                    expiresAt: { lt: new Date() }
                },
                data: { status: 'expired' }
            });

            const invites = await this.prisma.partyInvite.findMany({
                where: {
                    characterId,
                    status: 'pending',
                    party: { gameId: this.gameId }
                },
                orderBy: { createdAt: 'desc' }
            });

            const result: PartyInvite[] = [];

            for (const invite of invites) {
                const invitedByName = await this.resolveCharacterName(invite.invitedBy);

                result.push({
                    id: invite.id,
                    partyId: invite.partyId,
                    characterId: invite.characterId,
                    invitedBy: invite.invitedBy,
                    invitedByName,
                    status: invite.status,
                    expiresAt: invite.expiresAt,
                    createdAt: invite.createdAt
                });
            }

            return result;
        } catch (error) {
            this.logger.error(`Error getting party invites: ${error}`);
            return [];
        }
    }

    async distributeXP(partyId: string, totalXP: number): Promise<void> {
        try {
            const members = await this.getPartyMembers(partyId);
            if (members.length === 0) {
                return;
            }

            const xpPerMember = Math.floor(totalXP / members.length);

            // Emit event for each member to receive XP
            for (const member of members) {
                this.events.emit('parties:xpDistributed', {
                    partyId,
                    characterId: member.characterId,
                    xp: xpPerMember,
                    totalXP,
                    gameId: this.gameId
                });
            }
        } catch (error) {
            this.logger.error(`Error distributing XP: ${error}`);
        }
    }

    async distributeLoot(partyId: string, items: LootItem[]): Promise<void> {
        try {
            const party = await this.getParty(partyId);
            if (!party) {
                return;
            }

            const members = await this.getPartyMembers(partyId);
            if (members.length === 0) {
                return;
            }

            // Distribution based on loot mode
            if (party.lootMode === 'ffa') {
                // Free-for-all: emit loot available event, first to pick gets it
                for (const item of items) {
                    this.events.emit('parties:lootAvailable', {
                        partyId,
                        itemId: item.itemId,
                        quantity: item.quantity,
                        gameId: this.gameId
                    });
                }
            } else if (party.lootMode === 'round-robin') {
                // Round-robin distribution
                let memberIndex = 0;
                for (const item of items) {
                    const recipient = members[memberIndex % members.length];

                    this.events.emit('parties:lootDistributed', {
                        partyId,
                        characterId: recipient.characterId,
                        itemId: item.itemId,
                        quantity: item.quantity,
                        gameId: this.gameId
                    });

                    memberIndex++;
                }
            } else if (party.lootMode === 'need-greed') {
                // Need/greed: emit event for roll system
                for (const item of items) {
                    this.events.emit('parties:lootNeedGreed', {
                        partyId,
                        itemId: item.itemId,
                        quantity: item.quantity,
                        members: members.map(m => m.characterId),
                        gameId: this.gameId
                    });
                }
            }
        } catch (error) {
            this.logger.error(`Error distributing loot: ${error}`);
        }
    }
}
