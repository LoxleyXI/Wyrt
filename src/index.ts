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
// Third-party
import net from "net";
import { WebSocketServer } from "ws";
import fs from "fs";
import SHA2 from "sha2";
import https from "https";
import yaml from "js-yaml";
import mysql from "mysql";

// Types
import { Data } from "./types/Data";
import { User } from "./types/User";

import { RateLimiter } from "./request/RateLimiter";
import { RequestTypes } from "./request/Request";
import { AuthManager } from "./request/AuthManager";

// Systems
import server from "../config/server.json";
import { Loader } from "./server/Loader";
import { Commands } from "./server/Commands";
import { Connection } from "mysql";

//----------------------------------
// Data containers
//----------------------------------
const config: any = { server: server }
const data: Data = new Data();
const commands: Commands = new Commands();

//----------------------------------
// Authentication and rate limiting
//----------------------------------
const rateLimiter = new RateLimiter(
    config.server.rateLimiting?.bucketCapacity || 100,
    config.server.rateLimiting?.refillRate || 10
);

const authManager = new AuthManager(
    process.env.JWT_SECRET || config.server.auth?.jwtSecret || "secret",
    config.server.auth?.jwtExpiration || "24h"
);

const requestTypes = new RequestTypes(authManager, commands, config);

//----------------------------------
// Database connection
//----------------------------------
let connection: Connection;

 if (!config.server.options.nodb) {
     connection = mysql.createConnection(config.server.db);

     if (!config.server.nodb) {
         connection.connect();
         console.log(`=== Database connected ===`);
     }
 }

//----------------------------------
// Load data
//----------------------------------
Loader.init(data);

//----------------------------------
// Request handler
//----------------------------------
function onReceived(u: User, input: string) {
    try {
        const request = JSON.parse(input);

        if (!request.type || typeof request.type !== "string" || !requestTypes.handlers[request.type]) {
            u.error("Invalid request: missing, invalid or unknown type");
            return;
        }

        const handler = requestTypes.handlers[request.type];

        const userId = u.player.authenticated ? u.player.charid?.toString() : u.id.toString();

        if (!rateLimiter.checkLimit(userId, handler.cost)) {
            u.error("Rate limit exceeded.");
            console.log(`[RateLimit] User ${userId} exceeded rate limit for ${request.type}`);
            return;
        }

        // Check authentication requirement
        if (handler.auth && !u.isAuthenticated()) {
            u.error("Authentication required");
            return;
        }

        // Log request (in dev mode)
        if (config.server.options.dev) {
            console.log(`[Request] ${userId} -> ${request.type} (cost: ${handler.cost})`);
        }

        // Execute handler
        Promise.resolve(handler.exec(u, data, request, connection))
            .catch(error => {
                console.error(`[Handler Error] ${type}:`, error);
                u.error("Request processing failed");
            });

    } catch (exception) {
        console.log(`[Player] Client sent invalid request:`, exception);
        u.error("Invalid request format");
    }
}

//----------------------------------
// Connection handler
//----------------------------------
function onConnection(wss: WebSocketServer) {
    wss.on("connection", (ws: any, req: any) => {
        data.counter++;
        const u = new User(ws, data.counter);
        data.users[u.id] = u;

        const clientIP = req.socket.remoteAddress || req.headers["x-forwarded-for"] || "unknown";
        u.clientIP = clientIP;

        console.log(`+ connection from ${clientIP} (ID: ${u.id})`);

        u.system(JSON.stringify({
            type: "initial",
            server: config.server.info.name || "wyrt",
            version: config.server.info.version || "1.0.0",
            timestamp: Date.now()
        }));

        ws.on("message", function(received: Buffer) {
            const message = received.toString();

            // Basic message size validation
            if (message.length > 10000) { // 10KB limit
                u.error("Message too large");
                return;
            }

            onReceived(u, message);
        });

        ws.on("close", function() {
            console.log(`- connection: ${clientIP} (ID: ${u.id})`);
            
            // Remove player from area if they were in game
            if (u.player.authenticated) {
                // TODO: Handle player logout in game world
                console.log(`Player ${u.player.name} disconnected`);
            }

            delete data.users[u.id];
        });

        ws.on("error", function(error: Error) {
            console.error(`WebSocket error for user ${u.id}:`, error);
        });
    });
}

//----------------------------------
// WebSocket Server
//----------------------------------
try {
    if (config.server.options.dev) {
        const wss = new WebSocketServer({ port: config.server.ports.socket });
        onConnection(wss);
        console.log(`=== WebSocket Server (DEV) :${config.server.ports.socket} ===`);
    } else {
        const serverHttps = https.createServer({
            cert: fs.readFileSync(`./config/${config.server.certificates.cert}`),
            key: fs.readFileSync(`./config/${config.server.certificates.key}`),
        }).listen(config.server.ports.socket);

        const wss = new WebSocketServer({ server: serverHttps }); onConnection
        (wss); console.log(`=== WebSocket Server (HTTPS) :$
        {config.server.ports.socket} ===`); 
    }
}
catch (error) { console.error
    ("Failed to start WebSocket server:", error); process.exit(1);
}

//----------------------------------
// Close connections on shut down
//----------------------------------
function serverClose() {
    console.log(`\n=== Server shutdown down ===`);

    if (connection) {
        connection.end();
    }

    process.exit(0);
}

process.on("SIGINT", serverClose);
process.on("SIGTERM", serverClose);
