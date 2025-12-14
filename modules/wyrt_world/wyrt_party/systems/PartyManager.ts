/**
 * Party Manager
 *
 * Game-agnostic party system for multiplayer games.
 * Handles party creation, invites, membership, and leader management.
 *
 * Games are responsible for:
 * - Deciding what data to sync (HP, mana, position, etc.)
 * - Calling updateMemberGameData() when stats change
 * - Rendering party UI appropriate for their game
 * - Handling party-specific bonuses/mechanics
 */

import { EventEmitter } from 'events';
import {
    Party,
    PartyMember,
    PartyInvite,
    PartyConfig,
    PartyEvent,
    PartyEventType,
    PartyState,
    PartyMemberUpdate
} from '../types/Party';

export class PartyManager extends EventEmitter {
    /** Map of party ID to Party */
    private parties: Map<string, Party> = new Map();

    /** Map of player ID to party ID (for quick lookup) */
    private playerParties: Map<string, string> = new Map();

    /** Map of invite ID to PartyInvite */
    private pendingInvites: Map<string, PartyInvite> = new Map();

    /** Map of player ID to list of pending invite IDs */
    private playerInvites: Map<string, Set<string>> = new Map();

    /** Configuration */
    private config: Required<PartyConfig>;

    /** Invite cleanup interval */
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(config: PartyConfig = {}) {
        super();
        this.config = {
            maxPartySize: config.maxPartySize ?? 5,
            inviteTimeout: config.inviteTimeout ?? 60000, // 1 minute
            enablePartyChat: config.enablePartyChat ?? true
        };

        // Start invite cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanupExpiredInvites(), 10000);
    }

    /**
     * Generate a unique ID
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Emit a party event
     */
    private emitEvent(type: PartyEventType, partyId: string, playerId?: string, playerName?: string, data?: Record<string, any>): void {
        const event: PartyEvent = { type, partyId, playerId, playerName, data };
        this.emit('party_event', event);
        this.emit(type, event);
    }

    /**
     * Get a player's current party
     */
    getPlayerParty(playerId: string): Party | null {
        const partyId = this.playerParties.get(playerId);
        if (!partyId) return null;
        return this.parties.get(partyId) || null;
    }

    /**
     * Get a party by ID
     */
    getParty(partyId: string): Party | null {
        return this.parties.get(partyId) || null;
    }

    /**
     * Check if a player is in a party
     */
    isInParty(playerId: string): boolean {
        return this.playerParties.has(playerId);
    }

    /**
     * Check if a player is a party leader
     */
    isPartyLeader(playerId: string): boolean {
        const party = this.getPlayerParty(playerId);
        return party?.leaderId === playerId;
    }

    /**
     * Create a new party with the specified player as leader
     */
    createParty(leaderId: string, leaderName: string): Party {
        // Remove from existing party first
        if (this.isInParty(leaderId)) {
            this.leaveParty(leaderId);
        }

        const partyId = this.generateId();
        const now = Date.now();

        const leader: PartyMember = {
            id: leaderId,
            name: leaderName,
            isLeader: true,
            joinedAt: now
        };

        const party: Party = {
            id: partyId,
            leaderId,
            members: new Map([[leaderId, leader]]),
            createdAt: now,
            maxSize: this.config.maxPartySize
        };

        this.parties.set(partyId, party);
        this.playerParties.set(leaderId, partyId);

        this.emitEvent('party_created', partyId, leaderId, leaderName);

        return party;
    }

    /**
     * Send a party invite to a player
     */
    invitePlayer(fromId: string, fromName: string, toId: string, toName: string): PartyInvite | { error: string } {
        // Check if inviter is in a party
        let party = this.getPlayerParty(fromId);

        // If not in a party, create one
        if (!party) {
            party = this.createParty(fromId, fromName);
        }

        // Check if inviter is leader (or only member)
        if (party.leaderId !== fromId && party.members.size > 1) {
            return { error: 'Only the party leader can invite players' };
        }

        // Check if party is full
        if (party.members.size >= party.maxSize) {
            return { error: 'Party is full' };
        }

        // Check if target is already in a party
        if (this.isInParty(toId)) {
            return { error: `${toName} is already in a party` };
        }

        // Check if already has pending invite from this party
        const existingInvites = this.playerInvites.get(toId);
        if (existingInvites) {
            for (const inviteId of existingInvites) {
                const invite = this.pendingInvites.get(inviteId);
                if (invite && invite.partyId === party.id) {
                    return { error: `${toName} already has a pending invite from your party` };
                }
            }
        }

        // Create invite
        const inviteId = this.generateId();
        const now = Date.now();

        const invite: PartyInvite = {
            id: inviteId,
            partyId: party.id,
            fromId,
            fromName,
            toId,
            toName,
            sentAt: now,
            expiresAt: now + this.config.inviteTimeout
        };

        this.pendingInvites.set(inviteId, invite);

        // Track invites per player
        if (!this.playerInvites.has(toId)) {
            this.playerInvites.set(toId, new Set());
        }
        this.playerInvites.get(toId)!.add(inviteId);

        this.emitEvent('invite_sent', party.id, toId, toName, { inviteId, fromId, fromName });

        return invite;
    }

    /**
     * Accept a party invite
     */
    acceptInvite(inviteId: string, playerId: string, playerName: string): Party | { error: string } {
        const invite = this.pendingInvites.get(inviteId);

        if (!invite) {
            return { error: 'Invite not found or expired' };
        }

        if (invite.toId !== playerId) {
            return { error: 'This invite is not for you' };
        }

        if (Date.now() > invite.expiresAt) {
            this.removeInvite(inviteId);
            return { error: 'Invite has expired' };
        }

        const party = this.parties.get(invite.partyId);
        if (!party) {
            this.removeInvite(inviteId);
            return { error: 'Party no longer exists' };
        }

        if (party.members.size >= party.maxSize) {
            this.removeInvite(inviteId);
            return { error: 'Party is full' };
        }

        // Remove from any existing party
        if (this.isInParty(playerId)) {
            this.leaveParty(playerId);
        }

        // Add to party
        const member: PartyMember = {
            id: playerId,
            name: playerName,
            isLeader: false,
            joinedAt: Date.now()
        };

        party.members.set(playerId, member);
        this.playerParties.set(playerId, party.id);

        // Remove the invite
        this.removeInvite(inviteId);

        // Clear all other pending invites for this player
        this.clearPlayerInvites(playerId);

        this.emitEvent('invite_accepted', party.id, playerId, playerName);
        this.emitEvent('member_joined', party.id, playerId, playerName);

        return party;
    }

    /**
     * Decline a party invite
     */
    declineInvite(inviteId: string, playerId: string): boolean {
        const invite = this.pendingInvites.get(inviteId);

        if (!invite || invite.toId !== playerId) {
            return false;
        }

        this.emitEvent('invite_declined', invite.partyId, playerId, invite.toName, {
            fromId: invite.fromId,
            fromName: invite.fromName
        });

        this.removeInvite(inviteId);
        return true;
    }

    /**
     * Leave current party
     */
    leaveParty(playerId: string): boolean {
        const party = this.getPlayerParty(playerId);
        if (!party) return false;

        const member = party.members.get(playerId);
        const wasLeader = party.leaderId === playerId;

        // Remove from party
        party.members.delete(playerId);
        this.playerParties.delete(playerId);

        this.emitEvent('member_left', party.id, playerId, member?.name);

        // Handle party dissolution or leader transfer
        if (party.members.size === 0) {
            // Disband empty party
            this.parties.delete(party.id);
            this.emitEvent('party_disbanded', party.id);
        } else if (wasLeader) {
            // Transfer leadership to longest member
            let newLeader: PartyMember | null = null;
            let earliestJoin = Infinity;

            for (const m of party.members.values()) {
                if (m.joinedAt < earliestJoin) {
                    earliestJoin = m.joinedAt;
                    newLeader = m;
                }
            }

            if (newLeader) {
                party.leaderId = newLeader.id;
                newLeader.isLeader = true;
                this.emitEvent('leader_changed', party.id, newLeader.id, newLeader.name);
            }
        }

        return true;
    }

    /**
     * Kick a player from the party (leader only)
     */
    kickFromParty(leaderId: string, targetId: string): boolean | { error: string } {
        const party = this.getPlayerParty(leaderId);

        if (!party) {
            return { error: 'You are not in a party' };
        }

        if (party.leaderId !== leaderId) {
            return { error: 'Only the party leader can kick members' };
        }

        if (targetId === leaderId) {
            return { error: 'You cannot kick yourself' };
        }

        const member = party.members.get(targetId);
        if (!member) {
            return { error: 'Player is not in your party' };
        }

        // Remove from party
        party.members.delete(targetId);
        this.playerParties.delete(targetId);

        this.emitEvent('member_kicked', party.id, targetId, member.name, { kickedBy: leaderId });

        return true;
    }

    /**
     * Promote a player to party leader
     */
    promoteToLeader(currentLeaderId: string, newLeaderId: string): boolean | { error: string } {
        const party = this.getPlayerParty(currentLeaderId);

        if (!party) {
            return { error: 'You are not in a party' };
        }

        if (party.leaderId !== currentLeaderId) {
            return { error: 'Only the party leader can promote members' };
        }

        const newLeader = party.members.get(newLeaderId);
        if (!newLeader) {
            return { error: 'Player is not in your party' };
        }

        const oldLeader = party.members.get(currentLeaderId);
        if (oldLeader) {
            oldLeader.isLeader = false;
        }

        party.leaderId = newLeaderId;
        newLeader.isLeader = true;

        this.emitEvent('leader_changed', party.id, newLeaderId, newLeader.name);

        return true;
    }

    /**
     * Update game-specific data for a party member
     * Games call this when player stats change (HP, mana, etc.)
     */
    updateMemberGameData(playerId: string, gameData: Record<string, any>): boolean {
        const party = this.getPlayerParty(playerId);
        if (!party) return false;

        const member = party.members.get(playerId);
        if (!member) return false;

        member.gameData = { ...member.gameData, ...gameData };

        // Emit update event so games can broadcast to party
        this.emit('member_data_updated', {
            partyId: party.id,
            memberId: playerId,
            gameData: member.gameData
        } as PartyMemberUpdate & { partyId: string });

        return true;
    }

    /**
     * Get party state for sending to clients
     */
    getPartyState(partyId: string): PartyState | null {
        const party = this.parties.get(partyId);
        if (!party) return null;

        return {
            partyId: party.id,
            leaderId: party.leaderId,
            members: Array.from(party.members.values()).map(m => ({
                id: m.id,
                name: m.name,
                isLeader: m.isLeader,
                gameData: m.gameData
            }))
        };
    }

    /**
     * Get all party member IDs (for broadcasting)
     */
    getPartyMemberIds(partyId: string): string[] {
        const party = this.parties.get(partyId);
        if (!party) return [];
        return Array.from(party.members.keys());
    }

    /**
     * Get pending invites for a player
     */
    getPendingInvites(playerId: string): PartyInvite[] {
        const inviteIds = this.playerInvites.get(playerId);
        if (!inviteIds) return [];

        const invites: PartyInvite[] = [];
        const now = Date.now();

        for (const inviteId of inviteIds) {
            const invite = this.pendingInvites.get(inviteId);
            if (invite && invite.expiresAt > now) {
                invites.push(invite);
            }
        }

        return invites;
    }

    /**
     * Remove an invite
     */
    private removeInvite(inviteId: string): void {
        const invite = this.pendingInvites.get(inviteId);
        if (invite) {
            this.pendingInvites.delete(inviteId);
            const playerInvites = this.playerInvites.get(invite.toId);
            if (playerInvites) {
                playerInvites.delete(inviteId);
                if (playerInvites.size === 0) {
                    this.playerInvites.delete(invite.toId);
                }
            }
        }
    }

    /**
     * Clear all pending invites for a player
     */
    private clearPlayerInvites(playerId: string): void {
        const inviteIds = this.playerInvites.get(playerId);
        if (inviteIds) {
            for (const inviteId of inviteIds) {
                this.pendingInvites.delete(inviteId);
            }
            this.playerInvites.delete(playerId);
        }
    }

    /**
     * Cleanup expired invites
     */
    private cleanupExpiredInvites(): void {
        const now = Date.now();
        for (const [inviteId, invite] of this.pendingInvites) {
            if (now > invite.expiresAt) {
                this.emitEvent('invite_expired', invite.partyId, invite.toId, invite.toName);
                this.removeInvite(inviteId);
            }
        }
    }

    /**
     * Handle player disconnect - remove from party
     */
    handleDisconnect(playerId: string): void {
        this.clearPlayerInvites(playerId);
        this.leaveParty(playerId);
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.removeAllListeners();
    }
}
