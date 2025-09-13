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
            // Verify character belongs to account and game
            context.connection.query(
                "SELECT * FROM characters WHERE id = ? AND account_id = ? AND game_id = ? AND deleted = FALSE",
                [characterId, u.account.id, gameId],
                (error, results) => {
                    if (error) {
                        console.error("Database error:", error);
                        u.error("Failed to select character");
                        return;
                    }

                    if (results.length === 0) {
                        u.error("Character not found");
                        return;
                    }

                    const character = results[0];

                    // Load game-specific character data
                    if (gameId === 'ironwood') {
                        loadIronwoodCharacter(u, context, character);
                    } else if (gameId === 'demo_game') {
                        loadTileGameCharacter(u, context, character);
                    } else {
                        u.error("Unknown game ID");
                        return;
                    }
                }
            );
        } catch (error) {
            console.error("Character selection error:", error);
            u.error("Failed to select character");
        }
    }
};

function loadIronwoodCharacter(u: User, context: any, character: any) {
    // Load Ironwood-specific stats
    context.connection.query(
        "SELECT * FROM ironwood_stats WHERE character_id = ?",
        [character.id],
        (error, results) => {
            if (error) {
                console.error("Database error:", error);
                u.error("Failed to load character data");
                return;
            }

            const stats = results[0] || {
                hp: 100,
                max_hp: 100,
                mp: 50,
                max_mp: 50,
                zone: 'maiden_wood',
                room: 'Green_Thicket'
            };

            // Set player data
            u.player = {
                charid: character.id,
                name: character.name,
                level: character.level,
                class: character.class,
                authenticated: true,
                zone: stats.zone,
                room: stats.room,
                location: `${stats.zone}.${stats.room}`,
                hp: stats.hp,
                max_hp: stats.max_hp,
                mp: stats.mp,
                max_mp: stats.max_mp,
                stats: {
                    strength: stats.strength,
                    dexterity: stats.dexterity,
                    intelligence: stats.intelligence,
                    defense: stats.defense,
                    agility: stats.agility
                }
            };

            // Update last played
            context.connection.query(
                "UPDATE characters SET last_played = NOW() WHERE id = ?",
                [character.id]
            );

            // Send success response
            u.system(JSON.stringify({
                type: "character_selected",
                gameId: 'ironwood',
                character: {
                    id: character.id,
                    name: character.name,
                    level: character.level,
                    class: character.class,
                    location: u.player.location
                }
            }));

            // Emit event for game module
            context.events.emit('characterSelected', {
                user: u,
                gameId: 'ironwood',
                character: u.player
            });
        }
    );
}

function loadTileGameCharacter(u: User, context: any, character: any) {
    // Load TileGame-specific stats
    context.connection.query(
        "SELECT * FROM demo_game_stats WHERE character_id = ?",
        [character.id],
        (error, results) => {
            if (error) {
                console.error("Database error:", error);
                u.error("Failed to load character data");
                return;
            }

            const stats = results[0] || {
                hp: 100,
                max_hp: 100,
                mp: 50,
                max_mp: 50,
                current_map: 'tutorial_island',
                position_x: 100,
                position_y: 100
            };

            // Set player data
            u.player = {
                charid: character.id,
                name: character.name,
                level: character.level,
                class: character.class,
                authenticated: true,
                map: stats.current_map,
                position: {
                    x: stats.position_x,
                    y: stats.position_y
                },
                hp: stats.hp,
                max_hp: stats.max_hp,
                mp: stats.mp,
                max_mp: stats.max_mp,
                stats: {
                    strength: stats.strength,
                    dexterity: stats.dexterity,
                    intelligence: stats.intelligence,
                    defense: stats.defense,
                    agility: stats.agility
                }
            };

            // Update last played
            context.connection.query(
                "UPDATE characters SET last_played = NOW() WHERE id = ?",
                [character.id]
            );

            // Send success response
            u.system(JSON.stringify({
                type: "character_selected",
                gameId: 'demo_game',
                character: {
                    id: character.id,
                    name: character.name,
                    level: character.level,
                    class: character.class,
                    map: u.player.map,
                    position: u.player.position
                }
            }));

            // Emit event for game module
            context.events.emit('characterSelected', {
                user: u,
                gameId: 'demo_game',
                character: u.player
            });
        }
    );
}

export default handler;