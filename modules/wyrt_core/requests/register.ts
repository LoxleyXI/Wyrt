import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";

const handler: Request = {
    cost: 10,
    auth: false,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        const { username, password, email } = payload;

        if (!username || !password) {
            u.error("Username and password required");
            return;
        }

        if (!context.db) {
            u.error("Database not available");
            return;
        }

        if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
            u.error("Username must be 3-20 characters and may only contain alphanumeric characters or underscores");
            return;
        }

        if (password.length < 6) {
            u.error("Password must be at least 6 characters");
            return;
        }

        try {
            // Check if username exists
            const [existingUsers] = await context.db.query(
                "SELECT id FROM accounts WHERE username = ?",
                [username]
            );

            if (existingUsers.length > 0) {
                u.error("Username already taken");
                return;
            }

            // Hash password
            const hashedPassword = await context.authManager.hashPassword(password);

            // Create account
            const [result] = await context.db.query(
                "INSERT INTO accounts (username, email, password_hash) VALUES (?, ?, ?)",
                [username, email || `${username}@example.com`, hashedPassword]
            );

            const userId = result.insertId;

            // Generate token
            const token = context.authManager.generateToken({
                userId: userId,
                username: username,
                gmlv: 0
            });

            u.system(JSON.stringify({
                type: "registration_success",
                token: token,
                userId: userId,
                username: username,
                message: `Account created successfully`
            }));

            context.logger.info(`[Register] New account created: ${username} (ID: ${userId})`);
        } catch (error: any) {
            context.logger.error("Registration error:", error);
            u.error("Registration failed");
        }
    }
};

export default handler;
