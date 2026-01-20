import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

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
            const account = await context.prisma.account.findUnique({
                where: { username: username },
                select: {
                    id: true,
                    username: true,
                    password_hash: true,
                    status: true
                }
            });

            if (!account) {
                u.error("Invalid credentials");
                return;
            }

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

            // Update last login (fire and forget)
            context.prisma.account.update({
                where: { id: account.id },
                data: { last_login: new Date() }
            }).catch(err => console.error("Failed to update last_login:", err));

            // Create session
            const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            await context.prisma.legacySession.create({
                data: {
                    id: sessionId,
                    account_id: account.id,
                    token: token,
                    ip_address: u.clientIP || 'unknown',
                    expires_at: expiresAt
                }
            });

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
        } catch (error) {
            console.error("Authentication error:", error);
            u.error("Authentication failed");
        }
    }
};

export default handler;
