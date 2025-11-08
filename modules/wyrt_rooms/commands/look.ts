import { ModuleContext } from "../../../src/module/ModuleContext";
import { CommandContext } from "../../../src/module/ModuleCommands";

export default {
    name: "look",
    aliases: ["l", "examine"],
    description: "Look at your surroundings or examine something specific",
    usage: "look [target]",
    
    async execute(context: ModuleContext, cmdContext: CommandContext) {
        const { player, args, respond } = cmdContext;
        const roomManager = context.modules.get("roomManager");
        const entityManager = context.modules.get("entityManager");
        
        if (!roomManager) {
            return respond({ error: "Room system not available" });
        }
        
        const room = roomManager.getPlayerRoom(player.id);
        if (!room) {
            return respond({ error: "You are not in a room" });
        }
        
        // If no target specified, describe the room
        if (args.length === 0) {
            const description = roomManager.getRoomDescription(room, player);
            return respond({
                type: "room_description",
                content: description,
                room: {
                    id: room.id,
                    name: room.name,
                    description: room.description,
                    exits: room.exits,
                    npcs: room.npcs.map(n => ({
                        id: n.id,
                        name: n.name,
                        position: n.position
                    })),
                    mobs: room.mobs.map(m => ({
                        id: m.id,
                        name: m.name,
                        level: m.level,
                        position: m.position,
                        sprite: m.sprite,
                        tint: m.tint,
                        maxHp: m.maxHp
                    })),
                    players: room.players.filter(p => p.id !== player.id).map(p => ({
                        id: p.id,
                        name: p.name,
                        position: p.position
                    }))
                }
            });
        }
        
        // Look at specific target
        const target = args.join(" ").toLowerCase();
        
        // Check NPCs
        const npc = room.npcs.find(n => n.name.toLowerCase().includes(target));
        if (npc) {
            return respond({
                type: "examine_npc",
                target: npc.name,
                description: `${npc.name} is a level ${npc.level} NPC.`,
                npc: {
                    id: npc.id,
                    name: npc.name,
                    level: npc.level,
                    hp: npc.hp,
                    position: npc.position
                }
            });
        }
        
        // Check mobs
        const mob = room.mobs.find(m => m.name.toLowerCase().includes(target));
        if (mob) {
            const healthPercent = Math.round((mob.hp[0] / mob.hp[1]) * 100);
            return respond({
                type: "examine_mob",
                target: mob.name,
                description: `${mob.name} is a level ${mob.level} creature. Health: ${healthPercent}%`,
                mob: {
                    id: mob.id,
                    name: mob.name,
                    level: mob.level,
                    hp: mob.hp,
                    position: mob.position
                }
            });
        }
        
        // Check players
        const targetPlayer = room.players.find(p => 
            p.id !== player.id && p.name.toLowerCase().includes(target)
        );
        if (targetPlayer) {
            return respond({
                type: "examine_player",
                target: targetPlayer.name,
                description: `${targetPlayer.name} is a level ${targetPlayer.level} ${targetPlayer.class}.`,
                player: {
                    id: targetPlayer.id,
                    name: targetPlayer.name,
                    level: targetPlayer.level,
                    class: targetPlayer.class,
                    position: targetPlayer.position
                }
            });
        }
        
        return respond({
            type: "error",
            message: `You don't see "${args.join(" ")}" here.`
        });
    }
};