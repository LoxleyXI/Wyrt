// File: modules/core/requests/login.ts
import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";
import mysql from "mysql";

const handler: Request = {
    cost: 5,
    auth: false,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        const { username, password } = payload;

        if (!username || !password) {
            u.error("Username and password required");
            return;
        }

        try {
            // First check account credentials
            context.connection.query("SELECT id, username, password_hash, status FROM accounts WHERE username = ?", [username], async (error, results) => {
                if (error) {
                    console.error("Database error:", error);
                    u.error("Authentication failed");
                    return;
                }

                if (results.length === 0) {
                    u.error("Invalid credentials");
                    return;
                }

                const account = results[0];
                
                // Check account status
                if (account.status !== 'active') {
                    u.error(`Account is ${account.status}`);
                    return;
                }

                const isValidPassword = await context.authManager.comparePassword(password, account.password_hash);

                if (!isValidPassword) {
                    u.error("Invalid credentials");
                    return;
                }

                // Generate auth token
                const token = context.authManager.generateToken({
                    accountId: account.id,
                    username: account.username
                });

                // Update last login
                context.connection.query("UPDATE accounts SET last_login = NOW() WHERE id = ?", [account.id]);

                // Create session
                const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
                
                context.connection.query(
                    "INSERT INTO sessions (id, account_id, token, ip_address, expires_at) VALUES (?, ?, ?, ?, ?)",
                    [sessionId, account.id, token, u.clientIP || 'unknown', expiresAt]
                );

                // Store account info in user object
                u.account = {
                    id: account.id,
                    username: account.username,
                    authenticated: true
                };

                // Send success response
                u.system(JSON.stringify({
                    type: "auth_success",
                    token: token,
                    sessionId: sessionId,
                    account: {
                        id: account.id,
                        username: account.username
                    }
                }));

                // Emit authentication event
                context.events.emit('accountAuthenticated', u);
            });
        } catch (error) {
            console.error("Authentication error:", error);
            u.error("Authentication failed");
        }
    }
};

export default handler;
