import { create } from 'zustand';

// Types matching backend CTFTypes
export type Team = 'red' | 'blue';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type FlagState = 'at_base' | 'carried' | 'dropped';
export type WeaponType = 'stun_gun' | 'speed_boost' | 'shield';
export type BoostType = 'speed' | 'shield';

export interface Position {
  x: number;
  y: number;
}

export interface CTFPlayer {
  id: string;
  name: string;
  team: Team;
  position: Position;
  direction: Direction;
  carryingFlag: boolean;
  stunned: boolean;
  stunnedUntil: number | null;
  respawning: boolean;
  respawnAt: number | null;
  weapon: WeaponType | null;
  weaponCharges: number;
  activeBoost: BoostType | null;
  boostEndsAt: number | null;
  hasSpeed?: boolean;
  hasShield?: boolean;
  lastActivityTime: number;
}

export interface Flag {
  team: Team;
  state: FlagState;
  position: Position;
  carriedBy: string | null;
  droppedAt: number | null;
}

export interface WeaponSpawn {
  id: string;
  type: WeaponType;
  spawnPosition: Position;
  respawnTime: number;
  pickedUpBy: string | null;
  respawnAt: number | null;
}

export interface Projectile {
  id: string;
  playerId: string;
  team: Team;
  position: Position;
  velocity: { x: number; y: number };
  createdAt: number;
}

export interface Score {
  red: number;
  blue: number;
}

export interface GameState {
  matchId: string;
  status: 'waiting' | 'playing' | 'ended';
  scores: Score;
  captureLimit: number;
  flags: {
    red: Flag;
    blue: Flag;
  };
  players: CTFPlayer[];
  weapons: WeaponSpawn[];
  projectiles: Projectile[];
  startedAt: number | null;
  endedAt: number | null;
  winnerId: Team | null;
}

export interface MapConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  bases: {
    red: {
      team: Team;
      position: Position;
      spawnPoints: Position[];
    };
    blue: {
      team: Team;
      position: Position;
      spawnPoints: Position[];
    };
  };
  weaponSpawns: Array<{
    position: Position;
    type: WeaponType;
  }>;
  collisionLayer: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

interface GameStoreState {
  // Player state
  playerName: string | null;
  playerId: string | null;
  myPlayer: CTFPlayer | null;

  // Game state
  gameState: GameState | null;
  mapConfig: MapConfig | null;

  // Connection
  connected: boolean;
  lastServerMessageTime: number;
  disconnected: boolean;

  // Actions
  updateLastServerMessageTime: () => void;
  setDisconnected: (disconnected: boolean) => void;
  setPlayerName: (name: string) => void;
  setPlayerId: (id: string) => void;
  setMyPlayer: (player: CTFPlayer) => void;
  setGameState: (state: GameState) => void;
  setMapConfig: (config: MapConfig) => void;
  setConnected: (connected: boolean) => void;
  addPlayer: (player: CTFPlayer) => void;
  updatePlayer: (playerId: string, updates: Partial<CTFPlayer>) => void;
  addProjectile: (projectile: Projectile) => void;
  removeProjectile: (projectileId: string) => void;
  updateFlag: (team: Team, updates: Partial<Flag>) => void;
  updateScores: (scores: Score) => void;
  reset: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  // Initial state
  playerName: null,
  playerId: null,
  myPlayer: null,
  gameState: null,
  mapConfig: null,
  connected: false,
  lastServerMessageTime: Date.now(),
  disconnected: false,

  // Actions
  updateLastServerMessageTime: () => set({ lastServerMessageTime: Date.now() }),
  setDisconnected: (disconnected) => set({ disconnected }),
  setPlayerName: (name) => set({ playerName: name }),
  setPlayerId: (id) => set({ playerId: id }),
  setMyPlayer: (player) => set({ myPlayer: player }),
  setGameState: (state) => set({ gameState: state }),
  setMapConfig: (config) => set({ mapConfig: config }),
  setConnected: (connected) => set({ connected }),

  addPlayer: (player) =>
    set((state) => {
      if (!state.gameState) return state;

      // Don't add if player already exists
      if (state.gameState.players.some((p) => p.id === player.id)) {
        return state;
      }

      return {
        gameState: {
          ...state.gameState,
          players: [...state.gameState.players, player],
        },
      };
    }),

  updatePlayer: (playerId, updates) =>
    set((state) => {
      if (!state.gameState) return state;

      const players = state.gameState.players.map((p) =>
        p.id === playerId ? { ...p, ...updates } : p
      );

      // Update myPlayer if it's us
      const myPlayer = state.playerId === playerId && state.myPlayer
        ? { ...state.myPlayer, ...updates }
        : state.myPlayer;

      return {
        gameState: { ...state.gameState, players },
        myPlayer,
      };
    }),

  addProjectile: (projectile) =>
    set((state) => {
      if (!state.gameState) return state;
      return {
        gameState: {
          ...state.gameState,
          projectiles: [...state.gameState.projectiles, projectile],
        },
      };
    }),

  removeProjectile: (projectileId) =>
    set((state) => {
      if (!state.gameState) return state;
      return {
        gameState: {
          ...state.gameState,
          projectiles: state.gameState.projectiles.filter((p) => p.id !== projectileId),
        },
      };
    }),

  updateFlag: (team, updates) =>
    set((state) => {
      if (!state.gameState) return state;
      return {
        gameState: {
          ...state.gameState,
          flags: {
            ...state.gameState.flags,
            [team]: { ...state.gameState.flags[team], ...updates },
          },
        },
      };
    }),

  updateScores: (scores) =>
    set((state) => {
      if (!state.gameState) return state;
      return {
        gameState: {
          ...state.gameState,
          scores,
        },
      };
    }),

  reset: () =>
    set({
      playerName: null,
      playerId: null,
      myPlayer: null,
      gameState: null,
      mapConfig: null,
      connected: false,
    }),
}));
