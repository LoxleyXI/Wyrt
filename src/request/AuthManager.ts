import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

//----------------------------------
// Authentication Manager
//----------------------------------
export interface AuthPayload {
    userId: number;
    username: string;
    gmlv: number;
    iat?: number;
    exp?: number;
}

export class AuthManager {
    private readonly jwtSecret: string;
    private readonly jwtExpiration: string;

    constructor(secret: string, expiration: string = "24h") {
        this.jwtSecret = secret;
        this.jwtExpiration = expiration;
    }

    public generateToken(payload: AuthPayload): string {
        return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiration });
    }

    public verifyToken(token: string): AuthPayload | null {
        try {
            return jwt.verify(token, this.jwtSecret) as AuthPayload;
        } catch (error) {
            return null;
        }
    }

    public async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, 12);
    }

    public async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(password, hashedPassword);
    }
}
