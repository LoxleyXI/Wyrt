/**
 * Enter Game Request Handler
 *
 * Handles players joining the CTF game. Assigns team, sends initial game state,
 * and broadcasts join event to other players.
 */

import { Request } from '../../../src/types/Request';
import { User } from '../../../src/types/User';
import { Data } from '../../../src/types/Data';

const handler: Request = {
    cost: 5,    // Higher cost (joining is a significant action)
    auth: false,  // No auth required for demo (simplicity)

    exec: async function(u: User, data: Data, payload: any, context?: any) {
        try {
            // Get game manager from module context
            const gameManager = (globalThis as any).ctfGameManager;

            if (!gameManager) {
                return u.error('Game not initialized');
            }

            // Get player name from payload (or default)
            const playerName = payload.name || `Player${Math.floor(Math.random() * 1000)}`;

            // Add player to game
            const player = gameManager.addPlayer(u.id, playerName);

            // Get full game state
            const gameState = gameManager.getGameState();
            const mapConfig = gameManager.getMapConfig();

            // Send game state to new player
            u.send(JSON.stringify({
                type: 'gameState',
                player,
                gameState: {
                    matchId: gameState.matchId,
                    status: gameState.status,
                    scores: gameState.scores,
                    captureLimit: gameState.captureLimit,
                    flags: gameState.flags,
                    players: Array.from(gameState.players.values()),
                    weapons: Array.from(gameState.weapons.values()),
                    projectiles: Array.from(gameState.projectiles.values())
                },
                mapConfig
            }));

            // Broadcast to all other players
            context?.events.emit('ctf:playerJoined', {
                player
            });

            console.log(`[enterGame] Player ${playerName} (${u.id}) entered game on ${player.team} team`);

        } catch (error) {
            console.error('[enterGame] Error:', error);
            u.error('Failed to join game');
        }
    }
};

export default handler;
