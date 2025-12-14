/**
 * Promote to Party Leader Request Handler
 *
 * Promotes another party member to leader (current leader only).
 * Payload: { targetId: string }
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

        const { targetId } = payload;

        if (!targetId) {
            u.error('Please specify a player to promote');
            return;
        }

        const result = partyModule.partyManager.promoteToLeader(u.id.toString(), targetId);

        if (typeof result === 'object' && 'error' in result) {
            u.error(result.error);
            return;
        }

        u.send(JSON.stringify({
            type: 'party_leader_changed',
            data: { newLeaderId: targetId }
        }));

        // Other party members are notified via events
    }
};

export default handler;
