/**
 * OAuth Provider Interface
 *
 * Defines the contract for OAuth providers (Discord, Google, Steam, etc.)
 */

export interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    scopes?: string[];
}

export interface OAuthUser {
    id: string;           // Provider's user ID
    username: string;     // Login username (e.g., Discord username)
    displayName?: string; // Display name (e.g., Discord global_name)
    email?: string;       // Email (if provided by provider)
    avatar?: string;      // Avatar URL (if provided)
    provider: string;     // Provider name (discord, google, etc.)
}

export interface OAuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType?: string;
}

export abstract class OAuthProvider {
    protected config: OAuthConfig;
    protected providerName: string;

    constructor(providerName: string, config: OAuthConfig) {
        this.providerName = providerName;
        this.config = config;
    }

    /**
     * Get the authorization URL to redirect the user to
     * @param state - CSRF protection state parameter
     */
    abstract getAuthorizationUrl(state: string): string;

    /**
     * Exchange authorization code for access token
     * @param code - Authorization code from OAuth callback
     */
    abstract exchangeCodeForToken(code: string): Promise<OAuthTokens>;

    /**
     * Get user information from the provider
     * @param accessToken - Access token from exchangeCodeForToken
     */
    abstract getUserInfo(accessToken: string): Promise<OAuthUser>;

    /**
     * Complete OAuth flow: exchange code and get user info
     * @param code - Authorization code from OAuth callback
     */
    async authenticate(code: string): Promise<OAuthUser> {
        const tokens = await this.exchangeCodeForToken(code);
        const user = await this.getUserInfo(tokens.accessToken);
        return user;
    }

    /**
     * Get provider name
     */
    getName(): string {
        return this.providerName;
    }
}
