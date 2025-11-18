import { EventEmitter } from "events";
import jwt from "jsonwebtoken";
import { Database } from "./Database";
import { Logger } from "./ConsoleLogger";
import crypto from "crypto";

export interface AuthToken {
    token: string;
    playerId: string;
    accountId: string;
    playerName: string;
    email?: string;
    instances: string[]; // List of instance IDs player has access to
    permissions: string[];
    createdAt: number;
    expiresAt: number;
    refreshToken?: string;
}

export interface PlayerSession {
    playerId: string;
    accountId: string;
    playerName: string;
    currentInstance?: string;
    instances: Map<string, InstanceSession>; // instanceId -> session data
    lastActivity: number;
    loginTime: number;
    ipAddress?: string;
}

export interface InstanceSession {
    instanceId: string;
    joinedAt: number;
    lastActivity: number;
    characterData?: any; // Instance-specific character data
    position?: any; // Last known position in instance
}

export class SharedAuthService extends EventEmitter {
    private sessions: Map<string, PlayerSession> = new Map();
    private tokens: Map<string, AuthToken> = new Map();
    private refreshTokens: Map<string, string> = new Map(); // refreshToken -> playerId
    private database?: Database;
    private logger: Logger;
    private jwtSecret: string;
    private tokenExpiration: number = 3600000; // 1 hour
    private refreshTokenExpiration: number = 604800000; // 7 days
    private sessionTimeout: number = 1800000; // 30 minutes
    
    constructor(logger: Logger, database?: Database, jwtSecret?: string) {
        super();
        this.logger = logger;
        this.database = database;
        this.jwtSecret = jwtSecret || process.env.JWT_SECRET || this.generateSecret();
        
        // Start cleanup interval
        setInterval(() => this.cleanup(), 60000); // Cleanup every minute
    }
    
    private generateSecret(): string {
        return crypto.randomBytes(64).toString('hex');
    }
    
    async authenticate(username: string, password: string, ipAddress?: string): Promise<AuthToken | null> {
        try {
            // Validate credentials against database
            if (this.database) {
                const result = await this.database.validateCredentials(username, password);
                if (!result) {
                    this.logger.warn(`Failed authentication attempt for ${username} from ${ipAddress}`);
                    return null;
                }
                
                // Create session
                const session = await this.createSession(result.playerId, result.accountId, username, ipAddress);
                
                // Generate tokens
                const authToken = this.generateAuthToken(session);
                
                this.logger.info(`Player ${username} authenticated successfully from ${ipAddress}`);
                this.emit("playerAuthenticated", session);
                
                return authToken;
            }
            
            // Fallback for testing without database
            const playerId = `player_${username}`;
            const accountId = `account_${username}`;
            const session = await this.createSession(playerId, accountId, username, ipAddress);
            return this.generateAuthToken(session);
            
        } catch (error) {
            this.logger.error(`Authentication error:`, error);
            return null;
        }
    }
    
    private async createSession(
        playerId: string, 
        accountId: string, 
        playerName: string, 
        ipAddress?: string
    ): Promise<PlayerSession> {
        const session: PlayerSession = {
            playerId,
            accountId,
            playerName,
            instances: new Map(),
            lastActivity: Date.now(),
            loginTime: Date.now(),
            ipAddress
        };
        
        this.sessions.set(playerId, session);
        return session;
    }
    
    private generateAuthToken(session: PlayerSession): AuthToken {
        const tokenId = crypto.randomBytes(16).toString('hex');
        const now = Date.now();
        
        const payload = {
            tokenId,
            playerId: session.playerId,
            accountId: session.accountId,
            playerName: session.playerName,
            iat: Math.floor(now / 1000),
            exp: Math.floor((now + this.tokenExpiration) / 1000)
        };
        
        const token = jwt.sign(payload, this.jwtSecret);
        const refreshToken = crypto.randomBytes(32).toString('hex');
        
        const authToken: AuthToken = {
            token,
            playerId: session.playerId,
            accountId: session.accountId,
            playerName: session.playerName,
            instances: [],
            permissions: [],
            createdAt: now,
            expiresAt: now + this.tokenExpiration,
            refreshToken
        };
        
        // Load player permissions from database
        if (this.database) {
            this.loadPlayerPermissions(session.playerId).then(permissions => {
                authToken.permissions = permissions;
                authToken.instances = this.getPlayerInstances(session.playerId);
            });
        }
        
        this.tokens.set(token, authToken);
        this.refreshTokens.set(refreshToken, session.playerId);
        
        return authToken;
    }
    
    async validateToken(token: string): Promise<AuthToken | null> {
        try {
            // Check if token exists in cache
            const cachedToken = this.tokens.get(token);
            if (cachedToken && cachedToken.expiresAt > Date.now()) {
                return cachedToken;
            }
            
            // Verify JWT
            const decoded = jwt.verify(token, this.jwtSecret) as any;
            
            // Check if session exists
            const session = this.sessions.get(decoded.playerId);
            if (!session) {
                return null;
            }
            
            // Update last activity
            session.lastActivity = Date.now();
            
            // Return token data
            return {
                token,
                playerId: decoded.playerId,
                accountId: decoded.accountId,
                playerName: decoded.playerName,
                instances: this.getPlayerInstances(decoded.playerId),
                permissions: await this.loadPlayerPermissions(decoded.playerId),
                createdAt: decoded.iat * 1000,
                expiresAt: decoded.exp * 1000
            };
            
        } catch (error) {
            this.logger.debug(`Token validation failed:`, error);
            return null;
        }
    }
    
    async refreshAuthToken(refreshToken: string): Promise<AuthToken | null> {
        const playerId = this.refreshTokens.get(refreshToken);
        if (!playerId) {
            return null;
        }
        
        const session = this.sessions.get(playerId);
        if (!session) {
            return null;
        }
        
        // Remove old refresh token
        this.refreshTokens.delete(refreshToken);
        
        // Generate new tokens
        return this.generateAuthToken(session);
    }
    
    async joinInstance(playerId: string, instanceId: string, characterData?: any): Promise<boolean> {
        const session = this.sessions.get(playerId);
        if (!session) {
            return false;
        }
        
        // Check if player has permission to join this instance
        if (!this.canJoinInstance(playerId, instanceId)) {
            return false;
        }
        
        // Create instance session
        const instanceSession: InstanceSession = {
            instanceId,
            joinedAt: Date.now(),
            lastActivity: Date.now(),
            characterData
        };
        
        session.instances.set(instanceId, instanceSession);
        session.currentInstance = instanceId;
        session.lastActivity = Date.now();
        
        this.emit("playerJoinedInstance", {
            playerId,
            instanceId,
            session: instanceSession
        });
        
        return true;
    }
    
    async leaveInstance(playerId: string, instanceId: string): Promise<boolean> {
        const session = this.sessions.get(playerId);
        if (!session) {
            return false;
        }
        
        const instanceSession = session.instances.get(instanceId);
        if (!instanceSession) {
            return false;
        }
        
        session.instances.delete(instanceId);
        
        if (session.currentInstance === instanceId) {
            session.currentInstance = undefined;
        }
        
        this.emit("playerLeftInstance", {
            playerId,
            instanceId,
            session: instanceSession
        });
        
        return true;
    }
    
    async transferInstance(
        playerId: string, 
        fromInstanceId: string, 
        toInstanceId: string
    ): Promise<boolean> {
        const session = this.sessions.get(playerId);
        if (!session) {
            return false;
        }
        
        // Leave current instance
        await this.leaveInstance(playerId, fromInstanceId);
        
        // Get character data from source instance
        const fromSession = session.instances.get(fromInstanceId);
        const characterData = fromSession?.characterData;
        
        // Join new instance
        return await this.joinInstance(playerId, toInstanceId, characterData);
    }
    
    getSession(playerId: string): PlayerSession | undefined {
        return this.sessions.get(playerId);
    }
    
    getInstanceSession(playerId: string, instanceId: string): InstanceSession | undefined {
        const session = this.sessions.get(playerId);
        return session?.instances.get(instanceId);
    }
    
    updateInstanceData(playerId: string, instanceId: string, data: any) {
        const session = this.sessions.get(playerId);
        if (!session) return;
        
        const instanceSession = session.instances.get(instanceId);
        if (instanceSession) {
            instanceSession.characterData = { ...instanceSession.characterData, ...data };
            instanceSession.lastActivity = Date.now();
        }
    }
    
    updatePosition(playerId: string, instanceId: string, position: any) {
        const session = this.sessions.get(playerId);
        if (!session) return;
        
        const instanceSession = session.instances.get(instanceId);
        if (instanceSession) {
            instanceSession.position = position;
            instanceSession.lastActivity = Date.now();
        }
    }
    
    private canJoinInstance(playerId: string, instanceId: string): boolean {
        // Check permissions, instance restrictions, etc.
        // For now, allow all
        return true;
    }
    
    private getPlayerInstances(playerId: string): string[] {
        // Get list of instances player has access to
        // This would typically be loaded from database
        return ["my_game", "demo_game", "arena"];
    }
    
    private async loadPlayerPermissions(playerId: string): Promise<string[]> {
        // Load permissions from database
        if (this.database) {
            // return await this.database.getPlayerPermissions(playerId);
        }
        return ["play", "chat", "trade"];
    }
    
    async logout(playerId: string): Promise<void> {
        const session = this.sessions.get(playerId);
        if (!session) return;
        
        // Leave all instances
        for (const instanceId of session.instances.keys()) {
            await this.leaveInstance(playerId, instanceId);
        }
        
        // Remove tokens
        for (const [token, authToken] of this.tokens) {
            if (authToken.playerId === playerId) {
                this.tokens.delete(token);
            }
        }
        
        // Remove refresh tokens
        for (const [refreshToken, id] of this.refreshTokens) {
            if (id === playerId) {
                this.refreshTokens.delete(refreshToken);
            }
        }
        
        // Remove session
        this.sessions.delete(playerId);
        
        this.emit("playerLoggedOut", playerId);
        this.logger.info(`Player ${session.playerName} logged out`);
    }
    
    private cleanup() {
        const now = Date.now();
        
        // Clean up expired tokens
        for (const [token, authToken] of this.tokens) {
            if (authToken.expiresAt < now) {
                this.tokens.delete(token);
            }
        }
        
        // Clean up inactive sessions
        for (const [playerId, session] of this.sessions) {
            if (now - session.lastActivity > this.sessionTimeout) {
                this.logger.info(`Session timeout for player ${session.playerName}`);
                this.logout(playerId);
            }
        }
    }
    
    getOnlinePlayers(): PlayerSession[] {
        return Array.from(this.sessions.values());
    }
    
    getInstancePlayers(instanceId: string): PlayerSession[] {
        return Array.from(this.sessions.values()).filter(session => 
            session.instances.has(instanceId)
        );
    }
    
    async shutdown() {
        // Log out all players
        for (const playerId of this.sessions.keys()) {
            await this.logout(playerId);
        }
        
        this.sessions.clear();
        this.tokens.clear();
        this.refreshTokens.clear();
    }
}