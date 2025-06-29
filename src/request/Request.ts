import mysql from "mysql";

import server from "../../config/server.json";
const config: any = { server: server }

//----------------------------------
// Request Types System
//----------------------------------
export interface RequestHandler {
    cost: number;
    auth: boolean;
    exec: (u: User, data: Data, payload: any) => Promise<void> | void;
}

export class RequestTypes {
    public handlers: Record<string, RequestHandler>;

    constructor(authManager: AuthManager, commands: Commands) {
        this.handlers = {};

        //----------------------------------
        // Authentication
        //----------------------------------
        this.handlers["login"] = {
            cost: 5,
            auth: false,
            exec: async function(u: User, data: Data, payload: any) {
                const { username, password } = payload;

                if (!username || !password) {
                    u.error("Username and password required");
                    return;
                }

                try {
                    const connection = mysql.createConnection(config.server.db);
                    const query = "SELECT charid, name, password, gmlv FROM chars WHERE name = ?";
                    
                    connection.query(query, [username], async (error, results) => {
                        if (error) {
                            console.error("Database error:", error);
                            u.error("Authentication failed");
                            return;
                        }

                        if (results.length === 0) {
                            u.error("Invalid credentials");
                            return;
                        }

                        const user = results[0];
                        const isValidPassword = await authManager.comparePassword(password, user.password);

                        if (!isValidPassword) {
                            console.log("password")
                            u.error("Invalid credentials");
                            return;
                        }

                        const token = authManager.generateToken({
                            userId: user.charid,
                            username: user.name,
                            gmlv: user.gmlv
                        });

                        u.player = {
                            charid: user.charid,
                            name: user.name,
                            gmlv: user.gmlv,
                            authenticated: true
                        };

                        u.system(JSON.stringify({
                            type: "auth_success",
                            token: token,
                            user: {
                                id: user.charid,
                                name: user.name,
                                gmlv: user.gmlv
                            }
                        }));

                        connection.end();
                    });
                } catch (error) {
                    console.error("Authentication error:", error);
                    u.error("Authentication failed");
                }
            }
        };

        //----------------------------------
        // Verify Token
        //----------------------------------
        this.handlers["verify"] = {
            cost: 2,
            auth: false,
            exec: function(u: User, data: Data, payload: any) {
                const { token } = payload;

                if (!token) {
                    u.error("Token required");
                    return;
                }

                const authResult = authManager.verifyToken(token);

                if (!authResult) {
                    u.error("Invalid or expired token");
                    return;
                }

                u.player = {
                    charid: authResult.userId,
                    name: authResult.username,
                    gmlv: authResult.gmlv,
                    authenticated: true
                };

                u.system(JSON.stringify({
                    type: "verify_success",
                    user: {
                        id: authResult.userId,
                        name: authResult.username,
                        gmlv: authResult.gmlv
                    }
                }));
            }
        };

        //----------------------------------
        // Command
        //----------------------------------
        this.handlers["command"] = {
            cost: 3,
            auth: true,
            exec: function(u: User, data: Data, payload: any) {
                const { name, args } = payload;
                const command = commands.cmd[name];

                if (!command) {
                    u.error(`Unknown command: ${name}`);
                    return;
                }

                if (!config.server.options.dev && command.gmlv && u.player.gmlv < command.gmlv) {
                    u.error(`Insufficient privileges for command: ${name}`);
                    return;
                }

                command.exec(u, data, args || []);
            }
        };

        //----------------------------------
        // Chat
        //----------------------------------
        this.handlers["chat"] = {
            cost: 2,
            auth: true,
            exec: function(u: User, data: Data, payload: any) {
                const { message } = payload;

                if (!message || message.trim().length === 0) {
                    u.error("Empty message");
                    return;
                }

                // TODO: Implement chat system
                // For now, just echo the message
                u.chat(`${u.player.name}: ${message}`);

                // TODO: Send only to players in current room
                for (const otherUser of Object.values(data.users)) {
                    if (otherUser.id !== u.id && otherUser.player.authenticated) {
                        otherUser.chat(`${u.player.name}: ${message}`);
                    }
                }
            }
        };

        //----------------------------------
        // Move
        //----------------------------------
        this.handlers["move"] = {
            cost: 1,
            auth: true,
            exec: function(u: User, data: Data, payload: any) {
                // TODO: Implement movement
                const { x, y, z } = payload;

                u.system(JSON.stringify({
                    type: "movement_result",
                    success: true,
                    direction: 0,
                    coordinates: { x, y, z }
                }));

                console.log(`[Move] ${u.player.name}: ${x}, ${y}, ${z}`);
            }
        };

        //----------------------------------
        // Heartbeat
        //----------------------------------
        this.handlers["heartbeat"] = {
            cost: 1,
            auth: false,
            exec: function(u: User, data: Data, payload: any) {
                u.system(JSON.stringify({
                    type: "heartbeat_response",
                    timestamp: Date.now(),
                    authenticated: u.isAuthenticated()
                }));
            }
        };

        //----------------------------------
        // Register Request (if enabled)
        //----------------------------------
        if (config.server.options.allowRegistration) {
            this.handlers["register"] = {
                cost: 10,
                auth: false,
                exec: async function(u: User, data: Data, payload: any, db?: mysql.Connection | null) {
                    const { username, password, email } = payload;

                    if (!username || !password) {
                        u.error("Username and password required");
                        return;
                    }

                    if (!db) {
                        u.error("Database not available");
                        return;
                    }

                    if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
                        u.error("Username must be 3-20 characters and may only contain alphanumeric characters or underscores");
                        return;
                    }

                    if (password.length < 4) {
                        u.error("Password must be at least 4 characters");
                        return;
                    }

                    try {
                        const hashedPassword = await authManager.hashPassword(password);
                        const query = "INSERT INTO chars (name, password, email) VALUES (?, ?, ?)";
                        
                        db.query(query, [username, hashedPassword, email || null], (error: any, results: any) => {
                            if (error) {
                                if (error.code === "ER_DUP_ENTRY") {
                                    u.error("Username already exists");
                                } else {
                                    console.error("Registration error:", error);
                                    u.error("Registration failed");
                                }
                                return;
                            }

                            u.system(JSON.stringify({
                                type: "registration_success",
                                name: username,
                                message: `Account successfully created: ${username}`
                            }));

                            console.log(`[Register] New account created: ${username}`);
                        });
                    } catch (error) {
                        console.error("Registration error:", error);
                        u.error("Registration failed");
                    }
                }
            };
        }
    }
}
