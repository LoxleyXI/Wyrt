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
            let query = "SELECT * FROM characters WHERE account_id = ? AND deleted = FALSE";
            let params = [u.account.id];

            // Filter by game if specified
            if (gameId) {
                query += " AND game_id = ?";
                params.push(gameId);
            }

            query += " ORDER BY last_played DESC";

            const [results] = await context.db.query(query, params);

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
