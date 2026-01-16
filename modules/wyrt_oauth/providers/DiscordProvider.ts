/**
 * Discord OAuth Provider
 *
 * Implements OAuth 2.0 flow for Discord authentication
 * Docs: https://discord.com/developers/docs/topics/oauth2
 */

import { OAuthProvider, OAuthConfig, OAuthTokens, OAuthUser } from '../types/OAuthProvider.js';

export class DiscordProvider extends OAuthProvider {
    private static readonly AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize';
    private static readonly TOKEN_URL = 'https://discord.com/api/oauth2/token';
    private static readonly USER_INFO_URL = 'https://discord.com/api/users/@me';

    constructor(config: OAuthConfig) {
        super('discord', {
            ...config,
            scopes: config.scopes || ['identify', 'email']
        });
    }

    getAuthorizationUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.callbackUrl,
            response_type: 'code',
            scope: this.config.scopes!.join(' '),
            state: state,
        });

        return `${DiscordProvider.AUTHORIZE_URL}?${params.toString()}`;
    }

    async exchangeCodeForToken(code: string): Promise<OAuthTokens> {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: this.config.callbackUrl,
        });

        const response = await fetch(DiscordProvider.TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Discord token exchange failed: ${error}`);
        }

        const data = await response.json();

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
            tokenType: data.token_type,
        };
    }

    async getUserInfo(accessToken: string): Promise<OAuthUser> {
        const response = await fetch(DiscordProvider.USER_INFO_URL, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Discord user info fetch failed: ${error}`);
        }

        const data = await response.json();

        return {
            id: data.id,
            username: data.username,
            displayName: data.global_name || data.username,
            email: data.email,
            avatar: data.avatar
                ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
                : null,
            provider: 'discord',
        };
    }
}
