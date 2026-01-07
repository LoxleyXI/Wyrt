/**
 * OAuth HTTP Routes
 *
 * Handles OAuth authorization flow:
 * - /oauth/{provider} - Initiates OAuth flow
 * - /oauth/{provider}/callback - Handles OAuth callback
 */

import { Request, Response, Router } from 'express';
import { OAuthManager } from '../OAuthManager.js';

export function createOAuthRouter(oauthManager: OAuthManager): Router {
    const router = Router();

    /**
     * Initiate OAuth flow
     * GET /oauth/:provider?redirect=/game
     */
    router.get('/:provider', async (req: Request, res: Response) => {
        const providerName = req.params.provider;
        const redirectUrl = req.query.redirect as string || '/';

        const provider = oauthManager.getProvider(providerName);
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

        // Generate CSRF state token
        const state = oauthManager.generateState(redirectUrl);

        // Get authorization URL from provider
        const authUrl = provider.getAuthorizationUrl(state);

        console.log(`[OAuth] Redirecting to ${providerName} authorization`);

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

        // Validate CSRF state token and get redirect URL
        const stateData = oauthManager.validateAndConsumeState(state);
        if (!stateData.valid) {
            console.error('[OAuth] Invalid or expired state token');
            return res.redirect('/?error=oauth_invalid_state');
        }

        try {
            // Complete OAuth authentication
            const { token, session, isNewAccount } = await oauthManager.authenticateWithProvider(
                providerName,
                code
            );

            console.log(`[OAuth] ${isNewAccount ? 'Created new account' : 'Logged in'} for ${session.username} via ${providerName}`);

            // Get original redirect URL from state
            const redirectUrl = stateData.redirectUrl || '/';

            // Build final redirect with token
            const separator = redirectUrl.includes('?') ? '&' : '?';
            const finalUrl = `${redirectUrl}${separator}token=${encodeURIComponent(token)}${isNewAccount ? '&new=1' : ''}`;

            res.redirect(finalUrl);
        } catch (error: any) {
            console.error('[OAuth] Authentication failed:', error);
            return res.redirect(`/?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
        }
    });

    return router;
}
