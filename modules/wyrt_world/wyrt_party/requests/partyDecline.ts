/**
 * Decline Party Invite Request Handler
 *
 * Declines a pending party invitation.
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

        const success = partyModule.partyManager.declineInvite(inviteId, u.id.toString());

        if (!success) {
            u.error('Invite not found or already expired');
            return;
        }

        u.send(JSON.stringify({
            type: 'party_invite_declined',
            data: { inviteId }
        }));
    }
};

export default handler;
