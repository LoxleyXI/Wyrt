import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 2,
    auth: true,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        const { characterId, gameId } = payload;

        if (!u.account || !u.account.authenticated) {
            u.error("Not authenticated");
            return;
        }

        if (!characterId || !gameId) {
            u.error("Character ID and game ID required");
            return;
        }

        try {
            // Verify character ownership
            const character = await context.prisma.legacyCharacter.findFirst({
                where: {
                    id: characterId,
                    account_id: u.account.id,
                    game_id: gameId,
                    deleted: false
                }
            });

            if (!character) {
                u.error("Character not found");
                return;
            }

            // Game-specific character selection
            const hook = context.getCharacterSelectHook(gameId);
            if (hook) {
                hook({
                    user: u,
                    character,
                    db: context.prisma,
                    context
                }).catch(error => {
                    console.error(`Failed to load ${gameId} character:`, error);
                    u.error("Failed to load character data");
                });
            } else {
                console.warn(`No character select hook registered for game: ${gameId}`);
                u.error("Game not available");
            }
        } catch (error) {
            console.error("Character selection error:", error);
            u.error("Failed to select character");
        }
    }
};

export default handler;
