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
            const existingChar = await context.prisma.characters.findFirst({
                where: {
                    name: name,
                    game_id: gameId
                },
                select: { id: true }
            });

            if (existingChar) {
                console.log(`Character name '${name}' already exists in game '${gameId}'`);
                u.error("Character name already taken");
                return;
            }

            // Create character
            const newCharacter = await context.prisma.characters.create({
                data: {
                    account_id: u.account.id,
                    game_id: gameId,
                    name: name,
                    level: 1,
                    class: charClass
                },
                select: { id: true }
            });

            const characterId = newCharacter.id;

            // Call game-specific character creation hook
            const hook = context.getCharacterCreateHook(gameId);
            if (hook) {
                try {
                    await hook({
                        characterId,
                        name,
                        class: charClass,
                        accountId: u.account.id
                    }, context.prisma);
                } catch (error) {
                    console.error(`Failed to initialize ${gameId} character:`, error);
                    u.error("Failed to initialize game-specific data");
                    // Rollback character creation
                    await context.prisma.characters.delete({
                        where: { id: characterId }
                    });
                    return;
                }
            } else {
                console.warn(`No character create hook registered for game: ${gameId}`);
            }

            // Log character creation (fire and forget)
            context.prisma.audit_log.create({
                data: {
                    account_id: u.account.id,
                    action: 'character_created',
                    details: JSON.stringify({
                        characterId,
                        name,
                        gameId,
                        class: charClass
                    })
                }
            }).catch(err => console.error("Failed to log character creation:", err));

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
        } catch (error) {
            console.error("Create character error:", error);
            u.error("Failed to create character");
        }
    }
};

export default handler;
