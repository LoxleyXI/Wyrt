/**
 * Move Request Handler
 *
 * Handles player movement updates. Validates position data, updates game state,
 * and broadcasts movement to all players.
 */

import { Request } from '../../../src/types/Request';
import { User } from '../../../src/types/User';
import { Data } from '../../../src/types/Data';

const handler: Request = {
    cost: 0.1,  // Very low cost (movement is frequent)
    auth: false,

    exec: async function(u: User, data: Data, payload: any, context?: any) {
        try {
            const gameManager = (globalThis as any).ctfGameManager;

            if (!gameManager) {
                return u.error('Game not initialized');
            }

            const { position, direction } = payload;

            if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
                return u.error('Invalid position data');
            }

            // Update player position
            gameManager.updatePlayerPosition(u.id, position, direction || 'down');

            // Broadcast to all players
            context?.events.emit('ctf:playerMoved', {
                playerId: u.id,
                position,
                direction
            });

        } catch (error) {
            console.error('[move] Error:', error);
        }
    }
};

export default handler;
