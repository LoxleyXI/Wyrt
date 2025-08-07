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
            context.connection.query("SELECT charid, name, password, gmlv FROM chars WHERE name = ?", [username], async (error, results) => {
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
                const isValidPassword = await context.authManager.comparePassword(password, user.password);

                if (!isValidPassword) {
                    console.log("password")
                    u.error("Invalid credentials");
                    return;
                }

                const token = context.authManager.generateToken({
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
            });
        } catch (error) {
            console.error("Authentication error:", error);
            u.error("Authentication failed");
        }
    }
};

export default handler;
