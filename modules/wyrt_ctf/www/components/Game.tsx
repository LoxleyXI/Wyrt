"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import dynamic from "next/dynamic";
import { getSocket } from "@/lib/ctfSocket";
import GameUI from "./GameUI";
import DisconnectModal from "./DisconnectModal";

// Dynamically import Phaser to avoid SSR issues
const PhaserGame = dynamic(() => import("./PhaserGame"), { ssr: false });

export default function Game() {
  const {
    playerName,
    setPlayerId,
    setMyPlayer,
    setGameState,
    setMapConfig,
    addPlayer,
    updatePlayer,
    addProjectile,
    updateFlag,
    updateScores,
    updateLastServerMessageTime,
    setDisconnected,
  } = useGameStore();

  useEffect(() => {
    const socket = getSocket();

    const unsubscribe = socket.onMessage((message) => {
      updateLastServerMessageTime();

      switch (message.type) {
        case "gameState":
          setPlayerId(message.player.id);
          setMyPlayer(message.player);
          setGameState(message.gameState);
          setMapConfig(message.mapConfig);
          break;

        case "playerMoved":
          updatePlayer(message.playerId, {
            position: message.position,
            direction: message.direction,
          });
          break;

        case "playerJoined":
          if (message.player) {
            addPlayer(message.player);
          }
          break;

        case "flagPickedUp":
          updateFlag(message.flagTeam, {
            state: "carried",
            carriedBy: message.playerId,
            position: message.position,
          });
          updatePlayer(message.playerId, { carryingFlag: true });
          break;

        case "flagDropped":
          updateFlag(message.flagTeam, {
            state: "dropped",
            carriedBy: null,
            position: message.position,
            droppedAt: message.droppedAt,
          });
          if (message.playerId) {
            updatePlayer(message.playerId, { carryingFlag: false });
          }
          break;

        case "flagCaptured":
          updateFlag(
            message.team === "red" ? "blue" : "red",
            {
              state: "at_base",
              carriedBy: null,
            }
          );
          updatePlayer(message.playerId, { carryingFlag: false });
          updateScores(message.newScore);
          break;

        case "weaponPickedUp":
          if (message.weaponType === 'stun_gun') {
            updatePlayer(message.playerId, {
              weapon: message.weaponType,
              weaponCharges: 3,
            });
          }

          const currentState = useGameStore.getState().gameState;
          if (currentState) {
            const updatedWeapons = currentState.weapons.map(w =>
              w.id === message.weaponId
                ? { ...w, pickedUpBy: message.playerId, respawnAt: Date.now() + 15000 }
                : w
            );
            setGameState({ ...currentState, weapons: updatedWeapons });
          }
          break;

        case "weaponRemoved":
          updatePlayer(message.playerId, {
            weapon: null,
            weaponCharges: 0,
          });
          break;

        case "weaponRespawned":
          const respawnState = useGameStore.getState().gameState;
          if (respawnState) {
            const updatedWeaponsRespawn = respawnState.weapons.map(w =>
              w.id === message.weaponId
                ? { ...w, pickedUpBy: null, respawnAt: null, spawnPosition: message.position }
                : w
            );
            setGameState({ ...respawnState, weapons: updatedWeaponsRespawn });
          }
          break;

        case "projectileFired":
          addProjectile({
            id: message.projectileId,
            playerId: message.playerId,
            team: message.team || "red",
            position: message.position,
            velocity: message.velocity,
            createdAt: Date.now(),
          });
          break;

        case "projectileHitWall":
          const { removeProjectile } = useGameStore.getState();
          removeProjectile(message.projectileId);

          const gameScene = (window as any).gameScene;
          if (gameScene && message.position) {
            gameScene.showProjectileSplash(message.position);
          }
          break;

        case "flagReturned":
          const { mapConfig } = useGameStore.getState();
          const basePos = mapConfig?.bases[message.flagTeam as 'red' | 'blue']?.position;

          updateFlag(message.flagTeam, {
            state: "at_base",
            carriedBy: null,
            droppedAt: null,
            position: basePos || (message.flagTeam === "red" ? { x: 128, y: 128 } : { x: 672, y: 464 }),
          });
          break;

        case "gameStatusChanged":
          const currentGameState = useGameStore.getState().gameState;
          if (currentGameState) {
            setGameState({
              ...currentGameState,
              status: message.status,
              startedAt: message.startedAt,
            });
          }
          break;

        case "gameReset":
          setGameState(message.gameState);
          break;

        case "playerStunned":
          updatePlayer(message.playerId, {
            stunned: true,
            stunnedUntil: Date.now() + message.duration,
            carryingFlag: false,
          });
          break;

        case "playerRecovered":
          updatePlayer(message.playerId, {
            stunned: false,
            stunnedUntil: null,
          });
          break;

        case "playerKilled":
          updatePlayer(message.playerId, {
            respawning: true,
            respawnAt: message.respawnAt,
            carryingFlag: false,
            activeBoost: null,
            boostEndsAt: null,
            hasSpeed: false,
            hasShield: false,
          });
          break;

        case "playerRespawned":
          updatePlayer(message.playerId, {
            respawning: false,
            respawnAt: null,
            position: message.position,
          });
          break;

        case "boostActivated":
          updatePlayer(message.playerId, {
            activeBoost: message.boostType === 'speed_boost' ? 'speed' : 'shield',
            boostEndsAt: Date.now() + message.duration,
            hasSpeed: message.boostType === 'speed_boost',
            hasShield: message.boostType === 'shield',
          });
          break;

        case "boostExpired":
          const updates: any = {
            activeBoost: null,
            boostEndsAt: null,
          };

          if (message.boostType === 'speed_boost' || message.boostType === 'speed') {
            updates.hasSpeed = false;
          } else if (message.boostType === 'shield') {
            updates.hasShield = false;
          }

          updatePlayer(message.playerId, updates);
          break;

        case "matchEnded":
          const matchEndState = useGameStore.getState().gameState;
          if (matchEndState) {
            setGameState({
              ...matchEndState,
              status: "ended",
              winnerId: message.winner,
              scores: message.finalScore,
              endedAt: Date.now()
            });
          }
          break;

        case "playerDisconnected":
          const disconnectState = useGameStore.getState().gameState;
          if (disconnectState) {
            const updatedPlayers = disconnectState.players.filter(
              (p) => p.id !== message.playerId
            );
            setGameState({ ...disconnectState, players: updatedPlayers });
          }
          break;

        default:
          console.log("[Game] Unhandled message type:", message.type);
      }
    });

    // Enter the game
    if (playerName) {
      // console.log("[Game] Entering game as:", playerName);
      socket.enterGame(playerName);
    }

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, [
    playerName,
    setPlayerId,
    setMyPlayer,
    setGameState,
    setMapConfig,
    addPlayer,
    updatePlayer,
    addProjectile,
    updateFlag,
    updateScores,
    updateLastServerMessageTime,
    setDisconnected,
  ]);

  // Check for client disconnect (no messages from server for 30 seconds)
  useEffect(() => {
    const DISCONNECT_TIMEOUT = 30000; // 30 seconds

    const checkInterval = setInterval(() => {
      const { lastServerMessageTime, disconnected } = useGameStore.getState();
      const timeSinceLastMessage = Date.now() - lastServerMessageTime;

      if (timeSinceLastMessage >= DISCONNECT_TIMEOUT && !disconnected) {
        console.log("[Game] No server updates for 30 seconds - disconnected");
        setDisconnected(true);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkInterval);
  }, [setDisconnected]);

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col relative">
      {/* Game UI Overlay */}
      <GameUI />

      {/* Phaser Game Canvas */}
      <div className="flex-1 flex items-center justify-center">
        <PhaserGame />
      </div>

      {/* Disconnect Modal */}
      <DisconnectModal />
    </div>
  );
}
