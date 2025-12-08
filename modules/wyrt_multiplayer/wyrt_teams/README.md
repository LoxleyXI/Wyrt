# Wyrt Teams Module

Generic team management system for multiplayer games.

## Features

- ✅ Create/remove teams dynamically
- ✅ Multiple assignment strategies (auto-balance, random, manual, preference)
- ✅ Team capacity limits
- ✅ Team-based queries (friendly fire, teammates, etc.)
- ✅ Team scoring and statistics
- ✅ Event-driven architecture

## Installation

This module is included with Wyrt. It loads automatically if present in the `modules/` directory.

## Usage

### Access Team Manager

```typescript
// In your game module
const teamManager = context.getModule('wyrt_teams').getTeamManager();

// Or via global (for request handlers)
const teamManager = (globalThis as any).wyrtTeamManager;
```

### Create Teams

```typescript
// Create a team
teamManager.createTeam({
    id: 'red',
    name: 'Red Team',
    color: '#FF0000',
    maxPlayers: 10  // Optional limit
});

teamManager.createTeam({
    id: 'blue',
    name: 'Blue Team',
    color: '#0000FF'
});
```

### Assign Players

```typescript
// Auto-balance (assigns to smallest team)
const teamId = teamManager.assignPlayer('player_123', {
    mode: 'auto-balance'
});

// Random assignment
teamManager.assignPlayer('player_456', {
    mode: 'random'
});

// Manual assignment
teamManager.assignPlayer('player_789', {
    mode: 'manual',
    preferredTeam: 'red'
});

// Preference (use preferred, fallback to auto-balance if full)
teamManager.assignPlayer('player_000', {
    mode: 'preference',
    preferredTeam: 'blue'
});
```

### Query Relationships

```typescript
// Check if players are on same team
if (teamManager.isFriendly('player_1', 'player_2')) {
    // Don't apply friendly fire
}

// Check if players are enemies
if (teamManager.isEnemy('player_1', 'player_2')) {
    // Apply damage
}

// Get player's team
const teamId = teamManager.getPlayerTeam('player_123');

// Get all teammates
const teammates = teamManager.getTeamPlayers('red');
```

### Scoring

```typescript
// Add points
teamManager.addScore('red', 1);

// Set score directly
teamManager.setScore('blue', 5);

// Reset all scores
teamManager.resetScores();
```

### Statistics

```typescript
// Get team stats
const stats = teamManager.getTeamStats('red');
// { teamId: 'red', playerCount: 5, score: 3 }

// Get all team stats
const allStats = teamManager.getAllTeamStats();

// Check if teams are balanced
if (!teamManager.areTeamsBalanced()) {
    // Teams differ by more than 1 player
}
```

### Remove Players/Teams

```typescript
// Remove player from their team
teamManager.removePlayer('player_123');

// Remove entire team (removes all players)
teamManager.removeTeam('red');
```

## Events

The module emits these events (listen via `context.events.on()`):

```typescript
// Team created
context.events.on('wyrt:teamCreated', (data) => {
    // data.team
});

// Team removed
context.events.on('wyrt:teamRemoved', (data) => {
    // data.teamId
});

// Player assigned to team
context.events.on('wyrt:playerAssigned', (data) => {
    // data.playerId, data.teamId
});

// Player removed from team
context.events.on('wyrt:playerRemoved', (data) => {
    // data.playerId, data.teamId
});
```

## Example: CTF Game

```typescript
// In your game initialization
const teamManager = context.getModule('wyrt_teams').getTeamManager();

teamManager.createTeam({
    id: 'red',
    name: 'Red Team',
    color: '#FF0000'
});

teamManager.createTeam({
    id: 'blue',
    name: 'Blue Team',
    color: '#0000FF'
});

// When player joins
const teamId = teamManager.assignPlayer(playerId, { mode: 'auto-balance' });

// When checking flag pickup
const playerTeam = teamManager.getPlayerTeam(playerId);
if (playerTeam !== flagTeam) {
    // Can pick up enemy flag
}

// When scoring
teamManager.addScore(teamId, 1);

// Check win condition
const redStats = teamManager.getTeamStats('red');
if (redStats.score >= 3) {
    // Red team wins!
}
```

## Example: Team Deathmatch

```typescript
// 4 teams, free-for-all
teamManager.createTeam({ id: 'red', name: 'Red', color: '#FF0000', maxPlayers: 5 });
teamManager.createTeam({ id: 'blue', name: 'Blue', color: '#0000FF', maxPlayers: 5 });
teamManager.createTeam({ id: 'green', name: 'Green', color: '#00FF00', maxPlayers: 5 });
teamManager.createTeam({ id: 'yellow', name: 'Yellow', color: '#FFFF00', maxPlayers: 5 });

// Players choose their team
teamManager.assignPlayer(playerId, {
    mode: 'preference',
    preferredTeam: playerPreference
});

// On kill
if (teamManager.isEnemy(killerId, victimId)) {
    const killerTeam = teamManager.getPlayerTeam(killerId);
    teamManager.addScore(killerTeam, 1);
}
```

## API Reference

### TeamManager

#### Teams
- `createTeam(config: TeamConfig): Team`
- `removeTeam(teamId: TeamId): boolean`
- `getTeam(teamId: TeamId): Team | null`
- `getAllTeams(): Team[]`

#### Players
- `assignPlayer(playerId: string, options: AssignmentOptions): TeamId`
- `removePlayer(playerId: string): boolean`
- `getPlayerTeam(playerId: string): TeamId | null`
- `getTeamPlayers(teamId: TeamId): string[]`

#### Queries
- `isFriendly(playerId1: string, playerId2: string): boolean`
- `isEnemy(playerId1: string, playerId2: string): boolean`
- `areTeamsBalanced(): boolean`

#### Scoring
- `addScore(teamId: TeamId, points: number): void`
- `setScore(teamId: TeamId, score: number): void`
- `resetScores(): void`

#### Statistics
- `getTeamStats(teamId: TeamId): TeamStats | null`
- `getAllTeamStats(): TeamStats[]`

## Type Definitions

```typescript
type TeamId = string;

interface TeamConfig {
    id: TeamId;
    name: string;
    color: string;
    maxPlayers?: number;
    minPlayers?: number;
}

interface Team extends TeamConfig {
    playerIds: Set<string>;
    score: number;
    createdAt: number;
}

type AssignmentMode = 'auto-balance' | 'random' | 'manual' | 'preference';

interface AssignmentOptions {
    mode: AssignmentMode;
    preferredTeam?: TeamId;
}

interface TeamStats {
    teamId: TeamId;
    playerCount: number;
    score: number;
    [key: string]: any;  // Extensible
}
```

## License

Part of the Wyrt MMO engine (MIT License).
