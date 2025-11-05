/**
 * PICKUP WEAPON REQUEST HANDLER
 *
 * Handles player attempting to pick up a weapon from the ground.
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

            const { weaponId } = payload;

            if (!weaponId) {
                return u.error('Invalid weapon ID');
            }

            // Attempt pickup
            const success = gameManager.pickupWeapon(u.id, weaponId);

            if (success) {
                u.system('Weapon picked up!');
            } else {
                u.error('Cannot pick up weapon');
            }

        } catch (error) {
            console.error('[pickupWeapon] Error:', error);
            u.error('Failed to pick up weapon');
        }
    }
};

export default handler;
