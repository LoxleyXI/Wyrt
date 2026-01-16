/**
 * Password Manager
 *
 * Handles email/password authentication with bcrypt hashing.
 * Reuses JWT session tokens from wyrt_oauth for consistency.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export interface PasswordSession {
    userId: number;
    accountId: number;
    username: string;
    displayName: string;
    provider: 'email';
    providerId: string; // email address
    gameId?: string;
}

// Minimal Prisma interface for account operations
interface PrismaClient {
    account: {
        findFirst(args: any): Promise<any>;
        findUnique(args: any): Promise<any>;
        update(args: any): Promise<any>;
        create(args: any): Promise<any>;
    };
    $queryRaw<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

export class PasswordManager {
    private jwtSecret: string;
    private bcryptRounds: number;
    private prisma: PrismaClient | null = null;

    constructor(jwtSecret: string, bcryptRounds: number = 12) {
        this.jwtSecret = jwtSecret;
        this.bcryptRounds = bcryptRounds;
    }

    /**
     * Set the Prisma client (called after wyrt_data module is initialized)
     */
    setPrisma(prisma: PrismaClient): void {
        this.prisma = prisma;
        console.log('[Password] Database connection established');
    }

    /**
     * Hash a password using bcrypt
     */
    async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, this.bcryptRounds);
    }

    /**
     * Compare a password with a hash
     */
    async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    /**
     * Validate email format
     */
    validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate password strength
     */
    validatePassword(password: string): { valid: boolean; message?: string } {
        if (password.length < 8) {
            return { valid: false, message: 'Password must be at least 8 characters' };
        }
        if (password.length > 128) {
            return { valid: false, message: 'Password must be less than 128 characters' };
        }
        return { valid: true };
    }

    /**
     * Validate username
     */
    validateUsername(username: string): { valid: boolean; message?: string } {
        if (username.length < 3) {
            return { valid: false, message: 'Username must be at least 3 characters' };
        }
        if (username.length > 32) {
            return { valid: false, message: 'Username must be less than 32 characters' };
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            return { valid: false, message: 'Username can only contain letters, numbers, underscores, and hyphens' };
        }
        return { valid: true };
    }

    /**
     * Register a new account with email/password
     */
    async registerAccount(
        email: string,
        username: string,
        password: string
    ): Promise<{ accountId: number; username: string; displayName: string }> {
        if (!this.prisma) {
            throw new Error('Password auth database not initialized');
        }

        // Validate inputs
        if (!this.validateEmail(email)) {
            throw new Error('Invalid email address');
        }

        const usernameValidation = this.validateUsername(username);
        if (!usernameValidation.valid) {
            throw new Error(usernameValidation.message);
        }

        const passwordValidation = this.validatePassword(password);
        if (!passwordValidation.valid) {
            throw new Error(passwordValidation.message);
        }

        // Check if email already exists
        const existingEmail = await this.prisma.account.findFirst({
            where: { email: email.toLowerCase() }
        });
        if (existingEmail) {
            throw new Error('Email already registered');
        }

        // Check if username already exists
        const existingUsername = await this.prisma.account.findFirst({
            where: { username: username }
        });
        if (existingUsername) {
            throw new Error('Username already taken');
        }

        // Hash password
        const passwordHash = await this.hashPassword(password);

        // Create account
        const newAccount = await this.prisma.account.create({
            data: {
                username: username,
                email: email.toLowerCase(),
                password_hash: passwordHash,
                display_name: username,
                oauth_provider: null,
                oauth_id: null,
                oauth_avatar: null,
            },
            select: {
                id: true,
                username: true,
                display_name: true
            }
        });

        console.log(`[Password] Created new account: ${newAccount.username} (ID: ${newAccount.id})`);

        return {
            accountId: newAccount.id,
            username: newAccount.username,
            displayName: newAccount.display_name || username,
        };
    }

    /**
     * Authenticate with email/password
     */
    async authenticateWithPassword(
        email: string,
        password: string,
        gameId?: string
    ): Promise<{
        token: string;
        session: PasswordSession;
    }> {
        if (!this.prisma) {
            throw new Error('Password auth database not initialized');
        }

        // Find account by email
        const account = await this.prisma.account.findFirst({
            where: { email: email.toLowerCase() },
            select: {
                id: true,
                username: true,
                email: true,
                password_hash: true,
                display_name: true,
                status: true,
            }
        });

        if (!account) {
            throw new Error('Invalid email or password');
        }

        // Check if account is active
        if (account.status !== 'active') {
            throw new Error('Account is not active');
        }

        // Check if account has a password (might be OAuth-only)
        if (!account.password_hash) {
            throw new Error('This account uses social login. Please sign in with Discord.');
        }

        // Verify password
        const passwordValid = await this.comparePassword(password, account.password_hash);
        if (!passwordValid) {
            throw new Error('Invalid email or password');
        }

        // Update last login
        await this.prisma.account.update({
            where: { id: account.id },
            data: { last_login: new Date() }
        });

        // Create session
        const session: PasswordSession = {
            userId: account.id,
            accountId: account.id,
            username: account.username,
            displayName: account.display_name || account.username,
            provider: 'email',
            providerId: account.email,
            gameId: gameId,
        };

        // Generate JWT token
        const token = this.generateSessionToken(session);

        console.log(`[Password] Login successful: ${account.username}`);

        return { token, session };
    }

    /**
     * Generate a JWT session token (same format as OAuth)
     */
    generateSessionToken(session: PasswordSession): string {
        return jwt.sign(session, this.jwtSecret, {
            expiresIn: '30d',
        });
    }

    /**
     * Verify and decode a JWT session token
     */
    verifySessionToken(token: string): PasswordSession | null {
        try {
            return jwt.verify(token, this.jwtSecret) as PasswordSession;
        } catch (error) {
            console.error('[Password] Token verification failed:', error);
            return null;
        }
    }
}
