/**
 * SHOOT REQUEST HANDLER
 *
 * Handles player firing stun gun projectile.
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

            const { direction } = payload;

            if (!direction || typeof direction.x !== 'number' || typeof direction.y !== 'number') {
                return u.error('Invalid direction');
            }

            // Attempt to shoot
            const success = gameManager.shoot(u.id, direction);

            if (!success) {
                u.error('Cannot shoot (no weapon or out of ammo)');
            }

        } catch (error) {
            console.error('[shoot] Error:', error);
            u.error('Failed to shoot');
        }
    }
};

export default handler;
