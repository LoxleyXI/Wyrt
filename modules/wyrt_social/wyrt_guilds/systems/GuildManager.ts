import { ModuleContext } from "../../../src/module/ModuleContext";

export type GuildRank = 'leader' | 'officer' | 'member';

export interface Guild {
    guildId: number;
    name: string;
    leaderId: number;
    leaderName: string;
    level: number;
    xp: number;
    maxMembers: number;
    createdAt: Date;
}

export interface GuildMember {
    characterId: number;
    characterName: string;
    rank: GuildRank;
    joinedAt: Date;
    isOnline: boolean;
}

export interface GuildInvite {
    inviteId: number;
    guildId: number;
    guildName: string;
    characterId: number;
    invitedBy: number;
    invitedByName: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
}

export interface GuildAPI {
    createGuild(characterId: number, guildName: string): Promise<number | null>;
    deleteGuild(characterId: number, guildId: number): Promise<boolean>;
    inviteToGuild(characterId: number, guildId: number, targetCharacterId: number): Promise<boolean>;
    acceptGuildInvite(characterId: number, inviteId: number): Promise<boolean>;
    rejectGuildInvite(characterId: number, inviteId: number): Promise<boolean>;
    leaveGuild(characterId: number, guildId: number): Promise<boolean>;
    kickMember(characterId: number, guildId: number, targetCharacterId: number): Promise<boolean>;
    promoteToOfficer(characterId: number, guildId: number, targetCharacterId: number): Promise<boolean>;
    demoteToMember(characterId: number, guildId: number, targetCharacterId: number): Promise<boolean>;
    transferLeadership(characterId: number, guildId: number, targetCharacterId: number): Promise<boolean>;
    getGuild(guildId: number): Promise<Guild | null>;
    getGuildMembers(guildId: number): Promise<GuildMember[]>;
    getCharacterGuild(characterId: number): Promise<Guild | null>;
    getGuildInvites(characterId: number): Promise<GuildInvite[]>;
    addGuildXP(guildId: number, xp: number): Promise<void>;
    getMemberRank(characterId: number, guildId: number): Promise<GuildRank | null>;
}

export class GuildManager {
    private context: ModuleContext;
    private gameId: string;
    private guildsTable: string;
    private membersTable: string;
    private invitesTable: string;
    private maxGuildNameLength = 32;
    private minGuildNameLength = 3;
    private baseMaxMembers = 50;
    private xpPerLevel = 1000;

    constructor(context: ModuleContext, gameId: string) {
        this.context = context;
        this.gameId = gameId;
        this.guildsTable = `${gameId}_guilds`;
        this.membersTable = `${gameId}_guild_members`;
        this.invitesTable = `${gameId}_guild_invites`;
    }

    getAPI(): GuildAPI {
        return {
            createGuild: this.createGuild.bind(this),
            deleteGuild: this.deleteGuild.bind(this),
            inviteToGuild: this.inviteToGuild.bind(this),
            acceptGuildInvite: this.acceptGuildInvite.bind(this),
            rejectGuildInvite: this.rejectGuildInvite.bind(this),
            leaveGuild: this.leaveGuild.bind(this),
            kickMember: this.kickMember.bind(this),
            promoteToOfficer: this.promoteToOfficer.bind(this),
            demoteToMember: this.demoteToMember.bind(this),
            transferLeadership: this.transferLeadership.bind(this),
            getGuild: this.getGuild.bind(this),
            getGuildMembers: this.getGuildMembers.bind(this),
            getCharacterGuild: this.getCharacterGuild.bind(this),
            getGuildInvites: this.getGuildInvites.bind(this),
            addGuildXP: this.addGuildXP.bind(this),
            getMemberRank: this.getMemberRank.bind(this)
        };
    }

    async createGuild(characterId: number, guildName: string): Promise<number | null> {
        try {
            // Validate guild name
            if (guildName.length < this.minGuildNameLength || guildName.length > this.maxGuildNameLength) {
                this.context.logger.warn(`Invalid guild name length: ${guildName.length}`);
                return null;
            }

            // Check if character is already in a guild
            const existingGuild = await this.getCharacterGuild(characterId);
            if (existingGuild) {
                this.context.logger.warn(`Character ${characterId} is already in guild ${existingGuild.guildId}`);
                return null;
            }

            // Check if guild name is taken
            const [existingRows] = await this.context.db.query(
                `SELECT id FROM ${this.guildsTable} WHERE name = ?`,
                [guildName]
            ) as any;

            if (existingRows.length > 0) {
                this.context.logger.warn(`Guild name '${guildName}' is already taken`);
                return null;
            }

            // Create guild
            const result = await this.context.db.query(
                `INSERT INTO ${this.guildsTable} (name, leader_id, level, xp, created_at)
                 VALUES (?, ?, 1, 0, NOW())`,
                [guildName, characterId]
            ) as any;

            const guildId = result[0].insertId;

            // Add creator as guild leader
            await this.context.db.query(
                `INSERT INTO ${this.membersTable} (guild_id, character_id, rank, joined_at)
                 VALUES (?, ?, 'leader', NOW())`,
                [guildId, characterId]
            );

            // Emit event
            this.context.events.emit('guilds:created', {
                guildId,
                guildName,
                leaderId: characterId
            });

            return guildId;
        } catch (error) {
            this.context.logger.error(`Error creating guild: ${error}`);
            return null;
        }
    }

    async deleteGuild(characterId: number, guildId: number): Promise<boolean> {
        try {
            // Check if character is guild leader
            const rank = await this.getMemberRank(characterId, guildId);
            if (rank !== 'leader') {
                this.context.logger.warn(`Character ${characterId} is not guild leader of ${guildId}`);
                return false;
            }

            // Delete guild (cascade will delete members and invites)
            await this.context.db.query(
                `DELETE FROM ${this.guildsTable} WHERE id = ?`,
                [guildId]
            );

            // Emit event
            this.context.events.emit('guilds:deleted', {
                guildId,
                leaderId: characterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error deleting guild: ${error}`);
            return false;
        }
    }

    async inviteToGuild(characterId: number, guildId: number, targetCharacterId: number): Promise<boolean> {
        try {
            // Check if inviter has permission (leader or officer)
            const rank = await this.getMemberRank(characterId, guildId);
            if (!rank || (rank !== 'leader' && rank !== 'officer')) {
                this.context.logger.warn(`Character ${characterId} doesn't have permission to invite`);
                return false;
            }

            // Check if target is already in a guild
            const targetGuild = await this.getCharacterGuild(targetCharacterId);
            if (targetGuild) {
                this.context.logger.warn(`Target ${targetCharacterId} is already in guild ${targetGuild.guildId}`);
                return false;
            }

            // Check if target already has pending invite
            const [existingRows] = await this.context.db.query(
                `SELECT id FROM ${this.invitesTable}
                 WHERE guild_id = ? AND character_id = ? AND status = 'pending'`,
                [guildId, targetCharacterId]
            ) as any;

            if (existingRows.length > 0) {
                this.context.logger.warn(`Target ${targetCharacterId} already has pending invite`);
                return false;
            }

            // Create invite
            await this.context.db.query(
                `INSERT INTO ${this.invitesTable} (guild_id, character_id, invited_by, status, created_at)
                 VALUES (?, ?, ?, 'pending', NOW())`,
                [guildId, targetCharacterId, characterId]
            );

            // Emit event
            this.context.events.emit('guilds:inviteSent', {
                guildId,
                targetCharacterId,
                invitedBy: characterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error inviting to guild: ${error}`);
            return false;
        }
    }

    async acceptGuildInvite(characterId: number, inviteId: number): Promise<boolean> {
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
            const guildId = invite.guild_id;

            // Check if character is already in a guild
            const existingGuild = await this.getCharacterGuild(characterId);
            if (existingGuild) {
                this.context.logger.warn(`Character ${characterId} is already in guild ${existingGuild.guildId}`);
                return false;
            }

            // Check if guild is full
            const members = await this.getGuildMembers(guildId);
            const guild = await this.getGuild(guildId);
            if (!guild || members.length >= guild.maxMembers) {
                this.context.logger.warn(`Guild ${guildId} is full`);
                return false;
            }

            // Update invite status
            await this.context.db.query(
                `UPDATE ${this.invitesTable} SET status = 'accepted' WHERE id = ?`,
                [inviteId]
            );

            // Add member to guild
            await this.context.db.query(
                `INSERT INTO ${this.membersTable} (guild_id, character_id, rank, joined_at)
                 VALUES (?, ?, 'member', NOW())`,
                [guildId, characterId]
            );

            // Emit event
            this.context.events.emit('guilds:memberJoined', {
                guildId,
                characterId,
                inviteId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error accepting guild invite: ${error}`);
            return false;
        }
    }

    async rejectGuildInvite(characterId: number, inviteId: number): Promise<boolean> {
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
            this.context.logger.error(`Error rejecting guild invite: ${error}`);
            return false;
        }
    }

    async leaveGuild(characterId: number, guildId: number): Promise<boolean> {
        try {
            // Check if character is guild leader
            const rank = await this.getMemberRank(characterId, guildId);
            if (rank === 'leader') {
                this.context.logger.warn(`Guild leader cannot leave guild. Transfer leadership or delete guild first.`);
                return false;
            }

            // Remove member
            const result = await this.context.db.query(
                `DELETE FROM ${this.membersTable}
                 WHERE guild_id = ? AND character_id = ?`,
                [guildId, characterId]
            ) as any;

            if (result[0].affectedRows === 0) {
                this.context.logger.warn(`Character ${characterId} not in guild ${guildId}`);
                return false;
            }

            // Emit event
            this.context.events.emit('guilds:memberLeft', {
                guildId,
                characterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error leaving guild: ${error}`);
            return false;
        }
    }

    async kickMember(characterId: number, guildId: number, targetCharacterId: number): Promise<boolean> {
        try {
            // Check if kicker has permission
            const kickerRank = await this.getMemberRank(characterId, guildId);
            const targetRank = await this.getMemberRank(targetCharacterId, guildId);

            if (!kickerRank || !targetRank) {
                this.context.logger.warn(`Invalid kick attempt: kicker or target not in guild`);
                return false;
            }

            // Leaders can kick anyone, officers can kick members
            if (kickerRank === 'leader') {
                if (targetRank === 'leader') {
                    this.context.logger.warn(`Cannot kick guild leader`);
                    return false;
                }
            } else if (kickerRank === 'officer') {
                if (targetRank !== 'member') {
                    this.context.logger.warn(`Officers can only kick members`);
                    return false;
                }
            } else {
                this.context.logger.warn(`Members cannot kick other members`);
                return false;
            }

            // Remove member
            await this.context.db.query(
                `DELETE FROM ${this.membersTable}
                 WHERE guild_id = ? AND character_id = ?`,
                [guildId, targetCharacterId]
            );

            // Emit event
            this.context.events.emit('guilds:memberKicked', {
                guildId,
                characterId: targetCharacterId,
                kickedBy: characterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error kicking member: ${error}`);
            return false;
        }
    }

    async promoteToOfficer(characterId: number, guildId: number, targetCharacterId: number): Promise<boolean> {
        try {
            // Only leader can promote
            const rank = await this.getMemberRank(characterId, guildId);
            if (rank !== 'leader') {
                this.context.logger.warn(`Only guild leader can promote members`);
                return false;
            }

            const targetRank = await this.getMemberRank(targetCharacterId, guildId);
            if (targetRank !== 'member') {
                this.context.logger.warn(`Can only promote members to officer`);
                return false;
            }

            // Promote member
            await this.context.db.query(
                `UPDATE ${this.membersTable} SET rank = 'officer'
                 WHERE guild_id = ? AND character_id = ?`,
                [guildId, targetCharacterId]
            );

            // Emit event
            this.context.events.emit('guilds:memberPromoted', {
                guildId,
                characterId: targetCharacterId,
                promotedBy: characterId,
                newRank: 'officer'
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error promoting member: ${error}`);
            return false;
        }
    }

    async demoteToMember(characterId: number, guildId: number, targetCharacterId: number): Promise<boolean> {
        try {
            // Only leader can demote
            const rank = await this.getMemberRank(characterId, guildId);
            if (rank !== 'leader') {
                this.context.logger.warn(`Only guild leader can demote officers`);
                return false;
            }

            const targetRank = await this.getMemberRank(targetCharacterId, guildId);
            if (targetRank !== 'officer') {
                this.context.logger.warn(`Can only demote officers to member`);
                return false;
            }

            // Demote officer
            await this.context.db.query(
                `UPDATE ${this.membersTable} SET rank = 'member'
                 WHERE guild_id = ? AND character_id = ?`,
                [guildId, targetCharacterId]
            );

            // Emit event
            this.context.events.emit('guilds:memberDemoted', {
                guildId,
                characterId: targetCharacterId,
                demotedBy: characterId,
                newRank: 'member'
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error demoting officer: ${error}`);
            return false;
        }
    }

    async transferLeadership(characterId: number, guildId: number, targetCharacterId: number): Promise<boolean> {
        try {
            // Only current leader can transfer leadership
            const rank = await this.getMemberRank(characterId, guildId);
            if (rank !== 'leader') {
                this.context.logger.warn(`Only guild leader can transfer leadership`);
                return false;
            }

            const targetRank = await this.getMemberRank(targetCharacterId, guildId);
            if (!targetRank) {
                this.context.logger.warn(`Target ${targetCharacterId} not in guild ${guildId}`);
                return false;
            }

            // Update guild leader
            await this.context.db.query(
                `UPDATE ${this.guildsTable} SET leader_id = ? WHERE id = ?`,
                [targetCharacterId, guildId]
            );

            // Update old leader to officer
            await this.context.db.query(
                `UPDATE ${this.membersTable} SET rank = 'officer'
                 WHERE guild_id = ? AND character_id = ?`,
                [guildId, characterId]
            );

            // Update new leader rank
            await this.context.db.query(
                `UPDATE ${this.membersTable} SET rank = 'leader'
                 WHERE guild_id = ? AND character_id = ?`,
                [guildId, targetCharacterId]
            );

            // Emit event
            this.context.events.emit('guilds:leadershipTransferred', {
                guildId,
                oldLeaderId: characterId,
                newLeaderId: targetCharacterId
            });

            return true;
        } catch (error) {
            this.context.logger.error(`Error transferring leadership: ${error}`);
            return false;
        }
    }

    async getGuild(guildId: number): Promise<Guild | null> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT g.*, c.name as leader_name
                 FROM ${this.guildsTable} g
                 JOIN characters c ON c.id = g.leader_id
                 WHERE g.id = ?`,
                [guildId]
            ) as any;

            if (rows.length === 0) {
                return null;
            }

            const guild = rows[0];
            return {
                guildId: guild.id,
                name: guild.name,
                leaderId: guild.leader_id,
                leaderName: guild.leader_name,
                level: guild.level,
                xp: guild.xp,
                maxMembers: this.baseMaxMembers + (guild.level * 5), // 5 more slots per level
                createdAt: guild.created_at
            };
        } catch (error) {
            this.context.logger.error(`Error getting guild: ${error}`);
            return null;
        }
    }

    async getGuildMembers(guildId: number): Promise<GuildMember[]> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT m.character_id, m.rank, m.joined_at, c.name as character_name
                 FROM ${this.membersTable} m
                 JOIN characters c ON c.id = m.character_id
                 WHERE m.guild_id = ?
                 ORDER BY
                    CASE m.rank
                        WHEN 'leader' THEN 1
                        WHEN 'officer' THEN 2
                        WHEN 'member' THEN 3
                    END,
                    m.joined_at ASC`,
                [guildId]
            ) as any;

            const members: GuildMember[] = [];

            for (const row of rows) {
                // Check online status via event hook
                const results = await this.context.events.emitAsync('guilds:checkOnlineStatus', row.character_id);
                const isOnline = results && results.some((result: any) => result === true);

                members.push({
                    characterId: row.character_id,
                    characterName: row.character_name,
                    rank: row.rank,
                    joinedAt: row.joined_at,
                    isOnline
                });
            }

            return members;
        } catch (error) {
            this.context.logger.error(`Error getting guild members: ${error}`);
            return [];
        }
    }

    async getCharacterGuild(characterId: number): Promise<Guild | null> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT guild_id FROM ${this.membersTable} WHERE character_id = ?`,
                [characterId]
            ) as any;

            if (rows.length === 0) {
                return null;
            }

            return await this.getGuild(rows[0].guild_id);
        } catch (error) {
            this.context.logger.error(`Error getting character guild: ${error}`);
            return null;
        }
    }

    async getGuildInvites(characterId: number): Promise<GuildInvite[]> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT i.id, i.guild_id, i.character_id, i.invited_by, i.status, i.created_at,
                        g.name as guild_name, c.name as invited_by_name
                 FROM ${this.invitesTable} i
                 JOIN ${this.guildsTable} g ON g.id = i.guild_id
                 JOIN characters c ON c.id = i.invited_by
                 WHERE i.character_id = ? AND i.status = 'pending'
                 ORDER BY i.created_at DESC`,
                [characterId]
            ) as any;

            return rows.map((row: any) => ({
                inviteId: row.id,
                guildId: row.guild_id,
                guildName: row.guild_name,
                characterId: row.character_id,
                invitedBy: row.invited_by,
                invitedByName: row.invited_by_name,
                status: row.status,
                createdAt: row.created_at
            }));
        } catch (error) {
            this.context.logger.error(`Error getting guild invites: ${error}`);
            return [];
        }
    }

    async addGuildXP(guildId: number, xp: number): Promise<void> {
        try {
            const guild = await this.getGuild(guildId);
            if (!guild) {
                return;
            }

            const newXP = guild.xp + xp;
            const newLevel = Math.floor(newXP / this.xpPerLevel) + 1;

            await this.context.db.query(
                `UPDATE ${this.guildsTable} SET xp = ?, level = ? WHERE id = ?`,
                [newXP, newLevel, guildId]
            );

            if (newLevel > guild.level) {
                // Emit level up event
                this.context.events.emit('guilds:levelUp', {
                    guildId,
                    oldLevel: guild.level,
                    newLevel
                });
            }
        } catch (error) {
            this.context.logger.error(`Error adding guild XP: ${error}`);
        }
    }

    async getMemberRank(characterId: number, guildId: number): Promise<GuildRank | null> {
        try {
            const [rows] = await this.context.db.query(
                `SELECT rank FROM ${this.membersTable}
                 WHERE guild_id = ? AND character_id = ?`,
                [guildId, characterId]
            ) as any;

            if (rows.length === 0) {
                return null;
            }

            return rows[0].rank;
        } catch (error) {
            this.context.logger.error(`Error getting member rank: ${error}`);
            return null;
        }
    }
}
