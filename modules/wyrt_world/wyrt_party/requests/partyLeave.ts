/**
 * Leave Party Request Handler
 *
 * Leaves the current party.
 * Payload: {} (no payload required)
 */

import { ModuleContext } from '../../../../src/module/ModuleContext';
import { User } from '../../../../src/types/User';
import { Request } from '../../../../src/types/Request';

const handler: Request = {
    cost: 1,
    auth: true,
    exec: async (u: User, data: any, payload: any, context?: ModuleContext) => {
        if (!context) {
            u.error('Server error: No context');
            return;
        }

        const partyModule = context.getModule('wyrt_party');
        if (!partyModule?.partyManager) {
            u.error('Party system not available');
            return;
        }

        const playerId = u.id.toString();
        const party = partyModule.partyManager.getPlayerParty(playerId);

        if (!party) {
            u.error('You are not in a party');
            return;
        }

        const partyId = party.id;
        const success = partyModule.partyManager.leaveParty(playerId);

        if (!success) {
            u.error('Failed to leave party');
            return;
        }

        u.send(JSON.stringify({
            type: 'party_left',
            data: { partyId }
        }));

        // Other party members are notified via the event system
    }
};

export default handler;
