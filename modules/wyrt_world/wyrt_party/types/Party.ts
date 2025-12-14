/**
 * Party System Types
 *
 * Game-agnostic type definitions for the party system.
 * Games can extend these with their own data via the `gameData` field.
 */

/**
 * Represents a member of a party
 */
export interface PartyMember {
    /** Unique player ID */
    id: string;
    /** Display name */
    name: string;
    /** Whether this member is the party leader */
    isLeader: boolean;
    /** Timestamp when joined */
    joinedAt: number;
    /** Game-specific data (HP, mana, class, etc.) - managed by the game module */
    gameData?: Record<string, any>;
}

/**
 * Represents a party (group of players)
 */
export interface Party {
    /** Unique party ID */
    id: string;
    /** Party leader's player ID */
    leaderId: string;
    /** Map of member ID to PartyMember */
    members: Map<string, PartyMember>;
    /** Timestamp when party was created */
    createdAt: number;
    /** Maximum party size (default: 5) */
    maxSize: number;
}

/**
 * Represents a pending party invitation
 */
export interface PartyInvite {
    /** Unique invite ID */
    id: string;
    /** Party ID being invited to */
    partyId: string;
    /** Player ID who sent the invite */
    fromId: string;
    /** Player name who sent the invite */
    fromName: string;
    /** Player ID being invited */
    toId: string;
    /** Player name being invited */
    toName: string;
    /** Timestamp when invite was sent */
    sentAt: number;
    /** Invite expiration time in ms (default: 60000 = 1 minute) */
    expiresAt: number;
}

/**
 * Party event types for game modules to subscribe to
 */
export type PartyEventType =
    | 'party_created'
    | 'party_disbanded'
    | 'member_joined'
    | 'member_left'
    | 'member_kicked'
    | 'leader_changed'
    | 'invite_sent'
    | 'invite_accepted'
    | 'invite_declined'
    | 'invite_expired';

/**
 * Party event payload
 */
export interface PartyEvent {
    type: PartyEventType;
    partyId: string;
    /** Player ID relevant to the event */
    playerId?: string;
    /** Player name relevant to the event */
    playerName?: string;
    /** Additional event data */
    data?: Record<string, any>;
}

/**
 * Configuration options for the PartyManager
 */
export interface PartyConfig {
    /** Maximum party size (default: 5) */
    maxPartySize?: number;
    /** Invite timeout in ms (default: 60000 = 1 minute) */
    inviteTimeout?: number;
    /** Whether to allow party chat (default: true) */
    enablePartyChat?: boolean;
}

/**
 * Callback for party events
 */
export type PartyEventCallback = (event: PartyEvent) => void;

/**
 * Data sent to party members for updates
 */
export interface PartyMemberUpdate {
    memberId: string;
    gameData: Record<string, any>;
}

/**
 * Full party state sent to members
 */
export interface PartyState {
    partyId: string;
    leaderId: string;
    members: Array<{
        id: string;
        name: string;
        isLeader: boolean;
        gameData?: Record<string, any>;
    }>;
}
