/**
 * OAuth Manager
 *
 * Manages OAuth providers and handles authentication flow
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuthProvider, OAuthUser } from './types/OAuthProvider.js';
import type { PrismaClient } from '../../src/generated/prisma/index.js';

export interface OAuthSession {
    userId: number;
    accountId: number;
    username: string;
    provider: string;
    providerId: string;
}

export class OAuthManager {
    private providers: Map<string, OAuthProvider> = new Map();
    private pendingStates: Map<string, { timestamp: number; redirectUrl?: string }> = new Map();
    private jwtSecret: string;
    private prisma: PrismaClient;

    constructor(jwtSecret: string, prisma: PrismaClient) {
        this.jwtSecret = jwtSecret;
        this.prisma = prisma;

        // Clean up expired states every 5 minutes
        setInterval(() => this.cleanupExpiredStates(), 5 * 60 * 1000);
    }

    /**
     * Register an OAuth provider
     */
    registerProvider(provider: OAuthProvider): void {
        this.providers.set(provider.getName(), provider);
        console.log(`[OAuth] Registered provider: ${provider.getName()}`);
    }

    /**
     * Get a registered provider
     */
    getProvider(name: string): OAuthProvider | undefined {
        return this.providers.get(name);
    }

    /**
     * Generate a secure state token for CSRF protection
     */
    generateState(redirectUrl?: string): string {
        const state = crypto.randomBytes(32).toString('hex');
        this.pendingStates.set(state, {
            timestamp: Date.now(),
            redirectUrl,
        });
        return state;
    }

    /**
     * Validate a state token
     */
    validateState(state: string): boolean {
        const data = this.pendingStates.get(state);
        if (!data) return false;

        // State tokens expire after 10 minutes
        const isValid = Date.now() - data.timestamp < 10 * 60 * 1000;
        if (isValid) {
            this.pendingStates.delete(state);
        }
        return isValid;
    }

    /**
     * Get redirect URL for a state token
     */
    getRedirectUrl(state: string): string | undefined {
        return this.pendingStates.get(state)?.redirectUrl;
    }

    /**
     * Clean up expired state tokens
     */
    private cleanupExpiredStates(): void {
        const now = Date.now();
        const expiredStates: string[] = [];

        for (const [state, data] of this.pendingStates.entries()) {
            if (now - data.timestamp > 10 * 60 * 1000) {
                expiredStates.push(state);
            }
        }

        expiredStates.forEach(state => this.pendingStates.delete(state));
        if (expiredStates.length > 0) {
            console.log(`[OAuth] Cleaned up ${expiredStates.length} expired states`);
        }
    }

    /**
     * Create or get existing account for OAuth user
     */
    /**
     * Create or get existing account for OAuth user
     */
    async getOrCreateAccount(oauthUser: OAuthUser): Promise<{ accountId: number; username: string; isNew: boolean }> {
        // Check if account exists with this OAuth provider
        const existingAccount = await this.prisma.accounts.findFirst({
            where: {
                oauth_provider: oauthUser.provider,
                oauth_id: oauthUser.id
            },
            select: {
                id: true,
                username: true
            }
        });

        if (existingAccount) {
            // Account exists
            return {
                accountId: existingAccount.id,
                username: existingAccount.username,
                isNew: false,
            };
        }

        // Create new account
        const newAccount = await this.prisma.accounts.create({
            data: {
                username: oauthUser.username,
                email: oauthUser.email || `${oauthUser.provider}_${oauthUser.id}@oauth.local`,
                password_hash: '', // OAuth accounts don't need passwords
                oauth_provider: oauthUser.provider,
                oauth_id: oauthUser.id,
                oauth_avatar: oauthUser.avatar || null
            },
            select: {
                id: true,
                username: true
            }
        });

        console.log(`[OAuth] Created new account for ${oauthUser.provider} user: ${newAccount.username} (ID: ${newAccount.id})`);

        return {
            accountId: newAccount.id,
            username: newAccount.username,
            isNew: true,
        };
    }

    /**
     * Generate a JWT session token
     */
    generateSessionToken(session: OAuthSession): string {
        return jwt.sign(session, this.jwtSecret, {
            expiresIn: '30d', // 30 day sessions
        });
    }

    /**
     * Verify and decode a JWT session token
     */
    verifySessionToken(token: string): OAuthSession | null {
        try {
            return jwt.verify(token, this.jwtSecret) as OAuthSession;
        } catch (error) {
            console.error('[OAuth] Token verification failed:', error);
            return null;
        }
    }

    /**
     * Complete OAuth authentication flow
     */
    async authenticateWithProvider(providerName: string, code: string): Promise<{
        token: string;
        session: OAuthSession;
        isNewAccount: boolean;
    }> {
        const provider = this.getProvider(providerName);
        if (!provider) {
            throw new Error(`Unknown OAuth provider: ${providerName}`);
        }

        // Get user info from provider
        const oauthUser = await provider.authenticate(code);

        // Create or get account
        const { accountId, username, isNew } = await this.getOrCreateAccount(oauthUser);

        // Create session
        const session: OAuthSession = {
            userId: accountId, // Note: userId is the account ID for now
            accountId: accountId,
            username: username,
            provider: oauthUser.provider,
            providerId: oauthUser.id,
        };

        // Generate JWT token
        const token = this.generateSessionToken(session);

        return {
            token,
            session,
            isNewAccount: isNew,
        };
    }
}
