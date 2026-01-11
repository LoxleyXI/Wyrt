/**
 * OAuth Manager
 *
 * Manages OAuth providers and handles authentication flow.
 * Supports per-game OAuth configuration stored in Game.branding.oauth
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuthProvider, OAuthUser, OAuthConfig } from './types/OAuthProvider.js';
import { DiscordProvider } from './providers/DiscordProvider.js';

export interface OAuthSession {
    userId: number;
    accountId: number;
    username: string;
    displayName: string;
    provider: string;
    providerId: string;
    gameId?: string; // Game the user authenticated for (if game-specific OAuth)
}

// Per-game OAuth configuration stored in Game.branding.oauth
export interface GameOAuthConfig {
    discord?: {
        enabled: boolean;
        clientId: string;
        clientSecret: string;
    };
    // Future: google, steam, etc.
}

// Game info returned from database lookup
export interface GameInfo {
    id: string;
    slug: string;
    name: string;
    branding: {
        subdomain?: string;
        customDomain?: string;
        domainVerified?: boolean;
        oauth?: GameOAuthConfig;
    };
}

// Minimal Prisma interface for account and game operations
interface PrismaClient {
    account: {
        findFirst(args: any): Promise<any>;
        update(args: any): Promise<any>;
        create(args: any): Promise<any>;
    };
    game: {
        findFirst(args: any): Promise<any>;
        findUnique(args: any): Promise<any>;
    };
    $queryRaw<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

// Platform domain from environment (e.g., "example.com")
const PLATFORM_DOMAIN = process.env.WYRT_PLATFORM_DOMAIN || 'localhost';

// Platform domains that are always allowed for redirects
const PLATFORM_DOMAINS = [
    PLATFORM_DOMAIN,
    `www.${PLATFORM_DOMAIN}`,
    'localhost',
    '127.0.0.1',
];

// Additional patterns allowed in development
const DEV_DOMAIN_PATTERNS = [
    /\.local$/,           // *.local for local testing (e.g., example.local)
    /^localhost:\d+$/,    // localhost with port
];

export class OAuthManager {
    private providers: Map<string, OAuthProvider> = new Map();
    private gameProviders: Map<string, OAuthProvider> = new Map(); // Cache: "gameId:providerName" -> provider
    private pendingStates: Map<string, { timestamp: number; redirectUrl?: string; gameId?: string }> = new Map();
    private gameCache: Map<string, { game: GameInfo | null; timestamp: number }> = new Map(); // Cache game lookups
    private jwtSecret: string;
    private prisma: PrismaClient | null = null;

    private static readonly GAME_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(jwtSecret: string) {
        this.jwtSecret = jwtSecret;

        // Clean up expired states every 5 minutes
        setInterval(() => this.cleanupExpiredStates(), 5 * 60 * 1000);

        // Clean up game cache every 10 minutes
        setInterval(() => this.cleanupGameCache(), 10 * 60 * 1000);
    }

    /**
     * Set the Prisma client (called after wyrt_data module is initialized)
     */
    setPrisma(prisma: PrismaClient): void {
        this.prisma = prisma;
        console.log('[OAuth] Database connection established');
    }

    // =========================================================================
    // Per-Game OAuth Support
    // =========================================================================

    /**
     * Get game info from hostname (subdomain or custom domain)
     * Returns null if no game matches or hostname is a platform domain
     */
    async getGameFromHostname(hostname: string): Promise<GameInfo | null> {
        if (!hostname || !this.prisma) return null;

        hostname = hostname.toLowerCase();

        // Remove port if present
        const hostWithoutPort = hostname.split(':')[0];

        // Check cache first
        const cached = this.gameCache.get(hostWithoutPort);
        if (cached && Date.now() - cached.timestamp < OAuthManager.GAME_CACHE_TTL) {
            return cached.game;
        }

        let game: GameInfo | null = null;

        try {
            // Check if it's a *.platform subdomain
            if (hostWithoutPort.endsWith(`.${PLATFORM_DOMAIN}`)) {
                const subdomain = hostWithoutPort.replace(`.${PLATFORM_DOMAIN}`, '');
                // Don't treat www as a game
                if (subdomain && subdomain !== 'www') {
                    const results = await this.prisma.$queryRaw<any[]>`
                        SELECT id, slug, name, branding
                        FROM game
                        WHERE branding->>'subdomain' = ${subdomain}
                        LIMIT 1
                    `;
                    if (results.length > 0) {
                        game = {
                            id: results[0].id,
                            slug: results[0].slug,
                            name: results[0].name,
                            branding: results[0].branding || {},
                        };
                    }
                }
            }
            // Check custom domains
            else if (!PLATFORM_DOMAINS.includes(hostWithoutPort)) {
                const results = await this.prisma.$queryRaw<any[]>`
                    SELECT id, slug, name, branding
                    FROM game
                    WHERE branding->>'customDomain' = ${hostWithoutPort}
                    AND (branding->>'domainVerified')::boolean = true
                    LIMIT 1
                `;
                if (results.length > 0) {
                    game = {
                        id: results[0].id,
                        slug: results[0].slug,
                        name: results[0].name,
                        branding: results[0].branding || {},
                    };
                }
            }
        } catch (error) {
            console.error('[OAuth] Error looking up game from hostname:', error);
        }

        // Cache the result (even if null)
        this.gameCache.set(hostWithoutPort, { game, timestamp: Date.now() });

        return game;
    }

    /**
     * Get a game-specific OAuth provider, falling back to global if not configured
     */
    async getProviderForGame(
        providerName: string,
        gameId: string | null,
        callbackUrl: string
    ): Promise<OAuthProvider | undefined> {
        // If no gameId, use global provider
        if (!gameId) {
            return this.getProvider(providerName);
        }

        // Check cache for game-specific provider
        const cacheKey = `${gameId}:${providerName}`;
        const cached = this.gameProviders.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Look up game's OAuth config
        if (!this.prisma) {
            return this.getProvider(providerName);
        }

        try {
            const game = await this.prisma.game.findUnique({
                where: { id: gameId },
                select: { branding: true },
            });

            if (!game) {
                return this.getProvider(providerName);
            }

            const branding = game.branding as GameInfo['branding'];
            const oauthConfig = branding?.oauth?.[providerName as keyof GameOAuthConfig];

            if (!oauthConfig || !oauthConfig.enabled) {
                // Fall back to global provider
                return this.getProvider(providerName);
            }

            // Create game-specific provider
            let provider: OAuthProvider | undefined;

            if (providerName === 'discord' && oauthConfig) {
                provider = new DiscordProvider({
                    clientId: oauthConfig.clientId,
                    clientSecret: oauthConfig.clientSecret,
                    callbackUrl: callbackUrl,
                });
                console.log(`[OAuth] Created game-specific Discord provider for game ${gameId}`);
            }

            // Cache the provider
            if (provider) {
                this.gameProviders.set(cacheKey, provider);
            }

            return provider || this.getProvider(providerName);
        } catch (error) {
            console.error('[OAuth] Error creating game-specific provider:', error);
            return this.getProvider(providerName);
        }
    }

    /**
     * Check if a game has its own OAuth configuration for a provider
     */
    async hasGameOAuthConfig(gameId: string, providerName: string): Promise<boolean> {
        if (!this.prisma || !gameId) return false;

        try {
            const game = await this.prisma.game.findUnique({
                where: { id: gameId },
                select: { branding: true },
            });

            if (!game) return false;

            const branding = game.branding as GameInfo['branding'];
            const oauthConfig = branding?.oauth?.[providerName as keyof GameOAuthConfig];

            return !!(oauthConfig && oauthConfig.enabled && oauthConfig.clientId);
        } catch {
            return false;
        }
    }

    /**
     * Clean up game cache
     */
    private cleanupGameCache(): void {
        const now = Date.now();
        const expired: string[] = [];

        for (const [hostname, data] of this.gameCache.entries()) {
            if (now - data.timestamp > OAuthManager.GAME_CACHE_TTL) {
                expired.push(hostname);
            }
        }

        expired.forEach(hostname => this.gameCache.delete(hostname));
        if (expired.length > 0) {
            console.log(`[OAuth] Cleaned up ${expired.length} expired game cache entries`);
        }
    }

    /**
     * Invalidate game cache (call when game OAuth settings change)
     */
    invalidateGameCache(gameId?: string): void {
        if (gameId) {
            // Remove specific game's cached provider
            for (const key of this.gameProviders.keys()) {
                if (key.startsWith(`${gameId}:`)) {
                    this.gameProviders.delete(key);
                }
            }
        } else {
            // Clear all
            this.gameProviders.clear();
            this.gameCache.clear();
        }
    }

    /**
     * Validate that a redirect URL is allowed
     * Returns true if the URL is a platform domain or verified custom domain
     */
    async isValidRedirectUrl(redirectUrl: string): Promise<boolean> {
        if (!redirectUrl) return true; // No redirect = use default

        try {
            const url = new URL(redirectUrl);
            const hostname = url.hostname.toLowerCase();
            const hostWithPort = url.host.toLowerCase(); // includes port if present

            // Check platform domains (always allowed)
            if (PLATFORM_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
                return true;
            }

            // Check development patterns (*.local, localhost:port)
            if (process.env.NODE_ENV !== 'production') {
                if (DEV_DOMAIN_PATTERNS.some(pattern => pattern.test(hostname) || pattern.test(hostWithPort))) {
                    return true;
                }
            }

            // Check *.platform subdomains (e.g., game.example.com)
            if (hostname.endsWith(`.${PLATFORM_DOMAIN}`)) {
                const subdomain = hostname.replace(`.${PLATFORM_DOMAIN}`, '');
                // Verify subdomain is registered to a game
                if (this.prisma) {
                    const game = await this.prisma.$queryRaw<any[]>`
                        SELECT id FROM game
                        WHERE branding->>'subdomain' = ${subdomain}
                        LIMIT 1
                    `;
                    return game.length > 0;
                }
                return false;
            }

            // Check custom domains (e.g., example.com)
            if (this.prisma) {
                const game = await this.prisma.$queryRaw<any[]>`
                    SELECT id FROM game
                    WHERE branding->>'customDomain' = ${hostname}
                    AND (branding->>'domainVerified')::boolean = true
                    LIMIT 1
                `;
                return game.length > 0;
            }

            return false;
        } catch (e) {
            // Invalid URL
            console.error('[OAuth] Invalid redirect URL:', redirectUrl, e);
            return false;
        }
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
     * @param redirectUrl - URL to redirect after auth
     * @param gameId - Optional game ID for per-game OAuth
     */
    generateState(redirectUrl?: string, gameId?: string): string {
        const state = crypto.randomBytes(32).toString('hex');
        this.pendingStates.set(state, {
            timestamp: Date.now(),
            redirectUrl,
            gameId,
        });
        return state;
    }

    /**
     * Validate and consume a state token
     * Returns the redirect URL and gameId if valid
     */
    validateAndConsumeState(state: string): { valid: boolean; redirectUrl?: string; gameId?: string } {
        const data = this.pendingStates.get(state);
        if (!data) return { valid: false };

        // State tokens expire after 10 minutes
        const isValid = Date.now() - data.timestamp < 10 * 60 * 1000;

        // Always delete the state (consumed or expired)
        this.pendingStates.delete(state);

        if (!isValid) return { valid: false };

        return { valid: true, redirectUrl: data.redirectUrl, gameId: data.gameId };
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
    async getOrCreateAccount(oauthUser: OAuthUser): Promise<{ accountId: number; username: string; displayName: string; isNew: boolean }> {
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
                username: true,
                display_name: true
            }
        });

        if (existingAccount) {
            // Update avatar if changed, and display_name if not customized
            const updateData: any = {};
            if (oauthUser.avatar) {
                updateData.oauth_avatar = oauthUser.avatar;
            }
            // Only update display_name if user hasn't customized it (still null or matches Discord)
            if (!existingAccount.display_name && oauthUser.displayName) {
                updateData.display_name = oauthUser.displayName;
            }
            if (Object.keys(updateData).length > 0) {
                await this.prisma.account.update({
                    where: { id: existingAccount.id },
                    data: updateData
                });
            }
            return {
                accountId: existingAccount.id,
                username: existingAccount.username,
                displayName: existingAccount.display_name || oauthUser.displayName || existingAccount.username,
                isNew: false,
            };
        }

        // Create new account
        const email = oauthUser.email || `${oauthUser.provider}_${oauthUser.id}@oauth.local`;
        const displayName = oauthUser.displayName || oauthUser.username;
        const newAccount = await this.prisma.account.create({
            data: {
                username: oauthUser.username,
                email: email,
                password_hash: '',
                oauth_provider: oauthUser.provider,
                oauth_id: oauthUser.id,
                oauth_avatar: oauthUser.avatar || null,
                display_name: displayName
            },
            select: {
                id: true,
                username: true,
                display_name: true
            }
        });

        console.log(`[OAuth] Created new account for ${oauthUser.provider} user: ${newAccount.username} (ID: ${newAccount.id})`);

        return {
            accountId: newAccount.id,
            username: newAccount.username,
            displayName: newAccount.display_name || displayName,
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
     * @param providerName - Name of the OAuth provider (discord, google, etc.)
     * @param code - Authorization code from OAuth callback
     * @param providerOverride - Optional provider instance (for game-specific OAuth)
     * @param gameId - Optional game ID (for game-specific OAuth)
     */
    async authenticateWithProvider(
        providerName: string,
        code: string,
        providerOverride?: OAuthProvider,
        gameId?: string
    ): Promise<{
        token: string;
        session: OAuthSession;
        isNewAccount: boolean;
    }> {
        const provider = providerOverride || this.getProvider(providerName);
        if (!provider) {
            throw new Error(`Unknown OAuth provider: ${providerName}`);
        }

        // Get user info from provider
        const oauthUser = await provider.authenticate(code);

        // Create or get account
        const { accountId, username, displayName, isNew } = await this.getOrCreateAccount(oauthUser);

        // Create session
        const session: OAuthSession = {
            userId: accountId, // Note: userId is the account ID for now
            accountId: accountId,
            username: username,
            displayName: displayName,
            provider: oauthUser.provider,
            providerId: oauthUser.id,
            gameId: gameId, // Track which game the user authenticated for
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
