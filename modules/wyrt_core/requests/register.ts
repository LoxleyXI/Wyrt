// File: modules/core/requests/register.ts
import { Request } from "../../../src/types/Request";
import { User } from "../../../src/types/User";
import { Data } from "../../../src/types/Data";
import mysql from "mysql";

const handler: Request = {
    cost: 10,
    auth: false,
    exec: async function(u: User, data: Data, payload: any, context?: any) {
        const { username, password, email } = payload;

        if (!username || !password) {
            u.error("Username and password required");
            return;
        }

        if (!context.connection) {
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
            // Note: In real implementation, you'd hash the password with bcrypt
            const query = "INSERT INTO chars (name, password, email) VALUES (?, ?, ?)";

            context.connection.query(query, [username, password, email || null], (error: any, results: any) => {
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

export default handler;
