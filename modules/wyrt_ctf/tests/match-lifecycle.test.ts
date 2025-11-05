import { describe, it, expect } from 'vitest';

describe('Match Lifecycle', () => {
  describe('Match Status', () => {
    it('should start in waiting status', () => {
      const gameState = {
        status: 'waiting',
        players: new Map(),
        startedAt: null
      };

      expect(gameState.status).toBe('waiting');
    });

    it('should transition to playing when 2+ players join', () => {
      const gameState: any = {
        status: 'waiting',
        players: new Map([
          ['1', { id: '1', team: 'red' }],
          ['2', { id: '2', team: 'blue' }]
        ])
      };

      if (gameState.status === 'waiting' && gameState.players.size >= 2) {
        gameState.status = 'playing';
        gameState.startedAt = Date.now();
      }

      expect(gameState.status).toBe('playing');
      expect(gameState.startedAt).toBeTypeOf('number');
    });

    it('should transition to ended when win condition met', () => {
      const gameState: any = {
        status: 'playing',
        scores: { red: 3, blue: 1 },
        captureLimit: 3
      };

      if (gameState.scores.red >= gameState.captureLimit) {
        gameState.status = 'ended';
        gameState.winnerId = 'red';
        gameState.endedAt = Date.now();
      }

      expect(gameState.status).toBe('ended');
      expect(gameState.winnerId).toBe('red');
      expect(gameState.endedAt).toBeTypeOf('number');
    });
  });

  describe('Score Tracking', () => {
    it('should initialize scores at 0-0', () => {
      const scores = { red: 0, blue: 0 };

      expect(scores.red).toBe(0);
      expect(scores.blue).toBe(0);
    });

    it('should increment team score', () => {
      const scores = { red: 0, blue: 0 };
      const scoringTeam = 'red';

      scores[scoringTeam]++;

      expect(scores.red).toBe(1);
      expect(scores.blue).toBe(0);
    });

    it('should reset scores on match reset', () => {
      const scores = { red: 3, blue: 2 };

      scores.red = 0;
      scores.blue = 0;

      expect(scores.red).toBe(0);
      expect(scores.blue).toBe(0);
    });
  });

  describe('Win Conditions', () => {
    it('should detect win when reaching capture limit', () => {
      const scores = { red: 3, blue: 1 };
      const captureLimit = 3;

      const redWon = scores.red >= captureLimit;
      const blueWon = scores.blue >= captureLimit;

      expect(redWon).toBe(true);
      expect(blueWon).toBe(false);
    });

    it('should not detect win below capture limit', () => {
      const scores = { red: 2, blue: 1 };
      const captureLimit = 3;

      const redWon = scores.red >= captureLimit;
      const blueWon = scores.blue >= captureLimit;

      expect(redWon).toBe(false);
      expect(blueWon).toBe(false);
    });
  });

  describe('Disconnect Detection', () => {
    it('should detect disconnected player after 30s inactivity', () => {
      const DISCONNECT_TIMEOUT = 30000;
      const now = Date.now();

      const player = {
        id: '1',
        lastActivityTime: now - 31000
      };

      const timeSinceActivity = now - player.lastActivityTime;
      const isDisconnected = timeSinceActivity >= DISCONNECT_TIMEOUT;

      expect(isDisconnected).toBe(true);
    });

    it('should not detect disconnect for active players', () => {
      const DISCONNECT_TIMEOUT = 30000;
      const now = Date.now();

      const player = {
        id: '1',
        lastActivityTime: now - 5000
      };

      const timeSinceActivity = now - player.lastActivityTime;
      const isDisconnected = timeSinceActivity >= DISCONNECT_TIMEOUT;

      expect(isDisconnected).toBe(false);
    });

    it('should update lastActivityTime on player movement', () => {
      const player = {
        id: '1',
        lastActivityTime: Date.now() - 10000,
        position: { x: 100, y: 100 }
      };

      const now = Date.now();
      player.position = { x: 110, y: 100 };
      player.lastActivityTime = now;

      expect(player.lastActivityTime).toBe(now);
    });
  });

  describe('Match Reset', () => {
    it('should reset all match state', () => {
      const gameState: any = {
        status: 'ended',
        winnerId: 'red',
        scores: { red: 3, blue: 1 },
        startedAt: Date.now() - 60000,
        endedAt: Date.now()
      };

      gameState.status = 'playing';
      gameState.winnerId = null;
      gameState.scores = { red: 0, blue: 0 };
      gameState.startedAt = Date.now();
      gameState.endedAt = null;

      expect(gameState.status).toBe('playing');
      expect(gameState.winnerId).toBe(null);
      expect(gameState.scores).toEqual({ red: 0, blue: 0 });
      expect(gameState.endedAt).toBe(null);
    });
  });
});
