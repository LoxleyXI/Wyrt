import { ModuleContext } from "../../../src/module/ModuleContext";
import { CommandContext } from "../../../src/module/ModuleCommands";

const directionAliases: Record<string, string> = {
    "n": "north",
    "s": "south",
    "e": "east",
    "w": "west",
    "ne": "northeast",
    "nw": "northwest",
    "se": "southeast",
    "sw": "southwest",
    "u": "up",
    "d": "down"
};

export default {
    name: "move",
    aliases: ["go", "walk", ...Object.keys(directionAliases), ...Object.values(directionAliases)],
    description: "Move in a direction",
    usage: "move <direction>",
    
    async execute(context: ModuleContext, cmdContext: CommandContext) {
        const { player, args, command, respond } = cmdContext;
        const roomManager = context.modules.get("roomManager");
        
        if (!roomManager) {
            return respond({ error: "Room system not available" });
        }
        
        const currentRoom = roomManager.getPlayerRoom(player.id);
        if (!currentRoom) {
            return respond({ error: "You are not in a room" });
        }
        
        // Determine direction
        let direction: string;
        if (command in directionAliases) {
            direction = command;
        } else if (Object.values(directionAliases).includes(command)) {
            direction = Object.keys(directionAliases).find(k => directionAliases[k] === command) || command;
        } else if (args.length > 0) {
            direction = args[0].toLowerCase();
        } else {
            return respond({ 
                type: "error",
                message: "Please specify a direction to move." 
            });
        }
        
        // Normalize direction
        if (directionAliases[direction]) {
            direction = Object.keys(directionAliases).find(k => k === direction) || direction;
        }
        
        // Check if exit exists
        if (!currentRoom.exits || !currentRoom.exits[direction]) {
            return respond({
                type: "error",
                message: `You cannot go ${directionAliases[direction] || direction} from here.`
            });
        }
        
        const targetRoomId = currentRoom.exits[direction];
        const targetRoom = roomManager.getRoom(targetRoomId);
        
        if (!targetRoom) {
            return respond({
                type: "error",
                message: "That direction leads nowhere."
            });
        }
        
        // Move the player
        const success = roomManager.movePlayer(player, targetRoomId);
        
        if (success) {
            const description = roomManager.getRoomDescription(targetRoom, player);
            return respond({
                type: "move_success",
                direction: directionAliases[direction] || direction,
                room: {
                    id: targetRoom.id,
                    name: targetRoom.name,
                    description: description,
                    exits: targetRoom.exits,
                    npcs: targetRoom.npcs.map(n => ({
                        id: n.id,
                        name: n.name,
                        position: n.position
                    })),
                    mobs: targetRoom.mobs.map(m => ({
                        id: m.id,
                        name: m.name,
                        level: m.level,
                        position: m.position,
                        sprite: m.sprite,
                        tint: m.tint,
                        maxHp: m.maxHp
                    })),
                    players: targetRoom.players.filter(p => p.id !== player.id).map(p => ({
                        id: p.id,
                        name: p.name,
                        position: p.position
                    }))
                }
            });
        } else {
            return respond({
                type: "error",
                message: "You cannot move there."
            });
        }
    }
};