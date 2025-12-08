import { describe, it, expect, beforeEach } from 'vitest';
import { TeamManager } from '../systems/TeamManager';
import { EventEmitter } from 'events';

describe('TeamManager', () => {
  let teamManager: TeamManager;
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      events: new EventEmitter()
    };
    teamManager = new TeamManager(mockContext);
  });

  describe('Team Creation', () => {
    it('should create a team with basic config', () => {
      const team = teamManager.createTeam({
        id: 'red',
        name: 'Red Team',
        color: '#FF0000'
      });

      expect(team.id).toBe('red');
      expect(team.name).toBe('Red Team');
      expect(team.color).toBe('#FF0000');
      expect(team.score).toBe(0);
      expect(team.playerIds.size).toBe(0);
    });

    it('should create a team with max players limit', () => {
      const team = teamManager.createTeam({
        id: 'blue',
        name: 'Blue Team',
        color: '#0000FF',
        maxPlayers: 5
      });

      expect(team.maxPlayers).toBe(5);
    });

    it('should throw error when creating duplicate team', () => {
      teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000' });

      expect(() => {
        teamManager.createTeam({ id: 'red', name: 'Red Team 2', color: '#FF0000' });
      }).toThrow('Team red already exists');
    });

    it('should emit teamCreated event', () => {
      let emittedTeam: any;
      mockContext.events.on('wyrt:teamCreated', (data: any) => {
        emittedTeam = data.team;
      });

      const team = teamManager.createTeam({
        id: 'green',
        name: 'Green Team',
        color: '#00FF00'
      });

      expect(emittedTeam).toBeDefined();
      expect(emittedTeam.id).toBe('green');
    });
  });

  describe('Team Removal', () => {
    beforeEach(() => {
      teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000' });
      teamManager.assignPlayer('player1', { mode: 'manual', preferredTeam: 'red' });
      teamManager.assignPlayer('player2', { mode: 'manual', preferredTeam: 'red' });
    });

    it('should remove a team', () => {
      const result = teamManager.removeTeam('red');
      expect(result).toBe(true);
    });

    it('should return false when removing non-existent team', () => {
      const result = teamManager.removeTeam('nonexistent');
      expect(result).toBe(false);
    });

    it('should remove all players from team', () => {
      teamManager.removeTeam('red');
      expect(teamManager.getPlayerTeam('player1')).toBeNull();
      expect(teamManager.getPlayerTeam('player2')).toBeNull();
    });

    it('should emit teamRemoved event', () => {
      let emittedTeamId: string | undefined;
      mockContext.events.on('wyrt:teamRemoved', (data: any) => {
        emittedTeamId = data.teamId;
      });

      teamManager.removeTeam('red');
      expect(emittedTeamId).toBe('red');
    });
  });

  describe('Player Assignment - Auto Balance', () => {
    beforeEach(() => {
      teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000' });
      teamManager.createTeam({ id: 'blue', name: 'Blue Team', color: '#0000FF' });
    });

    it('should assign player to smallest team', () => {
      teamManager.assignPlayer('player1', { mode: 'manual', preferredTeam: 'red' });
      const teamId = teamManager.assignPlayer('player2', { mode: 'auto-balance' });

      expect(teamId).toBe('blue');
    });

    it('should distribute players evenly', () => {
      const team1 = teamManager.assignPlayer('player1', { mode: 'auto-balance' });
      const team2 = teamManager.assignPlayer('player2', { mode: 'auto-balance' });
      const team3 = teamManager.assignPlayer('player3', { mode: 'auto-balance' });
      const team4 = teamManager.assignPlayer('player4', { mode: 'auto-balance' });

      const redCount = teamManager.getTeamPlayers('red').length;
      const blueCount = teamManager.getTeamPlayers('blue').length;

      expect(Math.abs(redCount - blueCount)).toBeLessThanOrEqual(1);
    });

    it('should emit playerAssigned event', () => {
      let assignedData: any;
      mockContext.events.on('wyrt:playerAssigned', (data: any) => {
        assignedData = data;
      });

      teamManager.assignPlayer('player1', { mode: 'auto-balance' });

      expect(assignedData.playerId).toBe('player1');
      expect(['red', 'blue']).toContain(assignedData.teamId);
    });
  });

  describe('Player Assignment - Random', () => {
    beforeEach(() => {
      teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000' });
      teamManager.createTeam({ id: 'blue', name: 'Blue Team', color: '#0000FF' });
    });

    it('should assign player to random team', () => {
      const teamId = teamManager.assignPlayer('player1', { mode: 'random' });
      expect(['red', 'blue']).toContain(teamId);
    });
  });

  describe('Player Assignment - Manual', () => {
    beforeEach(() => {
      teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000' });
      teamManager.createTeam({ id: 'blue', name: 'Blue Team', color: '#0000FF' });
    });

    it('should assign player to preferred team', () => {
      const teamId = teamManager.assignPlayer('player1', {
        mode: 'manual',
        preferredTeam: 'red'
      });

      expect(teamId).toBe('red');
    });

    it('should throw error if preferred team not specified', () => {
      expect(() => {
        teamManager.assignPlayer('player1', { mode: 'manual' } as any);
      }).toThrow('preferredTeam required for manual/preference mode');
    });

    it('should throw error if preferred team does not exist', () => {
      expect(() => {
        teamManager.assignPlayer('player1', {
          mode: 'manual',
          preferredTeam: 'nonexistent'
        });
      }).toThrow('Team nonexistent does not exist');
    });

    it('should throw error if team is full', () => {
      teamManager.createTeam({
        id: 'green',
        name: 'Green Team',
        color: '#00FF00',
        maxPlayers: 1
      });

      teamManager.assignPlayer('player1', { mode: 'manual', preferredTeam: 'green' });

      expect(() => {
        teamManager.assignPlayer('player2', { mode: 'manual', preferredTeam: 'green' });
      }).toThrow('Team green is full');
    });
  });

  describe('Player Assignment - Preference', () => {
    beforeEach(() => {
      teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000', maxPlayers: 2 });
      teamManager.createTeam({ id: 'blue', name: 'Blue Team', color: '#0000FF' });
    });

    it('should assign to preferred team if available', () => {
      const teamId = teamManager.assignPlayer('player1', {
        mode: 'preference',
        preferredTeam: 'red'
      });

      expect(teamId).toBe('red');
    });

    it('should fallback to auto-balance if preferred team is full', () => {
      teamManager.assignPlayer('player1', { mode: 'manual', preferredTeam: 'red' });
      teamManager.assignPlayer('player2', { mode: 'manual', preferredTeam: 'red' });

      const teamId = teamManager.assignPlayer('player3', {
        mode: 'preference',
        preferredTeam: 'red'
      });

      expect(teamId).toBe('blue');
    });
  });

  describe('Player Removal', () => {
    beforeEach(() => {
      teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000' });
      teamManager.assignPlayer('player1', { mode: 'manual', preferredTeam: 'red' });
    });

    it('should remove player from team', () => {
      const result = teamManager.removePlayer('player1');
      expect(result).toBe(true);
      expect(teamManager.getPlayerTeam('player1')).toBeNull();
    });

    it('should return false when removing non-existent player', () => {
      const result = teamManager.removePlayer('nonexistent');
      expect(result).toBe(false);
    });

    it('should emit playerRemoved event', () => {
      let removedData: any;
      mockContext.events.on('wyrt:playerRemoved', (data: any) => {
        removedData = data;
      });

      teamManager.removePlayer('player1');

      expect(removedData.playerId).toBe('player1');
      expect(removedData.teamId).toBe('red');
    });
  });

  describe('Relationship Queries', () => {
    beforeEach(() => {
      teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000' });
      teamManager.createTeam({ id: 'blue', name: 'Blue Team', color: '#0000FF' });
      teamManager.assignPlayer('player1', { mode: 'manual', preferredTeam: 'red' });
      teamManager.assignPlayer('player2', { mode: 'manual', preferredTeam: 'red' });
      teamManager.assignPlayer('player3', { mode: 'manual', preferredTeam: 'blue' });
    });

    it('should identify friendly players', () => {
      expect(teamManager.isFriendly('player1', 'player2')).toBe(true);
    });

    it('should identify enemy players', () => {
      expect(teamManager.isEnemy('player1', 'player3')).toBe(true);
    });

    it('should return false for friendly check with enemy', () => {
      expect(teamManager.isFriendly('player1', 'player3')).toBe(false);
    });

    it('should return false for enemy check with teammate', () => {
      expect(teamManager.isEnemy('player1', 'player2')).toBe(false);
    });

    it('should handle players not on any team', () => {
      expect(teamManager.isFriendly('player1', 'player4')).toBe(false);
      expect(teamManager.isEnemy('player1', 'player4')).toBe(false);
    });
  });

  describe('Team Queries', () => {
    beforeEach(() => {
      teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000' });
      teamManager.assignPlayer('player1', { mode: 'manual', preferredTeam: 'red' });
      teamManager.assignPlayer('player2', { mode: 'manual', preferredTeam: 'red' });
    });

    it('should get player team', () => {
      expect(teamManager.getPlayerTeam('player1')).toBe('red');
    });

    it('should return null for player not on team', () => {
      expect(teamManager.getPlayerTeam('player3')).toBeNull();
    });

    it('should get all players in team', () => {
      const players = teamManager.getTeamPlayers('red');
      expect(players).toContain('player1');
      expect(players).toContain('player2');
      expect(players.length).toBe(2);
    });

    it('should return empty array for team with no players', () => {
      teamManager.createTeam({ id: 'blue', name: 'Blue Team', color: '#0000FF' });
      const players = teamManager.getTeamPlayers('blue');
      expect(players).toEqual([]);
    });
  });

  describe('Scoring', () => {
    beforeEach(() => {
      teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000' });
      teamManager.createTeam({ id: 'blue', name: 'Blue Team', color: '#0000FF' });
    });

    it('should add score to team', () => {
      teamManager.addScore('red', 5);
      const stats = teamManager.getTeamStats('red');
      expect(stats?.score).toBe(5);
    });

    it('should accumulate score', () => {
      teamManager.addScore('red', 3);
      teamManager.addScore('red', 2);
      const stats = teamManager.getTeamStats('red');
      expect(stats?.score).toBe(5);
    });

    it('should set score directly', () => {
      teamManager.addScore('red', 10);
      teamManager.setScore('red', 3);
      const stats = teamManager.getTeamStats('red');
      expect(stats?.score).toBe(3);
    });

    it('should reset all scores', () => {
      teamManager.addScore('red', 5);
      teamManager.addScore('blue', 3);
      teamManager.resetScores();

      expect(teamManager.getTeamStats('red')?.score).toBe(0);
      expect(teamManager.getTeamStats('blue')?.score).toBe(0);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000' });
      teamManager.assignPlayer('player1', { mode: 'manual', preferredTeam: 'red' });
      teamManager.assignPlayer('player2', { mode: 'manual', preferredTeam: 'red' });
      teamManager.addScore('red', 5);
    });

    it('should get team statistics', () => {
      const stats = teamManager.getTeamStats('red');

      expect(stats).toBeDefined();
      expect(stats?.teamId).toBe('red');
      expect(stats?.playerCount).toBe(2);
      expect(stats?.score).toBe(5);
    });

    it('should return null for non-existent team', () => {
      const stats = teamManager.getTeamStats('nonexistent');
      expect(stats).toBeNull();
    });

    it('should get all team statistics', () => {
      teamManager.createTeam({ id: 'blue', name: 'Blue Team', color: '#0000FF' });
      teamManager.assignPlayer('player3', { mode: 'manual', preferredTeam: 'blue' });

      const allStats = teamManager.getAllTeamStats();

      expect(allStats.length).toBe(2);
      expect(allStats.find(s => s.teamId === 'red')?.playerCount).toBe(2);
      expect(allStats.find(s => s.teamId === 'blue')?.playerCount).toBe(1);
    });
  });

  describe('Team Balance', () => {
    beforeEach(() => {
      teamManager.createTeam({ id: 'red', name: 'Red Team', color: '#FF0000' });
      teamManager.createTeam({ id: 'blue', name: 'Blue Team', color: '#0000FF' });
    });

    it('should report balanced teams', () => {
      teamManager.assignPlayer('player1', { mode: 'manual', preferredTeam: 'red' });
      teamManager.assignPlayer('player2', { mode: 'manual', preferredTeam: 'blue' });

      expect(teamManager.areTeamsBalanced()).toBe(true);
    });

    it('should report balanced teams with 1 player difference', () => {
      teamManager.assignPlayer('player1', { mode: 'manual', preferredTeam: 'red' });
      teamManager.assignPlayer('player2', { mode: 'manual', preferredTeam: 'red' });
      teamManager.assignPlayer('player3', { mode: 'manual', preferredTeam: 'blue' });

      expect(teamManager.areTeamsBalanced()).toBe(true);
    });

    it('should report unbalanced teams', () => {
      teamManager.assignPlayer('player1', { mode: 'manual', preferredTeam: 'red' });
      teamManager.assignPlayer('player2', { mode: 'manual', preferredTeam: 'red' });
      teamManager.assignPlayer('player3', { mode: 'manual', preferredTeam: 'red' });
      teamManager.assignPlayer('player4', { mode: 'manual', preferredTeam: 'blue' });

      expect(teamManager.areTeamsBalanced()).toBe(false);
    });
  });
});
