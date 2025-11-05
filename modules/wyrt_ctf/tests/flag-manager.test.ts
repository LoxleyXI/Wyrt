import { describe, it, expect, beforeEach } from 'vitest';
import { FlagManager } from '../systems/FlagManager.js';

describe('FlagManager', () => {
  let flagManager: FlagManager;
  let flags: any;
  let scores: any;

  beforeEach(() => {
    flags = {
      red: {
        state: 'at_base',
        position: { x: 128, y: 128 },
        carriedBy: null,
        droppedAt: null
      },
      blue: {
        state: 'at_base',
        position: { x: 672, y: 464 },
        carriedBy: null,
        droppedAt: null
      }
    };

    scores = { red: 0, blue: 0 };
    flagManager = new FlagManager(flags, scores);
  });

  describe('attemptPickup', () => {
    it('should allow enemy to pick up flag from base', () => {
      const player = {
        id: '1',
        team: 'red' as const,
        position: { x: 672, y: 464 },
        carryingFlag: false
      };

      const result = flagManager.attemptPickup(player as any, 'blue');

      expect(result.success).toBe(true);
      expect(flags.blue.state).toBe('carried');
      expect(flags.blue.carriedBy).toBe('1');
      expect(player.carryingFlag).toBe(true);
    });

    it('should not allow picking up own team flag from base', () => {
      const player = {
        id: '1',
        team: 'red' as const,
        position: { x: 128, y: 128 },
        carryingFlag: false
      };

      const result = flagManager.attemptPickup(player as any, 'red');

      expect(result.success).toBe(false);
      expect(result.message).toBe("Can't pick up your own flag");
    });

    it('should allow returning own dropped flag', () => {
      flags.red.state = 'dropped';
      flags.red.position = { x: 200, y: 200 };

      const player = {
        id: '1',
        team: 'red' as const,
        position: { x: 200, y: 200 },
        carryingFlag: false
      };

      const result = flagManager.attemptPickup(player as any, 'red');

      expect(result.success).toBe(true);
      expect(flags.red.state).toBe('at_base');
      expect(flags.red.position).toEqual({ x: 128, y: 128 });
    });

    it('should not allow pickup when already carrying flag', () => {
      const player = {
        id: '1',
        team: 'red' as const,
        position: { x: 672, y: 464 },
        carryingFlag: true
      };

      const result = flagManager.attemptPickup(player as any, 'blue');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Already carrying a flag');
    });

    it('should not allow pickup when too far away', () => {
      const player = {
        id: '1',
        team: 'red' as const,
        position: { x: 600, y: 400 },
        carryingFlag: false
      };

      const result = flagManager.attemptPickup(player as any, 'blue');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Too far from flag');
    });
  });

  describe('dropFlag', () => {
    it('should drop flag with random offset', () => {
      flags.blue.state = 'carried';
      flags.blue.carriedBy = '1';

      const dropPosition = { x: 400, y: 300 };
      const droppedTeam = flagManager.dropFlag('1', dropPosition);

      expect(droppedTeam).toBe('blue');
      expect(flags.blue.state).toBe('dropped');
      expect(flags.blue.carriedBy).toBe(null);

      const distance = Math.hypot(
        flags.blue.position.x - dropPosition.x,
        flags.blue.position.y - dropPosition.y
      );
      expect(distance).toBeGreaterThanOrEqual(40);
      expect(distance).toBeLessThanOrEqual(60);
    });

    it('should return null when player not carrying flag', () => {
      const result = flagManager.dropFlag('1', { x: 400, y: 300 });
      expect(result).toBe(null);
    });
  });

  describe('attemptCapture', () => {
    it('should capture flag and increment score', () => {
      const player = {
        id: '1',
        team: 'red' as const,
        position: { x: 128, y: 128 },
        carryingFlag: true
      };

      flags.blue.state = 'carried';
      flags.blue.carriedBy = '1';

      const result = flagManager.attemptCapture(player as any, { x: 128, y: 128 }, 3);

      expect(result.success).toBe(true);
      expect(result.scored).toBe(true);
      expect(result.won).toBe(false);
      expect(scores.red).toBe(1);
      expect(flags.blue.state).toBe('at_base');
      expect(player.carryingFlag).toBe(false);
    });

    it('should detect win condition', () => {
      scores.red = 2;

      const player = {
        id: '1',
        team: 'red' as const,
        position: { x: 128, y: 128 },
        carryingFlag: true
      };

      flags.blue.state = 'carried';
      flags.blue.carriedBy = '1';

      const result = flagManager.attemptCapture(player as any, { x: 128, y: 128 }, 3);

      expect(result.won).toBe(true);
      expect(scores.red).toBe(3);
    });

    it('should not allow capture when own flag is not at base', () => {
      flags.red.state = 'carried';
      flags.red.carriedBy = '2';

      const player = {
        id: '1',
        team: 'red' as const,
        position: { x: 128, y: 128 },
        carryingFlag: true
      };

      const result = flagManager.attemptCapture(player as any, { x: 128, y: 128 }, 3);

      expect(result.success).toBe(false);
      expect(result.scored).toBe(false);
      expect(result.message).toBe('Your flag must be at base to capture!');
    });
  });

  describe('resetScores and resetFlags', () => {
    it('should reset scores to 0-0', () => {
      scores.red = 5;
      scores.blue = 3;

      flagManager.resetScores();

      expect(scores.red).toBe(0);
      expect(scores.blue).toBe(0);
    });

    it('should reset flags to base positions', () => {
      flags.red.state = 'carried';
      flags.red.carriedBy = '1';
      flags.blue.state = 'dropped';
      flags.blue.position = { x: 400, y: 400 };

      flagManager.resetFlags({ x: 128, y: 128 }, { x: 672, y: 464 });

      expect(flags.red.state).toBe('at_base');
      expect(flags.red.carriedBy).toBe(null);
      expect(flags.red.position).toEqual({ x: 128, y: 128 });

      expect(flags.blue.state).toBe('at_base');
      expect(flags.blue.carriedBy).toBe(null);
      expect(flags.blue.position).toEqual({ x: 672, y: 464 });
    });
  });
});
