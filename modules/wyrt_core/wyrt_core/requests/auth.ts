import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 1,
    auth: false,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        const { token } = payload;

        if (!token) {
            u.error("No token provided");
            return;
        }

        try {
            // Verify JWT token
            const decoded = context.authManager.verifyToken(token);
            
            if (!decoded) {
                u.error("Invalid or expired token");
                return;
            }

            // Store account info in user object
            u.account = {
                id: decoded.userId,
                username: decoded.username,
                authenticated: true
            };

            // Send success response
            u.system(JSON.stringify({
                type: "auth_success",
                account: {
                    id: decoded.userId,
                    username: decoded.username
                }
            }));

            context.logger.info(`User authenticated via WebSocket: ${decoded.username} (ID: ${decoded.userId})`);
            
            // Emit authentication event
            context.events.emit('userAuthenticated', u);

        } catch (error) {
            console.error("Token verification error:", error);
            u.error("Authentication failed");
        }
    }
};

export default handler;