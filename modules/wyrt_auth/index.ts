/**
 * Wyrt Authentication Module
 *
 * Provides core email/password authentication.
 * Uses JWT sessions compatible with wyrt_oauth.
 */

import { IModule } from '../../src/module/IModule.js';
import { ModuleContext } from '../../src/module/ModuleContext.js';
import { PasswordManager } from './PasswordManager.js';
import { createPasswordRouter } from './routes/password.js';

export class WyrtAuthModule implements IModule {
    name = 'wyrt_auth';
    version = '1.0.0';
    dependencies = ['wyrt_data'];

    private context!: ModuleContext;
    private passwordManager: PasswordManager | null = null;

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        // Get JWT secret from config or environment
        const jwtSecret = (globalThis as any).config?.oauth?.jwtSecret
            || process.env.OAUTH_JWT_SECRET
            || process.env.JWT_SECRET;

        if (!jwtSecret) {
            throw new Error('[Auth] JWT secret not configured. Set OAUTH_JWT_SECRET or JWT_SECRET environment variable.');
        }

        // Get bcrypt rounds from config or use default
        const bcryptRounds = (globalThis as any).config?.password?.bcryptRounds || 12;

        // Create password manager
        this.passwordManager = new PasswordManager(jwtSecret, bcryptRounds);

        console.log(`[Auth] Module initialized (bcrypt rounds: ${bcryptRounds})`);
    }

    async activate(): Promise<void> {
        if (!this.passwordManager) {
            throw new Error('[Auth] Module not initialized');
        }

        // Get database from wyrt_data module
        const wyrtData = this.context.getModule('wyrt_data') as any;
        if (wyrtData && typeof wyrtData.getDatabase === 'function') {
            const prisma = wyrtData.getDatabase();
            this.passwordManager.setPrisma(prisma);
        } else {
            console.warn('[Auth] wyrt_data module not available - database operations will fail');
        }

        // Register HTTP routes
        const httpServer = (globalThis as any).httpServer;
        if (httpServer) {
            const passwordRouter = createPasswordRouter(this.passwordManager);
            httpServer.use('/auth', passwordRouter);
            console.log('[Auth] Routes registered at /auth/*');
        } else {
            console.warn('[Auth] HTTP server not available, routes not registered');
        }

        // Export manager for other modules
        (globalThis as any).wyrt = (globalThis as any).wyrt || {};
        (globalThis as any).wyrt.modules = (globalThis as any).wyrt.modules || {};
        (globalThis as any).wyrt.modules.wyrt_auth = {
            getPasswordManager: () => this.passwordManager
        };

        console.log('[Auth] Module activated');
    }

    async deactivate(): Promise<void> {
        console.log('[Auth] Module deactivated');
    }

    /**
     * Get the password manager instance
     */
    getPasswordManager(): PasswordManager | null {
        return this.passwordManager;
    }
}

// Export for module loader
export default WyrtAuthModule;
export { PasswordManager } from './PasswordManager.js';
