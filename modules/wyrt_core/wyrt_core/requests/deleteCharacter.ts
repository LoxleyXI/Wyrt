import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 5,
    auth: true,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        const { characterId, gameId } = payload;

        if (!u.account || !u.account.authenticated) {
            console.error("Delete character failed: User not authenticated", u.account);
            u.error("Not authenticated");
            return;
        }

        if (!characterId) {
            u.error("Character ID required");
            return;
        }

        try {
            // Verify character exists and belongs to this account
            const character = await context.prisma.legacyCharacter.findFirst({
                where: {
                    id: characterId,
                    account_id: u.account.id,
                    deleted: false
                }
            });

            if (!character) {
                u.error("Character not found");
                return;
            }

            // Soft delete the legacy character
            await context.prisma.legacyCharacter.update({
                where: { id: characterId },
                data: { deleted: true }
            });

            // Also delete wyrt_data Character and related records if they exist
            const dataModule = context.getModule?.('wyrt_data');
            if (dataModule) {
                const db = dataModule.getDatabase();

                // Find the wyrt_data Character by matching the legacy character
                // Characters are linked by having the same account and matching creation
                const wyrtCharacter = await db.character.findFirst({
                    where: {
                        name: character.name,
                        gameId: character.game_id
                    }
                });

                if (wyrtCharacter) {
                    // Delete related records first (foreign key constraints)
                    await db.inventoryItem.deleteMany({
                        where: { characterId: wyrtCharacter.id }
                    });

                    await db.characterSkill.deleteMany({
                        where: { characterId: wyrtCharacter.id }
                    });

                    await db.equipment.deleteMany({
                        where: { characterId: wyrtCharacter.id }
                    });

                    await db.questProgress.deleteMany({
                        where: { characterId: wyrtCharacter.id }
                    });

                    // Delete the character itself
                    await db.character.delete({
                        where: { id: wyrtCharacter.id }
                    });

                    context.logger?.info(`Deleted wyrt_data character ${wyrtCharacter.id} for ${character.name}`);
                }
            }

            // Log character deletion
            context.prisma.auditLog.create({
                data: {
                    account_id: u.account.id,
                    action: 'character_deleted',
                    details: JSON.stringify({
                        characterId,
                        name: character.name,
                        gameId: character.game_id
                    })
                }
            }).catch((err: any) => console.error("Failed to log character deletion:", err));

            // Send success response
            u.system(JSON.stringify({
                type: "character_deleted",
                characterId: characterId
            }));

            context.logger?.info(`Character deleted: ${character.name} (ID: ${characterId})`);
        } catch (error) {
            console.error("Delete character error:", error);
            u.error("Failed to delete character");
        }
    }
};

export default handler;
