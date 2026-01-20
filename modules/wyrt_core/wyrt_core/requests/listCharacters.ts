import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 1,
    auth: true,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        const { gameId } = payload;

        if (!u.account || !u.account.authenticated) {
            u.error("Not authenticated");
            return;
        }

        try {
            // Build where clause conditionally
            const where: any = {
                account_id: u.account.id,
                deleted: false
            };

            if (gameId) {
                where.game_id = gameId;
            }

            const results = await context.prisma.legacyCharacter.findMany({
                where: where,
                orderBy: {
                    last_played: 'desc'
                },
                select: {
                    id: true,
                    name: true,
                    game_id: true,
                    level: true,
                    class: true,
                    created_at: true,
                    last_played: true
                }
            });

            const characters = results.map(char => ({
                id: char.id,
                name: char.name,
                gameId: char.game_id,
                level: char.level,
                class: char.class,
                createdAt: char.created_at,
                lastPlayed: char.last_played
            }));

            // Send character list
            u.system(JSON.stringify({
                type: "character_list",
                characters: characters
            }));
        } catch (error) {
            console.error("List characters error:", error);
            u.error("Failed to list characters");
        }
    }
};

export default handler;
