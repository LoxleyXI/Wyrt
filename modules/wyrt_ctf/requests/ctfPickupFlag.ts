/**
 * PICKUP FLAG REQUEST HANDLER
 *
 * Handles player attempting to pick up a flag.
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

            const { flagTeam } = payload;

            if (flagTeam !== 'red' && flagTeam !== 'blue') {
                return u.error('Invalid flag team');
            }

            // Attempt pickup
            const success = gameManager.pickupFlag(u.id, flagTeam);

            if (success) {
                u.system(`Picked up ${flagTeam} flag!`);
            } else {
                u.error('Cannot pick up flag');
            }

        } catch (error) {
            u.error('Failed to pick up flag');
        }
    }
};

export default handler;
