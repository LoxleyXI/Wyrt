/**
 * Party Invite Request Handler
 *
 * Sends a party invite to another player.
 * Payload: { targetName: string } or { targetId: string }
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

        const { targetName, targetId } = payload;

        if (!targetName && !targetId) {
            u.error('Please specify a player to invite');
            return;
        }

        // Find target user - this requires the game to provide a lookup method
        // Games should override this handler or provide a user lookup via context
        let targetUser: User | null = null;

        // Try to find by name if provided (common case)
        if (targetName && context.findUserByName) {
            targetUser = context.findUserByName(targetName);
        } else if (targetId && context.findUserById) {
            targetUser = context.findUserById(targetId);
        }

        if (!targetUser || !targetUser.player) {
            u.error(`Player "${targetName || targetId}" not found or offline`);
            return;
        }

        // Send invite
        const result = partyModule.partyManager.invitePlayer(
            u.id.toString(),
            u.player?.name || 'Unknown',
            targetUser.id.toString(),
            targetUser.player.name
        );

        if ('error' in result) {
            u.error(result.error);
            return;
        }

        // Notify inviter
        u.send(JSON.stringify({
            type: 'party_invite_sent',
            data: {
                inviteId: result.id,
                toName: result.toName
            }
        }));

        // Notify target
        targetUser.send(JSON.stringify({
            type: 'party_invite_received',
            data: {
                inviteId: result.id,
                fromId: result.fromId,
                fromName: result.fromName,
                expiresAt: result.expiresAt
            }
        }));
    }
};

export default handler;
