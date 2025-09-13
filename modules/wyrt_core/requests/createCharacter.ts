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

        // Validate game ID
        if (!['ironwood', 'demo_game'].includes(gameId)) {
            u.error("Invalid game ID");
            return;
        }

        // Set default class if not provided
        const charClass = characterClass || (gameId === 'ironwood' ? 'Adventurer' : 'Warrior');

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
                        (error, results) => {
                            if (error) {
                                console.error("Database error creating character:", error);
                                console.error("Query params:", [u.account.id, gameId, name, 1, charClass]);
                                u.error("Failed to create character");
                                return;
                            }

                            const characterId = results.insertId;

                            // Create game-specific stats
                            if (gameId === 'ironwood') {
                                createIronwoodStats(context, characterId);
                            } else if (gameId === 'demo_game') {
                                createTileGameStats(context, characterId);
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

function createIronwoodStats(context: any, characterId: number) {
    // Create default Ironwood stats
    context.connection.query(
        `INSERT INTO ironwood_stats 
        (character_id, hp, max_hp, mp, max_mp, strength, dexterity, intelligence, defense, agility, experience, gold, zone, room) 
        VALUES (?, 100, 100, 50, 50, 10, 10, 10, 10, 10, 0, 100, 'maiden_wood', 'Green_Thicket')`,
        [characterId],
        (error) => {
            if (error) {
                console.error("Failed to create Ironwood stats:", error);
            }
        }
    );

    // Add starting items
    const startingItems = [
        ['Wooden_Sword', 1, true, 'Weapon'],
        ['Cloth_Shirt', 1, true, 'Upper'],
        ['Cloth_Pants', 1, true, 'Lower'],
        ['Health_Potion', 3, false, null],
        ['Bread', 5, false, null]
    ];

    for (const [itemId, quantity, equipped, slot] of startingItems) {
        context.connection.query(
            "INSERT INTO ironwood_inventory (character_id, item_id, quantity, equipped, slot) VALUES (?, ?, ?, ?, ?)",
            [characterId, itemId, quantity, equipped, slot]
        );
    }
}

function createTileGameStats(context: any, characterId: number) {
    // Create default TileGame stats
    context.connection.query(
        `INSERT INTO demo_game_stats 
        (character_id, hp, max_hp, mp, max_mp, strength, dexterity, intelligence, defense, agility, experience, gold, current_map, position_x, position_y) 
        VALUES (?, 100, 100, 50, 50, 10, 10, 10, 10, 10, 0, 100, 'tutorial_island', 100, 100)`,
        [characterId],
        (error) => {
            if (error) {
                console.error("Failed to create TileGame stats:", error);
            }
        }
    );

    // Add starting items
    const startingItems = [
        ['iron_sword', 1, 0, true],
        ['leather_armor', 1, 1, true],
        ['health_potion', 5, null, false],
        ['mana_potion', 3, null, false]
    ];

    for (const [itemId, quantity, slotIndex, equipped] of startingItems) {
        context.connection.query(
            "INSERT INTO demo_game_inventory (character_id, item_id, quantity, slot_index, equipped) VALUES (?, ?, ?, ?, ?)",
            [characterId, itemId, quantity, slotIndex, equipped]
        );
    }

    // Add starting abilities
    const startingAbilities = [
        ['basic_attack', 1, 0],
        ['heal', 1, 1]
    ];

    for (const [abilityId, level, slotNumber] of startingAbilities) {
        context.connection.query(
            "INSERT INTO demo_game_abilities (character_id, ability_id, level, slot_number) VALUES (?, ?, ?, ?)",
            [characterId, abilityId, level, slotNumber]
        );
    }
}

export default handler;