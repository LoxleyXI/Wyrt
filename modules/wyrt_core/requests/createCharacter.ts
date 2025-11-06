import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 5,
    auth: true,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        const { name, gameId, characterClass } = payload;
        
        console.log("CreateCharacter request:", { 
            name, 
            gameId, 
            characterClass,
            account: u.account 
        });

        if (!u.account || !u.account.authenticated) {
            console.error("Create character failed: User not authenticated", u.account);
            u.error("Not authenticated");
            return;
        }

        if (!name || !gameId) {
            u.error("Character name and game ID required");
            return;
        }

        // Validate character name
        if (!/^[a-zA-Z]{3,20}$/.test(name)) {
            u.error("Character name must be 3-20 letters only");
            return;
        }

        // Set default class if not provided
        const charClass = characterClass || 'Warrior';

        try {
            // Check if name is already taken in this game
            context.connection.query(
                "SELECT id FROM characters WHERE name = ? AND game_id = ?",
                [name, gameId],
                (error, results) => {
                    if (error) {
                        console.error("Database error checking character name:", error);
                        u.error("Failed to create character");
                        return;
                    }

                    if (results.length > 0) {
                        console.log(`Character name '${name}' already exists in game '${gameId}'`);
                        u.error("Character name already taken");
                        return;
                    }

                    // Create character
                    context.connection.query(
                        "INSERT INTO characters (account_id, game_id, name, level, class) VALUES (?, ?, ?, ?, ?)",
                        [u.account.id, gameId, name, 1, charClass],
                        async (error, results) => {
                            if (error) {
                                console.error("Database error creating character:", error);
                                console.error("Query params:", [u.account.id, gameId, name, 1, charClass]);
                                u.error("Failed to create character");
                                return;
                            }

                            const characterId = results.insertId;

                            // Call game-specific character creation hook
                            const hook = context.getCharacterCreateHook(gameId);
                            if (hook) {
                                try {
                                    await hook({
                                        characterId,
                                        name,
                                        class: charClass,
                                        accountId: u.account.id
                                    }, context.connection);
                                } catch (error) {
                                    console.error(`Failed to initialize ${gameId} character:`, error);
                                    u.error("Failed to initialize game-specific data");
                                    // Rollback character creation
                                    context.connection.query("DELETE FROM characters WHERE id = ?", [characterId]);
                                    return;
                                }
                            } else {
                                console.warn(`No character create hook registered for game: ${gameId}`);
                            }

                            // Log character creation
                            context.connection.query(
                                "INSERT INTO audit_log (account_id, action, details) VALUES (?, ?, ?)",
                                [u.account.id, 'character_created', JSON.stringify({
                                    characterId,
                                    name,
                                    gameId,
                                    class: charClass
                                })]
                            );

                            // Send success response
                            u.system(JSON.stringify({
                                type: "character_created",
                                character: {
                                    id: characterId,
                                    name: name,
                                    gameId: gameId,
                                    level: 1,
                                    class: charClass
                                }
                            }));

                            context.logger.info(`Character created: ${name} (ID: ${characterId}) for game ${gameId}`);
                        }
                    );
                }
            );
        } catch (error) {
            console.error("Create character error:", error);
            u.error("Failed to create character");
        }
    }
};

export default handler;