# Wyrt Authentication

---

## Database Schema

```sql
-- Shared accounts
CREATE TABLE accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,  -- bcrypt (12 rounds)
    status ENUM('active', 'banned', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

-- Per-game characters
CREATE TABLE characters (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_id INT NOT NULL,
    game_id VARCHAR(50) NOT NULL,
    name VARCHAR(20) NOT NULL,
    level INT DEFAULT 1,
    class VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (name, game_id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Game-specific data
CREATE TABLE {game}_stats (
    character_id INT PRIMARY KEY,
    hp INT, max_hp INT,
    xp INT, gold INT,
    -- game-specific fields...
    FOREIGN KEY (character_id) REFERENCES characters(id)
);
```

---

## HTTP Authentication

```javascript
// Register
POST /api/auth/register
{ "username": "player", "password": "pass123" }
→ { "token": "eyJ...", "id": 42, "username": "player" }

// Login
POST /api/auth/login
{ "username": "player", "password": "pass123" }
→ { "token": "eyJ...", "id": 42, "username": "player" }

// Verify token
GET /api/auth/verify
Authorization: Bearer {token}
→ { "success": true, "userId": 42, "username": "player" }
```

---

## WebSocket Authentication

```javascript
// 1. Connect
ws = new WebSocket('ws://localhost:8080')

// 2. Authenticate with token
ws.send({ type: 'auth', token: 'eyJ...' })
→ { type: 'auth_success', account: { id: 42, username: 'player' } }

// 3. List characters
ws.send({ type: 'listCharacters', gameId: 'my_game' })
→ { type: 'characterList', characters: [...] }

// 4. Select character
ws.send({ type: 'selectCharacter', characterId: 1, gameId: 'my_game' })
→ Triggers onCharacterSelect hook
```

---

## Character Hooks

```typescript
// In your module's initialize()
context.registerCharacterCreateHook('my_game', async (data, db) => {
    await db.query(
        "INSERT INTO my_game_stats (character_id, hp, max_hp) VALUES (?, ?, ?)",
        [data.characterId, 100, 100]
    );
});

context.registerCharacterSelectHook('my_game', async ({user, character, db}) => {
    const [stats] = await db.query(
        "SELECT * FROM my_game_stats WHERE character_id = ?",
        [character.id]
    );
    user.player.stats = stats[0];

    user.system(JSON.stringify({
        type: 'character_selected',
        character: { ...character, stats: stats[0] }
    }));
});
```

---

## Frontend Pattern

```typescript
// 1. Login via HTTP
const res = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
});
const { token } = await res.json();

// 2. Store token (optional - for auto-login)
localStorage.setItem('game_token', token);

// 3. Connect WebSocket with token
const ws = new WebSocket('ws://localhost:8080');
ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'auth', token }));
};

// 4. Handle auth success
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'auth_success') {
        // Now authenticated, can send game requests
        ws.send(JSON.stringify({ type: 'listCharacters', gameId: 'my_game' }));
    }
};
```

### Auto-Login

```typescript
// Check for stored token
const storedToken = localStorage.getItem('game_token');
if (storedToken) {
    // Verify token is still valid
    const res = await fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${storedToken}` }
    });

    if (res.ok) {
        // Token valid - connect with existing token
        connectToServer(storedToken);
    } else {
        // Token expired - clear and require login
        localStorage.removeItem('game_token');
    }
}
```

---

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens expire after 24h (configurable)
- Sessions tracked in database
- Rate limiting on all endpoints
- Account status: active/banned/suspended

---

## Testing

**Check authentication works:**
1. Register new account → Should receive token
2. Open DevTools Network tab → WebSocket frames
3. Verify `{type: 'auth', token: '...'}` sent (NOT password)
4. Verify `{type: 'auth_success'}` received
5. Check localStorage → Token stored (NOT password)

**Check auto-login:**
1. Login with "Remember Me"
2. Close browser, re-open
3. Should auto-login with stored token
4. Edit token to invalid value → Should show "Session expired"

**Check character selection:**
1. After auth, create character
2. Select character → Should load game-specific data
3. Check console → Skills/inventory loaded

---

## Configuration

```json
// config/server.json
{
  "auth": {
    "jwtSecret": "your-secret-key",
    "jwtExpiration": "24h"
  }
}
```
