import { ModuleContext } from "../../../src/module/ModuleContext";

export interface Party {
    partyId: number;
    leaderId: number;
    leaderName: string;
    maxMembers: number;
    createdAt: Date;
}

export interface PartyMember {
    characterId: number;
    characterName: string;
    isLeader: boolean;
    joinedAt: Date;
    isOnline: boolean;
}

export interface PartyInvite {
    inviteId: number;
    partyId: number;
    characterId: number;
    invitedBy: number;
    invitedByName: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
}

export interface LootItem {
    itemId: string;
    quantity: number;
}

export interface PartyAPI {
    createParty(characterId: number): Promise<number | null>;
    disbandParty(characterId: number, partyId: number): Promise<boolean>;
    inviteToParty(characterId: number, partyId: number, targetCharacterId: number): Promise<boolean>;
    acceptPartyInvite(characterId: number, inviteId: number): Promise<boolean>;
    rejectPartyInvite(characterId: number, inviteId: number): Promise<boolean>;
    leaveParty(characterId: number, partyId: number): Promise<boolean>;
    kickFromParty(characterId: number, partyId: number, targetCharacterId: number): Promise<boolean>;
    transferLeadership(characterId: number, partyId: number, targetCharacterId: number): Promise<boolean>;
    getParty(partyId: number): Promise<Party | null>;
    getPartyMembers(partyId: number): Promise<PartyMember[]>;
    getCharacterParty(characterId: number): Promise<Party | null>;
    getPartyInvites(characterId: number): Promise<PartyInvite[]>;
    distributeXP(partyId: number, totalXP: number): Promise<void>;
    distributeLoot(partyId: number, items: LootItem[]): Promise<void>;
}

export class PartyManager {
    private context: ModuleContext;
    private gameId: string;
    private partiesTable: string;
    private membersTable: string;
    private invitesTable: string;
    private maxPartySize = 5;

    constructor(context: ModuleContext, gameId: string) {
        this.context = context;
        this.gameId = gameId;
        this.partiesTable = `${gameId}_parties`;
        this.membersTable = `${gameId}_party_members`;
        this.invitesTable = `${gameId}_party_invites`;
    }

    getAPI(): PartyAPI {
        return {
            createParty: this.createParty.bind(this),
            disbandParty: this.disbandParty.bind(this),
            inviteToParty: this.inviteToParty.bind(this),
            acceptPartyInvite: this.acceptPartyInvite.bind(this),
            rejectPartyInvite: this.rejectPartyInvite.bind(this),
            leaveParty: this.leaveParty.bind(this),
            kickFromParty: this.kickFromParty.bind(this),
            transferLeadership: this.transferLeadership.bind(this),
            getParty: this.getParty.bind(this),
            getPartyMembers: this.getPartyMembers.bind(this),
            getCharacterParty: this.getCharacterParty.bind(this),
            getPartyInvites: this.getPartyInvites.bind(this),
            distributeXP: this.distributeXP.bind(this),
            distributeLoot: this.distributeLoot.bind(this)
        };
    }

    async createParty(characterId: number): Promise<number | null> {
        try {
            // Check if character is already in a party
            const existingParty = await this.getCharacterParty(characterId);
            if (existingParty) {
                this.context.logger.warn(`Character ${characterId} is already in party ${existingParty.partyId}`);
                return null;
            }

            // Create party
            const result = await this.context.db.query(
                `INSERT INTO ${this.partiesTable} (leader_id, created_at)
                 VALUES (?, NOW())`,
                [characterId]
            ) as any;

            const partyId = result[0].insertId;

            // Add creator as party member
            await this.context.db.query(
                `INSERT INTO ${this.membersTable} (party_id, character_id, joined_at)
                 VALUES (?, ?, NOW())`,
                [partyId, characterId]
            );

            // Emit event
            this.context.events.emit('parties:created', {
                partyId,
                leaderId: characterId
            });

            return partyId;
        } catch (error) {
            this.context.logger.error(`Error creating party: ${error}`);
            return null;
        }
    }

    async disbandParty(characterId: number, partyId: number): Promise<boolean> {
        try {
            // Check if character is party leader
            const party = await this.getParty(partyId);
            if (!party || party.leaderId !== characterId) {
                this.context.logger.warn(`Character ${characterId} is not party leader of ${partyId}`);
                return false;
            }

            // Delete party (cascade will delete members and invites)
            await this.context.db.query(
                `DELETE FROM ${this.partiesTable} WHERE id = ?`,
                [partyId]
            );

            // Emit event
            this.context.events.emit('parties:disbanded', {
                partyId,
                leaderId: characterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error disbanding party: ${error}`);
            return false;
        }
    }

    async inviteToParty(characterId: number, partyId: number, targetCharacterId: number): Promise<boolean> {
        try {
            // Check if inviter is party leader
            const party = await this.getParty(partyId);
            if (!party || party.leaderId !== characterId) {
                this.context.logger.warn(`Character ${characterId} is not party leader`);
                return false;
            }

            // Check if target is already in a party
            const targetParty = await this.getCharacterParty(targetCharacterId);
            if (targetParty) {
                this.context.logger.warn(`Target ${targetCharacterId} is already in party ${targetParty.partyId}`);
                return false;
            }

            // Check if party is full
            const members = await this.getPartyMembers(partyId);
            if (members.length >= this.maxPartySize) {
                this.context.logger.warn(`Party ${partyId} is full`);
                return false;
            }

            // Check if target already has pending invite
            const [existingRows] = await this.context.db.query(
                `SELECT id FROM ${this.invitesTable}
                 WHERE party_id = ? AND character_id = ? AND status = 'pending'`,
                [partyId, targetCharacterId]
            ) as any;

            if (existingRows.length > 0) {
                this.context.logger.warn(`Target ${targetCharacterId} already has pending invite`);
                return false;
            }

            // Create invite
            await this.context.db.query(
                `INSERT INTO ${this.invitesTable} (party_id, character_id, invited_by, status, created_at)
                 VALUES (?, ?, ?, 'pending', NOW())`,
                [partyId, targetCharacterId, characterId]
            );

            // Emit event
            this.context.events.emit('parties:inviteSent', {
                partyId,
                targetCharacterId,
                invitedBy: characterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error inviting to party: ${error}`);
            return false;
        }
    }

    async acceptPartyInvite(characterId: number, inviteId: number): Promise<boolean> {
        try {
            // Get invite
            const [rows] = await this.context.db.query(
                `SELECT * FROM ${this.invitesTable}
                 WHERE id = ? AND character_id = ? AND status = 'pending'`,
                [inviteId, characterId]
            ) as any;

            if (rows.length === 0) {
                this.context.logger.warn(`Invite ${inviteId} not found for character ${characterId}`);
                return false;
            }

            const invite = rows[0];
            const partyId = invite.party_id;

            // Check if character is already in a party
            const existingParty = await this.getCharacterParty(characterId);
            if (existingParty) {
                this.context.logger.warn(`Character ${characterId} is already in party ${existingParty.partyId}`);
                return false;
            }

            // Check if party is full
            const members = await this.getPartyMembers(partyId);
            if (members.length >= this.maxPartySize) {
                this.context.logger.warn(`Party ${partyId} is full`);
                return false;
            }

            // Update invite status
            await this.context.db.query(
                `UPDATE ${this.invitesTable} SET status = 'accepted' WHERE id = ?`,
                [inviteId]
            );

            // Add member to party
            await this.context.db.query(
                `INSERT INTO ${this.membersTable} (party_id, character_id, joined_at)
                 VALUES (?, ?, NOW())`,
                [partyId, characterId]
            );

            // Emit event
            this.context.events.emit('parties:memberJoined', {
                partyId,
                characterId,
                inviteId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error accepting party invite: ${error}`);
            return false;
        }
    }

    async rejectPartyInvite(characterId: number, inviteId: number): Promise<boolean> {
        try {
            const result = await this.context.db.query(
                `UPDATE ${this.invitesTable} SET status = 'rejected'
                 WHERE id = ? AND character_id = ? AND status = 'pending'`,
                [inviteId, characterId]
            ) as any;

            if (result[0].affectedRows === 0) {
                this.context.logger.warn(`Invite ${inviteId} not found for character ${characterId}`);
                return false;
            }

            return true;
        } catch (error) {
            this.context.logger.error(`Error rejecting party invite: ${error}`);
            return false;
        }
    }

    async leaveParty(characterId: number, partyId: number): Promise<boolean> {
        try {
            const party = await this.getParty(partyId);
            if (!party) {
                return false;
            }

            // If leader leaves, transfer leadership or disband if solo
            if (party.leaderId === characterId) {
                const members = await this.getPartyMembers(partyId);
                if (members.length === 1) {
                    // Solo party, just disband
                    await this.disbandParty(characterId, partyId);
                    return true;
                } else {
                    // Transfer leadership to next member
                    const nextLeader = members.find(m => m.characterId !== characterId);
                    if (nextLeader) {
                        await this.context.db.query(
                            `UPDATE ${this.partiesTable} SET leader_id = ? WHERE id = ?`,
                            [nextLeader.characterId, partyId]
                        );

                        // Emit leadership transfer event
                        this.context.events.emit('parties:leadershipTransferred', {
                            partyId,
                            oldLeaderId: characterId,
                            newLeaderId: nextLeader.characterId
                        });
                    }
                }
            }

            // Remove member
            const result = await this.context.db.query(
                `DELETE FROM ${this.membersTable}
                 WHERE party_id = ? AND character_id = ?`,
                [partyId, characterId]
            ) as any;

            if (result[0].affectedRows === 0) {
                this.context.logger.warn(`Character ${characterId} not in party ${partyId}`);
                return false;
            }

            // Emit event
            this.context.events.emit('parties:memberLeft', {
                partyId,
                characterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error leaving party: ${error}`);
            return false;
        }
    }

    async kickFromParty(characterId: number, partyId: number, targetCharacterId: number): Promise<boolean> {
        try {
            // Check if kicker is party leader
            const party = await this.getParty(partyId);
            if (!party || party.leaderId !== characterId) {
                this.context.logger.warn(`Character ${characterId} is not party leader`);
                return false;
            }

            // Cannot kick self
            if (characterId === targetCharacterId) {
                this.context.logger.warn(`Cannot kick self from party`);
                return false;
            }

            // Remove member
            await this.context.db.query(
                `DELETE FROM ${this.membersTable}
                 WHERE party_id = ? AND character_id = ?`,
                [partyId, targetCharacterId]
            );

            // Emit event
            this.context.events.emit('parties:memberKicked', {
                partyId,
                characterId: targetCharacterId,
                kickedBy: characterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error kicking from party: ${error}`);
            return false;
        }
    }

    async transferLeadership(characterId: number, partyId: number, targetCharacterId: number): Promise<boolean> {
        try {
            // Check if current leader
            const party = await this.getParty(partyId);
            if (!party || party.leaderId !== characterId) {
                this.context.logger.warn(`Character ${characterId} is not party leader`);
                return false;
            }

            // Check if target is in party
            const members = await this.getPartyMembers(partyId);
            if (!members.find(m => m.characterId === targetCharacterId)) {
                this.context.logger.warn(`Target ${targetCharacterId} not in party ${partyId}`);
                return false;
            }

            // Update party leader
            await this.context.db.query(
                `UPDATE ${this.partiesTable} SET leader_id = ? WHERE id = ?`,
                [targetCharacterId, partyId]
            );

            // Emit event
            this.context.events.emit('parties:leadershipTransferred', {
                partyId,
                oldLeaderId: characterId,
                newLeaderId: targetCharacterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error transferring leadership: ${error}`);
            return false;
        }
    }

    async getParty(partyId: number): Promise<Party | null> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT p.*, c.name as leader_name
                 FROM ${this.partiesTable} p
                 JOIN characters c ON c.id = p.leader_id
                 WHERE p.id = ?`,
                [partyId]
            ) as any;

            if (rows.length === 0) {
                return null;
            }

            const party = rows[0];
            return {
                partyId: party.id,
                leaderId: party.leader_id,
                leaderName: party.leader_name,
                maxMembers: this.maxPartySize,
                createdAt: party.created_at
            };
        } catch (error) {
            this.context.logger.error(`Error getting party: ${error}`);
            return null;
        }
    }

    async getPartyMembers(partyId: number): Promise<PartyMember[]> {
        try {
            const party = await this.getParty(partyId);
            if (!party) {
                return [];
            }

            const [rows] = await this.context.db.query(
                `SELECT m.character_id, m.joined_at, c.name as character_name
                 FROM ${this.membersTable} m
                 JOIN characters c ON c.id = m.character_id
                 WHERE m.party_id = ?
                 ORDER BY m.joined_at ASC`,
                [partyId]
            ) as any;

            const members: PartyMember[] = [];

            for (const row of rows) {
                // Check online status via event hook
                const results = await this.context.events.emitAsync('parties:checkOnlineStatus', row.character_id);
                const isOnline = results && results.some((result: any) => result === true);

                members.push({
                    characterId: row.character_id,
                    characterName: row.character_name,
                    isLeader: row.character_id === party.leaderId,
                    joinedAt: row.joined_at,
                    isOnline
                });
            }

            return members;
        } catch (error) {
            this.context.logger.error(`Error getting party members: ${error}`);
            return [];
        }
    }

    async getCharacterParty(characterId: number): Promise<Party | null> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT party_id FROM ${this.membersTable} WHERE character_id = ?`,
                [characterId]
            ) as any;

            if (rows.length === 0) {
                return null;
            }

            return await this.getParty(rows[0].party_id);
        } catch (error) {
            this.context.logger.error(`Error getting character party: ${error}`);
            return null;
        }
    }

    async getPartyInvites(characterId: number): Promise<PartyInvite[]> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT i.id, i.party_id, i.character_id, i.invited_by, i.status, i.created_at,
                        c.name as invited_by_name
                 FROM ${this.invitesTable} i
                 JOIN characters c ON c.id = i.invited_by
                 WHERE i.character_id = ? AND i.status = 'pending'
                 ORDER BY i.created_at DESC`,
                [characterId]
            ) as any;

            return rows.map((row: any) => ({
                inviteId: row.id,
                partyId: row.party_id,
                characterId: row.character_id,
                invitedBy: row.invited_by,
                invitedByName: row.invited_by_name,
                status: row.status,
                createdAt: row.created_at
            }));
        } catch (error) {
            this.context.logger.error(`Error getting party invites: ${error}`);
            return [];
        }
    }

    async distributeXP(partyId: number, totalXP: number): Promise<void> {
        try {
            const members = await this.getPartyMembers(partyId);
            if (members.length === 0) {
                return;
            }

            const xpPerMember = Math.floor(totalXP / members.length);

            // Emit event for each member to receive XP
            for (const member of members) {
                this.context.events.emit('parties:xpDistributed', {
                    partyId,
                    characterId: member.characterId,
                    xp: xpPerMember,
                    totalXP
                });
            }
        } catch (error) {
            this.context.logger.error(`Error distributing XP: ${error}`);
        }
    }

    async distributeLoot(partyId: number, items: LootItem[]): Promise<void> {
        try {
            const members = await this.getPartyMembers(partyId);
            if (members.length === 0) {
                return;
            }

            // Simple round-robin distribution
            let memberIndex = 0;
            for (const item of items) {
                const recipient = members[memberIndex % members.length];

                // Emit event for loot distribution
                this.context.events.emit('parties:lootDistributed', {
                    partyId,
                    characterId: recipient.characterId,
                    itemId: item.itemId,
                    quantity: item.quantity
                });

                memberIndex++;
            }
        } catch (error) {
            this.context.logger.error(`Error distributing loot: ${error}`);
        }
    }
}
