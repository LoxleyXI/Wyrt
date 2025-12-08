# Wyrt OAuth Module

Optional authentication module for Wyrt that adds OAuth 2.0 provider support.

## Features

- **Multiple Provider Support**: Discord, Google, Steam (extensible)
- **CSRF Protection**: Secure state tokens prevent cross-site request forgery
- **JWT Sessions**: 30-day session tokens for WebSocket authentication
- **Account Linking**: Auto-creates accounts or links existing OAuth accounts
- **Database Integration**: Stores OAuth provider info and avatar URLs

## Installation

1. **Install dependencies:**
```bash
npm install --prefix Wyrt/modules/wyrt_oauth
```

2. **Run database migration:**
```bash
mysql -u root wyrt < Wyrt/modules/wyrt_oauth/migrations/001_add_oauth_columns.sql
```

3. **Configure providers in `server.json`:**
```json
{
  "oauth": {
    "jwtSecret": "your-secret-key-change-in-production",
    "providers": {
      "discord": {
        "enabled": true,
        "clientId": "your-discord-client-id",
        "clientSecret": "your-discord-client-secret",
        "callbackUrl": "http://localhost:4040/oauth/discord/callback"
      }
    }
  }
}
```

Or use environment variables:
```bash
OAUTH_JWT_SECRET=your-secret-key
DISCORD_CLIENT_ID=your-client-id
DISCORD_CLIENT_SECRET=your-client-secret
DISCORD_CALLBACK_URL=http://localhost:4040/oauth/discord/callback
```

## Usage

### Backend (Wyrt Server)

The module automatically:
- Registers HTTP routes: `/oauth/:provider` and `/oauth/:provider/callback`
- Provides WebSocket auth handler: `oauthAuth`
- Manages JWT token generation and validation

### Frontend (React/Next.js)

#### 1. Add "Sign in with Discord" button:

```tsx
<a href="http://localhost:4040/oauth/discord?redirect=/play">
  <button>Sign in with Discord</button>
</a>
```

#### 2. Handle OAuth callback with token:

```tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useOAuthWyrtState } from '@/hooks/useOAuthWyrtState';

export default function PlayPage() {
  const router = useRouter();
  const wyrt = useOAuthWyrtState();

  useEffect(() => {
    // Check for OAuth token in URL
    const { token } = router.query;
    if (token && typeof token === 'string') {
      console.log('OAuth token received, authenticating...');
      wyrt.authenticateWithOAuth(token);

      // Clean URL
      router.replace('/play', undefined, { shallow: true });
    }
  }, [router.query]);

  if (!wyrt.isConnected) {
    return <div>Connecting to server...</div>;
  }

  if (!wyrt.isAuthenticated) {
    return <div>Authenticating...</div>;
  }

  return (
    <div>
      <h1>Welcome, {wyrt.account?.username}!</h1>
      <img src={wyrt.account?.avatar} alt="Avatar" />
      {/* Your game UI */}
    </div>
  );
}
```

#### 3. useOAuthWyrtState hook features:

```tsx
const {
  isConnected,       // WebSocket connection status
  isAuthenticated,   // OAuth authentication status
  account,           // { id, username, provider, avatar }
  authenticateWithOAuth,  // (token: string) => void
  loadCharacter,     // Load game character after auth
  player,            // Character data
  // ... other Wyrt methods
} = useOAuthWyrtState();
```

## OAuth Flow

1. **User clicks "Sign in with Discord"** → Redirects to `/oauth/discord?redirect=/play`
2. **Server generates state token** → Redirects to Discord OAuth authorize page
3. **User authorizes** → Discord redirects back to `/oauth/discord/callback?code=...&state=...`
4. **Server validates state** → Exchanges code for access token
5. **Server fetches user info** → Creates/loads account from database
6. **Server generates JWT** → Redirects to `/play?token=...`
7. **Frontend receives token** → Calls `authenticateWithOAuth(token)`
8. **WebSocket auth** → Sends `{ action: 'oauthAuth', token }` to server
9. **Server validates JWT** → Returns `{ type: 'oauth_authenticated', account }`
10. **Game loads** → User is authenticated and ready to play

## Security

- **CSRF Protection**: State tokens expire after 10 minutes
- **JWT Expiration**: Session tokens valid for 30 days
- **No Password Storage**: OAuth accounts don't require passwords
- **Provider Verification**: All tokens verified directly with OAuth providers

## Adding New Providers

1. Create provider class in `providers/`:
```typescript
import { OAuthProvider, OAuthConfig, OAuthTokens, OAuthUser } from '../types/OAuthProvider.js';

export class GoogleProvider extends OAuthProvider {
  constructor(config: OAuthConfig) {
    super('google', config);
  }

  getAuthorizationUrl(state: string): string {
    // Return Google OAuth authorize URL
  }

  async exchangeCodeForToken(code: string): Promise<OAuthTokens> {
    // Exchange code for Google access token
  }

  async getUserInfo(accessToken: string): Promise<OAuthUser> {
    // Fetch Google user profile
  }
}
```

2. Register in `index.ts`:
```typescript
if (this.config.providers.google?.enabled) {
  const googleProvider = new GoogleProvider({ ... });
  this.oauthManager.registerProvider(googleProvider);
}
```

3. Add to `server.json`:
```json
{
  "oauth": {
    "providers": {
      "google": {
        "enabled": true,
        "clientId": "...",
        "clientSecret": "...",
        "callbackUrl": "http://localhost:4040/oauth/google/callback"
      }
    }
  }
}
```

## Database Schema

```sql
ALTER TABLE accounts
ADD COLUMN oauth_provider VARCHAR(50) NULL,
ADD COLUMN oauth_id VARCHAR(255) NULL,
ADD COLUMN oauth_avatar VARCHAR(512) NULL,
ADD INDEX idx_oauth_lookup (oauth_provider, oauth_id);
```

- `oauth_provider`: 'discord', 'google', 'steam', etc.
- `oauth_id`: Provider's unique user ID
- `oauth_avatar`: Avatar URL from provider
- Index for fast OAuth lookups

## Troubleshooting

### Token not working

Check JWT secret matches between server and client:
```bash
# Server logs
[OAuth] Token verification failed: jwt malformed
```

Solution: Ensure `OAUTH_JWT_SECRET` is consistent.

### State validation fails

State tokens expire after 10 minutes. User may have abandoned flow and returned later.

### Account creation fails

Check database migration ran successfully:
```bash
mysql -u root wyrt -e "SHOW COLUMNS FROM accounts LIKE 'oauth_%'"
```

### WebSocket auth fails

Ensure wyrt_oauth module is loaded and request handler registered:
```bash
# Server logs should show:
[wyrt_oauth] Registered OAuth routes
+handler: wyrt_oauth/requests/oauthAuth
```

## Module Architecture

```
wyrt_oauth/
├── index.ts                  # Main module (IModule)
├── OAuthManager.ts           # Provider + session management
├── package.json              # Dependencies (jsonwebtoken)
├── types/
│   └── OAuthProvider.ts      # Abstract provider interface
├── providers/
│   └── DiscordProvider.ts    # Discord OAuth implementation
├── routes/
│   └── oauth.ts              # HTTP routes
├── requests/
│   └── oauthAuth.ts          # WebSocket auth handler
└── migrations/
    └── 001_add_oauth_columns.sql
```

## License

ISC
