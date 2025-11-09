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
            const [results] = await context.db.query(
                "SELECT * FROM characters WHERE id = ? AND account_id = ? AND game_id = ? AND deleted = FALSE",
                [characterId, u.account.id, gameId]
            );

            if (results.length === 0) {
                u.error("Character not found");
                return;
            }

            const character = results[0];

            // Game-specific character selection
            const hook = context.getCharacterSelectHook(gameId);
            if (hook) {
                hook({
                    user: u,
                    character,
                    db: context.db,
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
