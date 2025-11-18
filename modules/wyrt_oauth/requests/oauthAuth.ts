/**
 * OAuth Token Authentication Handler
 *
 * Validates OAuth JWT tokens for WebSocket authentication
 */

import { Request } from "../../../src/types/Request.js";
import { User } from "../../../src/types/User.js";
import { Data } from "../../../src/types/Data.js";
import WyrtOAuthModule from "../index.js";

const handler: Request = {
    cost: 0,        // No rate limit for auth
    auth: false,    // No auth required (this IS the auth)
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        const { token } = payload;

        if (!token) {
            return u.error('No OAuth token provided');
        }

        // Get OAuth module
        const oauthModule = context.getModule('wyrt_oauth') as WyrtOAuthModule;
        if (!oauthModule) {
            return u.error('OAuth module not available');
        }

        // Verify JWT token
        const oauthManager = oauthModule.getOAuthManager();
        const session = oauthManager.verifySessionToken(token);

        if (!session) {
            return u.error('Invalid or expired OAuth token');
        }

        // Load account from database
        const account = await context.prisma.accounts.findUnique({
            where: { id: session.accountId },
            select: {
                id: true,
                username: true,
                oauth_provider: true,
                oauth_avatar: true
            }
        });

        if (!account) {
            return u.error('Account not found');
        }

        // Set user authentication
        u.accountId = account.id;
        u.username = account.username;
        u.authenticated = true;

        console.log(`[OAuth] User authenticated: ${account.username} (${session.provider})`);

        // Send success response with account info
        u.send(JSON.stringify({
            type: 'oauth_authenticated',
            account: {
                id: account.id,
                username: account.username,
                provider: session.provider,
                avatar: account.oauth_avatar
            }
        }));
    }
};

export default handler;
