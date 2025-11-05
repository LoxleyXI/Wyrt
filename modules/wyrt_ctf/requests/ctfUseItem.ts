/**
 * USE ITEM REQUEST HANDLER
 *
 * Handles player activating a boost (speed or shield).
 */

import { Request } from '../../../src/types/Request';
import { User } from '../../../src/types/User';
import { Data } from '../../../src/types/Data';

const handler: Request = {
    cost: 1,
    auth: false,

    exec: async function(u: User, data: Data, payload: any, context?: any) {
        try {
            const gameManager = (globalThis as any).ctfGameManager;

            if (!gameManager) {
                return u.error('Game not initialized');
            }

            // Attempt to activate boost
            const success = gameManager.activateBoost(u.id);

            if (success) {
                u.system('Boost activated!');
            } else {
                u.error('Cannot use item');
            }

        } catch (error) {
            console.error('[useItem] Error:', error);
            u.error('Failed to use item');
        }
    }
};

export default handler;
