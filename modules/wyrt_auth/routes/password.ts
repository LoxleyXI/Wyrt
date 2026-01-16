/**
 * Password Auth HTTP Routes
 *
 * Handles email/password authentication:
 * - POST /auth/register - Create new account
 * - POST /auth/login - Login with email/password
 * - POST /auth/logout - Clear session cookie
 */

import { Request, Response, Router } from 'express';
import { PasswordManager } from '../PasswordManager.js';

// Cookie configuration (same as OAuth for consistency)
const SESSION_COOKIE_NAME = 'wyrt_session';
const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

export function createPasswordRouter(passwordManager: PasswordManager): Router {
    const router = Router();

    /**
     * Register a new account
     * POST /auth/register
     * Body: { email: string, username: string, password: string }
     */
    router.post('/register', async (req: Request, res: Response) => {
        const { email, username, password } = req.body;

        // Validate required fields
        if (!email || !username || !password) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Email, username, and password are required'
            });
        }

        try {
            // Create the account
            const { accountId, username: createdUsername, displayName } = await passwordManager.registerAccount(
                email,
                username,
                password
            );

            // Authenticate and create session
            const { token, session } = await passwordManager.authenticateWithPassword(email, password);

            // Set session cookie
            res.cookie(SESSION_COOKIE_NAME, token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: SESSION_COOKIE_MAX_AGE,
                path: '/',
            });

            console.log(`[Password] New account registered: ${createdUsername}`);

            res.json({
                success: true,
                isNew: true,
                user: {
                    id: accountId,
                    username: createdUsername,
                    displayName: displayName,
                }
            });
        } catch (error: any) {
            console.error('[Password] Registration failed:', error.message);
            res.status(400).json({
                error: 'Registration failed',
                message: error.message
            });
        }
    });

    /**
     * Login with email/password
     * POST /auth/login
     * Body: { email: string, password: string }
     */
    router.post('/login', async (req: Request, res: Response) => {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Email and password are required'
            });
        }

        try {
            // Authenticate
            const { token, session } = await passwordManager.authenticateWithPassword(email, password);

            // Set session cookie
            res.cookie(SESSION_COOKIE_NAME, token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: SESSION_COOKIE_MAX_AGE,
                path: '/',
            });

            console.log(`[Password] Login successful: ${session.username}`);

            res.json({
                success: true,
                user: {
                    id: session.accountId,
                    username: session.username,
                    displayName: session.displayName,
                }
            });
        } catch (error: any) {
            console.error('[Password] Login failed:', error.message);
            res.status(401).json({
                error: 'Login failed',
                message: error.message
            });
        }
    });

    /**
     * Logout - clear session cookie
     * POST /auth/logout
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
