import { EventEmitter } from "events";
import { ModuleManager } from "./module/ModuleManager";
import { ModuleContext } from "./module/ModuleContext";
import { Logger } from "./server/ConsoleLogger";
import { Database } from "./server/Database";
import WebSocket from "ws";

export interface GameInstance {
    id: string;
    name: string;
    type: string; // "text" | "2d" | "3d"
    modules: string[]; // Module names to load
    config: any;
    port: number;
    wsServer?: WebSocket.Server;
    moduleManager?: ModuleManager;
    context?: ModuleContext;
    players: Set<string>;
    maxPlayers: number;
    status: "stopped" | "starting" | "running" | "stopping";
}

export class GameInstanceManager extends EventEmitter {
    private instances: Map<string, GameInstance> = new Map();
    private playerInstances: Map<string, string> = new Map(); // playerId -> instanceId
    private logger: Logger;
    private database: Database;
    private sharedAuth: Map<string, any> = new Map(); // Shared authentication data
    
    constructor(logger: Logger, database: Database) {
        super();
        this.logger = logger;
        this.database = database;
    }
    
    async createInstance(config: Partial<GameInstance>): Promise<GameInstance> {
        const instance: GameInstance = {
            id: config.id || this.generateInstanceId(),
            name: config.name || "Game Instance",
            type: config.type || "text",
            modules: config.modules || [],
            config: config.config || {},
            port: config.port || this.getNextAvailablePort(),
            players: new Set(),
            maxPlayers: config.maxPlayers || 100,
            status: "stopped"
        };
        
        this.instances.set(instance.id, instance);
        this.logger.info(`Created game instance: ${instance.name} (${instance.id})`);
        
        return instance;
    }
    
    async startInstance(instanceId: string): Promise<boolean> {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            this.logger.error(`Instance not found: ${instanceId}`);
            return false;
        }
        
        if (instance.status !== "stopped") {
            this.logger.warn(`Instance ${instanceId} is not stopped (status: ${instance.status})`);
            return false;
        }
        
        instance.status = "starting";
        
        try {
            // Create WebSocket server for this instance
            instance.wsServer = new WebSocket.Server({
                port: instance.port,
                perMessageDeflate: false
            });
            
            // Create module context for this instance
            instance.context = this.createModuleContext(instance);
            
            // Create and initialize module manager
            instance.moduleManager = new ModuleManager(instance.context);
            
            // Load modules for this instance
            for (const moduleName of instance.modules) {
                await instance.moduleManager.loadModule(moduleName);
            }
            
            // Activate all modules
            await instance.moduleManager.activateAll();
            
            // Setup WebSocket handlers
            this.setupWebSocketHandlers(instance);
            
            instance.status = "running";
            this.logger.info(`Started instance ${instance.name} on port ${instance.port}`);
            
            this.emit("instanceStarted", instance);
            return true;
        } catch (error) {
            this.logger.error(`Failed to start instance ${instanceId}:`, error);
            instance.status = "stopped";
            return false;
        }
    }
    
    async stopInstance(instanceId: string): Promise<boolean> {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            this.logger.error(`Instance not found: ${instanceId}`);
            return false;
        }
        
        if (instance.status !== "running") {
            this.logger.warn(`Instance ${instanceId} is not running (status: ${instance.status})`);
            return false;
        }
        
        instance.status = "stopping";
        
        try {
            // Disconnect all players
            for (const playerId of instance.players) {
                await this.removePlayerFromInstance(playerId, instanceId);
            }
            
            // Deactivate modules
            if (instance.moduleManager) {
                await instance.moduleManager.deactivateAll();
            }
            
            // Close WebSocket server
            if (instance.wsServer) {
                await new Promise<void>((resolve) => {
                    instance.wsServer!.close(() => resolve());
                });
            }
            
            instance.status = "stopped";
            this.logger.info(`Stopped instance ${instance.name}`);
            
            this.emit("instanceStopped", instance);
            return true;
        } catch (error) {
            this.logger.error(`Failed to stop instance ${instanceId}:`, error);
            return false;
        }
    }
    
    async deleteInstance(instanceId: string): Promise<boolean> {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            return false;
        }
        
        if (instance.status !== "stopped") {
            await this.stopInstance(instanceId);
        }
        
        this.instances.delete(instanceId);
        this.logger.info(`Deleted instance ${instance.name}`);
        
        return true;
    }
    
    private createModuleContext(instance: GameInstance): ModuleContext {
        const context: ModuleContext = {
            logger: this.logger,
            database: this.database,
            events: new EventEmitter(),
            commands: {} as any, // Will be initialized by ModuleManager
            requests: {} as any, // Will be initialized by ModuleManager
            data: {} as any,     // Will be initialized by ModuleManager
            modules: new Map(),
            instanceId: instance.id,
            instanceType: instance.type,
            config: instance.config
        };
        
        // Add instance-specific event handlers
        context.events.on("playerAuthenticated", (player) => {
            this.handlePlayerAuthenticated(instance, player);
        });
        
        context.events.on("playerDisconnected", (playerId) => {
            this.handlePlayerDisconnected(instance, playerId);
        });
        
        return context;
    }
    
    private setupWebSocketHandlers(instance: GameInstance) {
        if (!instance.wsServer) return;
        
        instance.wsServer.on("connection", (ws: WebSocket, req) => {
            const clientId = this.generateClientId();
            
            this.logger.debug(`New WebSocket connection to instance ${instance.id}: ${clientId}`);
            
            ws.on("message", async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await this.handleWebSocketMessage(instance, clientId, message, ws);
                } catch (error) {
                    this.logger.error(`Error handling WebSocket message:`, error);
                    ws.send(JSON.stringify({
                        type: "error",
                        message: "Invalid message format"
                    }));
                }
            });
            
            ws.on("close", () => {
                this.handleWebSocketDisconnect(instance, clientId);
            });
            
            ws.on("error", (error) => {
                this.logger.error(`WebSocket error for client ${clientId}:`, error);
            });
            
            // Send initial connection message
            ws.send(JSON.stringify({
                type: "connected",
                instanceId: instance.id,
                instanceName: instance.name,
                instanceType: instance.type
            }));
        });
    }
    
    private async handleWebSocketMessage(
        instance: GameInstance, 
        clientId: string, 
        message: any, 
        ws: WebSocket
    ) {
        // Route message based on type
        switch (message.type) {
            case "authenticate":
                await this.authenticatePlayer(instance, clientId, message, ws);
                break;
                
            case "command":
                if (instance.context) {
                    instance.context.events.emit("command", {
                        playerId: clientId,
                        command: message.command,
                        args: message.args
                    });
                }
                break;
                
            case "request":
                if (instance.context) {
                    instance.context.events.emit("request", {
                        playerId: clientId,
                        request: message.request,
                        data: message.data
                    });
                }
                break;
                
            default:
                // Pass to modules
                if (instance.context) {
                    instance.context.events.emit("message", {
                        playerId: clientId,
                        message: message
                    });
                }
        }
    }
    
    private async authenticatePlayer(
        instance: GameInstance,
        clientId: string,
        message: any,
        ws: WebSocket
    ) {
        const { token } = message;
        
        // Check shared authentication
        const authData = this.sharedAuth.get(token);
        if (!authData) {
            ws.send(JSON.stringify({
                type: "authenticate",
                success: false,
                message: "Invalid token"
            }));
            return;
        }
        
        // Check if player can join this instance
        if (instance.players.size >= instance.maxPlayers) {
            ws.send(JSON.stringify({
                type: "authenticate",
                success: false,
                message: "Instance is full"
            }));
            return;
        }
        
        // Add player to instance
        instance.players.add(authData.playerId);
        this.playerInstances.set(authData.playerId, instance.id);
        
        // Notify instance of new player
        if (instance.context) {
            instance.context.events.emit("playerAuthenticated", {
                playerId: authData.playerId,
                playerData: authData,
                ws: ws
            });
        }
        
        ws.send(JSON.stringify({
            type: "authenticate",
            success: true,
            playerId: authData.playerId,
            playerName: authData.playerName
        }));
    }
    
    private handleWebSocketDisconnect(instance: GameInstance, clientId: string) {
        // Find and remove player
        const playerId = this.getPlayerIdByClientId(instance, clientId);
        if (playerId) {
            this.removePlayerFromInstance(playerId, instance.id);
        }
    }
    
    private handlePlayerAuthenticated(instance: GameInstance, player: any) {
        this.logger.debug(`Player ${player.playerId} authenticated to instance ${instance.id}`);
        this.emit("playerJoinedInstance", {
            playerId: player.playerId,
            instanceId: instance.id
        });
    }
    
    private handlePlayerDisconnected(instance: GameInstance, playerId: string) {
        this.removePlayerFromInstance(playerId, instance.id);
    }
    
    async addPlayerToInstance(playerId: string, instanceId: string): Promise<boolean> {
        const instance = this.instances.get(instanceId);
        if (!instance || instance.status !== "running") {
            return false;
        }
        
        if (instance.players.size >= instance.maxPlayers) {
            return false;
        }
        
        // Remove from current instance if any
        const currentInstanceId = this.playerInstances.get(playerId);
        if (currentInstanceId) {
            await this.removePlayerFromInstance(playerId, currentInstanceId);
        }
        
        instance.players.add(playerId);
        this.playerInstances.set(playerId, instanceId);
        
        this.emit("playerJoinedInstance", { playerId, instanceId });
        return true;
    }
    
    async removePlayerFromInstance(playerId: string, instanceId: string): Promise<boolean> {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            return false;
        }
        
        instance.players.delete(playerId);
        this.playerInstances.delete(playerId);
        
        // Notify instance
        if (instance.context) {
            instance.context.events.emit("playerDisconnected", playerId);
        }
        
        this.emit("playerLeftInstance", { playerId, instanceId });
        return true;
    }
    
    getPlayerInstance(playerId: string): GameInstance | undefined {
        const instanceId = this.playerInstances.get(playerId);
        return instanceId ? this.instances.get(instanceId) : undefined;
    }
    
    getInstance(instanceId: string): GameInstance | undefined {
        return this.instances.get(instanceId);
    }
    
    getAllInstances(): GameInstance[] {
        return Array.from(this.instances.values());
    }
    
    getRunningInstances(): GameInstance[] {
        return Array.from(this.instances.values()).filter(i => i.status === "running");
    }
    
    // Shared authentication methods
    registerAuthToken(token: string, playerData: any) {
        this.sharedAuth.set(token, playerData);
        
        // Auto-expire token after 1 hour
        setTimeout(() => {
            this.sharedAuth.delete(token);
        }, 3600000);
    }
    
    validateAuthToken(token: string): any {
        return this.sharedAuth.get(token);
    }
    
    private generateInstanceId(): string {
        return `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    private generateClientId(): string {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    private getNextAvailablePort(): number {
        const usedPorts = new Set(
            Array.from(this.instances.values()).map(i => i.port)
        );
        
        let port = 8080;
        while (usedPorts.has(port)) {
            port++;
        }
        
        return port;
    }
    
    private getPlayerIdByClientId(instance: GameInstance, clientId: string): string | undefined {
        // This would need to be tracked when players authenticate
        // For now, return undefined
        return undefined;
    }
    
    async cleanup() {
        // Stop all instances
        for (const instance of this.instances.values()) {
            if (instance.status === "running") {
                await this.stopInstance(instance.id);
            }
        }
        
        this.instances.clear();
        this.playerInstances.clear();
        this.sharedAuth.clear();
    }
}