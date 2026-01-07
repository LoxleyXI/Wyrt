/**
 * @module wyrt_oauth
 * @description OAuth authentication module supporting Discord, Google, Steam, and other providers
 * @category Auth
 *
 * @features
 * - Discord OAuth2 integration
 * - Google OAuth2 integration (planned)
 * - Steam OpenID integration (planned)
 * - Automatic account linking
 * - JWT token generation
 * - Provider configuration via server.json or env vars
 * - HTTP route registration (/oauth/:provider)
 * - Callback handling and token exchange
 *
 * @usage
 * ```typescript
 * // Configure in server.json:
 * // {
 * //   "oauth": {
 * //     "jwtSecret": "your-secret",
 * //     "providers": {
 * //       "discord": {
 * //         "enabled": true,
 * //         "clientId": "...",
 * //         "clientSecret": "...",
 * //         "callbackUrl": "https://yourgame.com/oauth/discord/callback"
 * //       }
 * //     }
 * //   }
 * // }
 *
 * // OAuth routes are auto-registered:
 * // GET /oauth/discord - Redirects to Discord login
 * // GET /oauth/discord/callback - Handles callback
 *
 * // Access OAuth manager for custom integration
 * const oauthModule = context.getModule('wyrt_oauth');
 * const oauthManager = oauthModule.getOAuthManager();
 * ```
 *
 * @exports OAuthManager - Manages OAuth providers and authentication
 * @exports DiscordProvider - Discord OAuth2 provider implementation
 */
//----------------------------------
// Wyrt OAuth Module
//----------------------------------
// Copyright (c) 2025 LoxleyXI
//
// https://github.com/LoxleyXI/Wyrt
//----------------------------------
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see http://www.gnu.org/licenses/
//----------------------------------

import { IModule } from '../../../src/module/IModule.js';
import { ModuleContext } from '../../../src/module/ModuleContext.js';
import { OAuthManager } from './OAuthManager.js';
import { DiscordProvider } from './providers/DiscordProvider.js';
import { createOAuthRouter } from './routes/oauth.js';
import type { Express } from 'express';

interface OAuthConfig {
    jwtSecret: string;
    providers: {
        discord?: {
            enabled: boolean;
            clientId: string;
            clientSecret: string;
            callbackUrl: string;
        };
        // Future providers: google, steam, etc.
    };
}

export default class WyrtOAuthModule implements IModule {
    name = 'wyrt_oauth';
    version = '1.0.0';
    description = 'OAuth authentication module - supports Discord, Google, Steam, and other providers';
    dependencies = ['wyrt_data']; // Requires wyrt_data for database access

    private context!: ModuleContext;
    private oauthManager!: OAuthManager;
    private config!: OAuthConfig;

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;

        // Load OAuth configuration
        this.config = this.loadConfig();

        // Create OAuth manager
        this.oauthManager = new OAuthManager(this.config.jwtSecret);

        // Register enabled providers
        this.registerProviders();

        console.log(`[${this.name}] Initialized OAuth module`);
    }

    async activate(): Promise<void> {
        // Get database from wyrt_data module
        const wyrtData = this.context.getModule('wyrt_data') as any;
        if (wyrtData && typeof wyrtData.getDatabase === 'function') {
            const prisma = wyrtData.getDatabase();
            this.oauthManager.setPrisma(prisma);
        } else {
            console.warn('[wyrt_oauth] wyrt_data module not available - OAuth account creation will fail');
        }

        // Register HTTP routes
        this.registerRoutes();

        console.log(`[${this.name}] Activated - OAuth providers ready`);
    }

    async deactivate(): Promise<void> {
        // Cleanup if needed
        console.log(`[${this.name}] Deactivated`);
    }

    /**
     * Load OAuth configuration from server.json or environment variables
     */
    private loadConfig(): OAuthConfig {
        // Try to load from server.json first
        const serverConfig = (globalThis as any).config?.oauth;

        // Fallback to environment variables
        const jwtSecret = serverConfig?.jwtSecret || process.env.OAUTH_JWT_SECRET || 'wyrt-oauth-secret-change-in-production';

        const config: OAuthConfig = {
            jwtSecret,
            providers: {}
        };

        // Discord provider
        if (serverConfig?.providers?.discord?.enabled) {
            config.providers.discord = serverConfig.providers.discord;
        } else if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
            config.providers.discord = {
                enabled: true,
                clientId: process.env.DISCORD_CLIENT_ID,
                clientSecret: process.env.DISCORD_CLIENT_SECRET,
                callbackUrl: process.env.DISCORD_CALLBACK_URL || 'http://localhost:4040/oauth/discord/callback'
            };
        }

        return config;
    }

    /**
     * Register OAuth providers based on configuration
     */
    private registerProviders(): void {
        // Discord
        if (this.config.providers.discord?.enabled) {
            const discordProvider = new DiscordProvider({
                clientId: this.config.providers.discord.clientId,
                clientSecret: this.config.providers.discord.clientSecret,
                callbackUrl: this.config.providers.discord.callbackUrl,
            });
            this.oauthManager.registerProvider(discordProvider);
        }

        // Future providers: Google, Steam, etc.
    }

    /**
     * Register HTTP routes with Wyrt's HTTP server
     */
    private registerRoutes(): void {
        // Get HTTP server from context
        const httpServer = (globalThis as any).httpServer as Express;
        if (!httpServer) {
            console.warn('[wyrt_oauth] HTTP server not available - routes not registered');
            return;
        }

        // Create and register OAuth router
        const oauthRouter = createOAuthRouter(this.oauthManager);
        httpServer.use('/oauth', oauthRouter);

        console.log('[wyrt_oauth] Registered OAuth routes: /oauth/:provider, /oauth/:provider/callback');
    }

    /**
     * Get the OAuth manager (for WebSocket auth integration)
     */
    getOAuthManager(): OAuthManager {
        return this.oauthManager;
    }
}
