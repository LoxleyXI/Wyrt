/**
 * Accept Party Invite Request Handler
 *
 * Accepts a pending party invitation.
 * Payload: { inviteId: string }
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

        const { inviteId } = payload;

        if (!inviteId) {
            u.error('No invite specified');
            return;
        }

        const result = partyModule.partyManager.acceptInvite(
            inviteId,
            u.id.toString(),
            u.player?.name || 'Unknown'
        );

        if ('error' in result) {
            u.error(result.error);
            return;
        }

        // Get full party state to send to all members
        const partyState = partyModule.partyManager.getPartyState(result.id);

        // Notify joining player
        u.send(JSON.stringify({
            type: 'party_joined',
            data: partyState
        }));

        // Notify other party members (via event system - game module handles broadcast)
        // The party_event listener in the game module should broadcast to all members
    }
};

export default handler;
