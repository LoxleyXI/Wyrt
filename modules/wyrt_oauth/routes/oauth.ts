/**
 * OAuth HTTP Routes
 *
 * Handles OAuth authorization flow with per-game support:
 * - /oauth/{provider} - Initiates OAuth flow
 * - /oauth/{provider}/callback - Handles OAuth callback
 * - /api/session - Validate current session
 * - /api/logout - Clear session cookie
 *
 * Per-game OAuth:
 * Games can configure their own Discord/Google/Steam credentials in Game.branding.oauth.
 * The game is detected from the request hostname (subdomain or custom domain).
 * If a game has its own OAuth config, users will see the game's branding on Discord.
 */

import { Request, Response, Router } from 'express';
import { OAuthManager } from '../OAuthManager.js';

// Cookie configuration
const SESSION_COOKIE_NAME = 'wyrt_session';
const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

export function createOAuthRouter(oauthManager: OAuthManager): Router {
    const router = Router();

    /**
     * Initiate OAuth flow
     * GET /oauth/:provider?redirect=/game
     *
     * If the request comes from a game's subdomain/custom domain,
     * and that game has its own OAuth credentials configured,
     * we'll use the game-specific OAuth app (so users see the game's branding).
     */
    router.get('/:provider', async (req: Request, res: Response) => {
        const providerName = req.params.provider;
        const redirectUrl = req.query.redirect as string || '/';
        const hostname = req.headers.host || '';

        // Detect game from hostname (subdomain or custom domain)
        const game = await oauthManager.getGameFromHostname(hostname);
        const gameId = game?.id || null;

        if (game) {
            console.log(`[OAuth] Detected game: ${game.name} (${game.slug}) from hostname ${hostname}`);
        }

        // Build callback URL based on the origin
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const callbackUrl = `${protocol}://${hostname}/oauth/${providerName}/callback`;

        // Get provider (game-specific if available, otherwise global)
        const provider = await oauthManager.getProviderForGame(providerName, gameId, callbackUrl);
        if (!provider) {
            return res.status(404).json({
                error: 'Unknown OAuth provider',
                provider: providerName
            });
        }

        // Validate redirect URL to prevent open redirects
        const isValidRedirect = await oauthManager.isValidRedirectUrl(redirectUrl);
        if (!isValidRedirect) {
            console.warn(`[OAuth] Blocked invalid redirect URL: ${redirectUrl}`);
            return res.status(400).json({
                error: 'Invalid redirect URL',
                message: 'Redirect URL must be a platform domain or verified custom domain'
            });
        }

        // Generate CSRF state token (include gameId for callback)
        const state = oauthManager.generateState(redirectUrl, gameId || undefined);

        // Get authorization URL from provider
        const authUrl = provider.getAuthorizationUrl(state);

        console.log(`[OAuth] Redirecting to ${providerName} authorization${gameId ? ` (game: ${game?.slug})` : ' (global)'}`);

        // Redirect user to OAuth provider
        res.redirect(authUrl);
    });

    /**
     * Handle OAuth callback
     * GET /oauth/:provider/callback?code=...&state=...
     */
    router.get('/:provider/callback', async (req: Request, res: Response) => {
        const providerName = req.params.provider;
        const code = req.query.code as string;
        const state = req.query.state as string;
        const error = req.query.error as string;
        const hostname = req.headers.host || '';

        // Check for OAuth errors (user denied, etc.)
        if (error) {
            console.error(`[OAuth] Provider returned error: ${error}`);
            return res.redirect(`/?error=oauth_${error}`);
        }

        // Validate required parameters
        if (!code || !state) {
            console.error('[OAuth] Missing code or state parameter');
            return res.redirect('/?error=oauth_invalid_request');
        }

        // Validate CSRF state token and get redirect URL + gameId
        const stateData = oauthManager.validateAndConsumeState(state);
        if (!stateData.valid) {
            console.error('[OAuth] Invalid or expired state token');
            return res.redirect('/?error=oauth_invalid_state');
        }

        const gameId = stateData.gameId;

        try {
            // Build callback URL for token exchange
            const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
            const callbackUrl = `${protocol}://${hostname}/oauth/${providerName}/callback`;

            // Get game-specific provider if we have a gameId
            const provider = gameId
                ? await oauthManager.getProviderForGame(providerName, gameId, callbackUrl)
                : oauthManager.getProvider(providerName);

            // Complete OAuth authentication (pass provider and gameId)
            const { token, session, isNewAccount } = await oauthManager.authenticateWithProvider(
                providerName,
                code,
                provider,
                gameId
            );

            const gameInfo = gameId ? ` for game ${gameId}` : '';
            console.log(`[OAuth] ${isNewAccount ? 'Created new account' : 'Logged in'} for ${session.username} via ${providerName}${gameInfo}`);

            // Set session cookie (HTTP-only for security)
            res.cookie(SESSION_COOKIE_NAME, token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: SESSION_COOKIE_MAX_AGE,
                path: '/',
            });

            // Get original redirect URL from state (this is the frontend callback URL)
            const redirectUrl = stateData.redirectUrl || '/';

            // Build the final redirect URL with token
            // The frontend passes a full URL like: http://localhost:8002/auth/callback?redirect=/play
            // We add the token to it
            const redirectUrlObj = new URL(redirectUrl, `${req.protocol}://${req.headers.host}`);
            redirectUrlObj.searchParams.set('token', token);
            if (isNewAccount) {
                redirectUrlObj.searchParams.set('new', '1');
            }

            res.redirect(redirectUrlObj.toString());
        } catch (error: any) {
            console.error('[OAuth] Authentication failed:', error);
            return res.redirect('/auth/callback?error=oauth_failed&message=' + encodeURIComponent(error.message));
        }
    });

    return router;
}

/**
 * Create API router for session management
 */
export function createSessionRouter(oauthManager: OAuthManager): Router {
    const router = Router();

    /**
     * Verify token from Authorization header
     * GET /api/auth/verify
     * Returns: { success: boolean, userId?, username?, message? }
     *
     * This endpoint is used by GameClient to verify tokens
     * Uses the OAuth module's JWT secret (same as token creation)
     */
    router.get('/auth/verify', (req: Request, res: Response) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.substring(7);

        try {
            const session = oauthManager.verifySessionToken(token);
            if (!session) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid or expired token'
                });
            }

            res.json({
                success: true,
                userId: session.accountId,
                username: session.username,
                displayName: session.displayName,
                gameId: session.gameId || null
            });
        } catch (error) {
            console.error('[Auth] Token verification failed:', error);
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
    });

    /**
     * Validate current session
     * GET /api/session
     * Returns: { valid: boolean, user?: { id, username, displayName, avatar }, gameId?: string }
     */
    router.get('/session', async (req: Request, res: Response) => {
        const token = req.cookies?.[SESSION_COOKIE_NAME];

        if (!token) {
            return res.json({ valid: false });
        }

        try {
            const session = oauthManager.verifySessionToken(token);
            if (!session) {
                return res.json({ valid: false });
            }

            res.json({
                valid: true,
                token: token, // Return token for WebSocket authentication
                user: {
                    id: session.accountId,
                    username: session.username,
                    displayName: session.displayName,
                    avatar: null, // Avatar would need to be fetched from database
                },
                gameId: session.gameId || null, // Game the user authenticated for
            });
        } catch (error) {
            console.error('[Session] Token validation failed:', error);
            res.json({ valid: false });
        }
    });

    /**
     * Clear session (logout)
     * POST /api/logout
     */
    router.post('/logout', (req: Request, res: Response) => {
        res.clearCookie(SESSION_COOKIE_NAME, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        });

        res.json({ success: true });
    });

    return router;
}
