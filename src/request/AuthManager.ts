//----------------------------------
// Wyrt - An MMO Engine
//----------------------------------
// Copyright (c) 2025 LoxleyXI
//
// https://github.com/LoxleyXI/Wyrt
//----------------------------------
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see http://www.gnu.org/licenses/
//----------------------------------
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
