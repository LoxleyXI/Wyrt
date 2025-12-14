/**
 * Get Party State Request Handler
 *
 * Returns the current party state for the player.
 * Useful for UI refresh or reconnection scenarios.
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
            // Not in a party - send null state
            u.send(JSON.stringify({
                type: 'party_state',
                data: null
            }));
            return;
        }

        const partyState = partyModule.partyManager.getPartyState(party.id);

        u.send(JSON.stringify({
            type: 'party_state',
            data: partyState
        }));
    }
};

export default handler;
