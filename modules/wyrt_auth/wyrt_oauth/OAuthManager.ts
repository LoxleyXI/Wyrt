/**
 * OAuth Manager
 *
 * Manages OAuth providers and handles authentication flow
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuthProvider, OAuthUser } from './types/OAuthProvider.js';

export interface OAuthSession {
    userId: number;
    accountId: number;
    username: string;
    provider: string;
    providerId: string;
}

// Minimal Prisma interface for account operations
interface PrismaAccount {
    account: {
        findFirst(args: any): Promise<any>;
        update(args: any): Promise<any>;
        create(args: any): Promise<any>;
    };
}

export class OAuthManager {
    private providers: Map<string, OAuthProvider> = new Map();
    private pendingStates: Map<string, { timestamp: number; redirectUrl?: string }> = new Map();
    private jwtSecret: string;
    private prisma: PrismaAccount | null = null;

    constructor(jwtSecret: string) {
        this.jwtSecret = jwtSecret;

        // Clean up expired states every 5 minutes
        setInterval(() => this.cleanupExpiredStates(), 5 * 60 * 1000);
    }

    /**
     * Set the Prisma client (called after wyrt_data module is initialized)
     */
    setPrisma(prisma: PrismaAccount): void {
        this.prisma = prisma;
        console.log('[OAuth] Database connection established');
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
     * Validate and consume a state token
     * Returns the redirect URL if valid, null if invalid/expired
     */
    validateAndConsumeState(state: string): { valid: boolean; redirectUrl?: string } {
        const data = this.pendingStates.get(state);
        if (!data) return { valid: false };

        // State tokens expire after 10 minutes
        const isValid = Date.now() - data.timestamp < 10 * 60 * 1000;

        // Always delete the state (consumed or expired)
        this.pendingStates.delete(state);

        if (!isValid) return { valid: false };

        return { valid: true, redirectUrl: data.redirectUrl };
    }

    /**
     * @deprecated Use validateAndConsumeState instead
     */
    validateState(state: string): boolean {
        return this.validateAndConsumeState(state).valid;
    }

    /**
     * @deprecated Use validateAndConsumeState instead
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
    async getOrCreateAccount(oauthUser: OAuthUser): Promise<{ accountId: number; username: string; isNew: boolean }> {
        if (!this.prisma) {
            throw new Error('OAuth database not initialized. Ensure wyrt_data module is loaded first.');
        }

        // Check if account exists with this OAuth provider
        const existingAccount = await this.prisma.account.findFirst({
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
            // Update avatar if changed
            if (oauthUser.avatar) {
                await this.prisma.account.update({
                    where: { id: existingAccount.id },
                    data: { oauth_avatar: oauthUser.avatar }
                });
            }
            return {
                accountId: existingAccount.id,
                username: existingAccount.username,
                isNew: false,
            };
        }

        // Create new account
        const email = oauthUser.email || `${oauthUser.provider}_${oauthUser.id}@oauth.local`;
        const newAccount = await this.prisma.account.create({
            data: {
                username: oauthUser.username,
                email: email,
                password_hash: '',
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
