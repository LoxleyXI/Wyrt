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
import { EventEmitter } from "events";

// Types
import { User } from "./types/User";

import { RateLimiter } from "./server/RateLimiter";
import { AuthManager } from "./server/AuthManager";

// Module system
import { ModuleManager } from "./module/ModuleManager";
import { ModuleContext } from "./module/ModuleContext";
import { ModuleCommands } from "./module/ModuleCommands";
import { ModuleRequestTypes } from "./module/ModuleRequestTypes";
import { ModuleData } from "./module/ModuleData";
import { ModuleLoader } from "./module/ModuleLoader";
import { ConsoleLogger } from "./server/ConsoleLogger";
import { HttpServer } from "./server/HttpServer";
import { WebManager } from "./server/WebManager";

// Systems
import server from "../config/server.json";
import { Connection } from "mysql";

//----------------------------------
// Data containers
//----------------------------------
const config: any = { server: server }
const data: ModuleData = new ModuleData();
const commands: ModuleCommands = new ModuleCommands();
const logger = new ConsoleLogger();
const events = new EventEmitter();

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

const requestTypes = new ModuleRequestTypes();

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
// Module System Setup
//----------------------------------
const moduleContext: ModuleContext = {
    connection,
    data,
    commands,
    requestTypes,
    authManager,
    rateLimiter,
    config,
    events,
    logger
};

const moduleManager = new ModuleManager(moduleContext);

//----------------------------------
// Load modules and data
//----------------------------------
async function initializeServer() {
    try {
        // Initialize module loader
        ModuleLoader.init(data);
        
        // Load modules (always active)
        const moduleDir = "./modules";
        await moduleManager.loadModulesFromDirectory(moduleDir);
        
        logger.info("Server initialization complete");
    }

    catch (error) {
        logger.error("Failed to initialize server:", error);
        process.exit(1);
    }
}

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
            logger.warn(`User ${userId} exceeded rate limit for ${request.type}`);

            return;
        }

        // Check authentication requirement
        if (handler.auth && !u.isAuthenticated()) {
            u.error("Authentication required");

            return;
        }

        // Emit event for modules
        events.emit('requestReceived', u, request);

        // Log request (in dev mode)
        if (config.server.options.dev) {
            logger.debug(`${userId} -> ${request.type} (cost: ${handler.cost})`);
        }

        // Execute handler
        Promise.resolve(handler.exec(u, data, request, moduleContext))
            .then(() => {
                events.emit('requestCompleted', u, request);
            })
            .catch(error => {
                logger.error(`Handler Error for ${request.type}:`, error);
                u.error("Request processing failed");
                events.emit('requestError', u, request, error);
            });

    } catch (exception) {
        logger.warn(`Client sent invalid request:`, exception);
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

        logger.info(`Connection from ${clientIP} (ID: ${u.id})`);
        events.emit('playerConnected', u);

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
            logger.info(`Disconnection: ${clientIP} (ID: ${u.id})`);
            
            // Emit events for modules
            if (u.player.authenticated) {
                events.emit('playerLogout', u);
                logger.info(`Player ${u.player.name} disconnected`);
            }
            
            events.emit('playerDisconnected', u);
            delete data.users[u.id];
        });

        ws.on("error", function(error: Error) {
            logger.error(`WebSocket error for user ${u.id}:`, error);
            events.emit('connectionError', u, error);
        });
    });
}

//----------------------------------
// WebSocket Server Setup
//----------------------------------
async function startServer() {
    try {
        // Initialize everything
        await initializeServer();

        // Start HTTP server for authentication
        const httpServer = new HttpServer(moduleContext, config.server.ports.web || 3001);
        httpServer.start();

        // Start module web applications
        const webManager = new WebManager(undefined, config);
        await webManager.start();

        // Start WebSocket server
        if (config.server.options.dev) {
            const wss = new WebSocketServer({ port: config.server.ports.socket });
            onConnection(wss);
            logger.info(`WebSocket Server (DEV) :${config.server.ports.socket}`);
        }

        else {
            const serverHttps = https.createServer({
                cert: fs.readFileSync(`./config/${config.server.certificates.cert}`),
                key: fs.readFileSync(`./config/${config.server.certificates.key}`),
            }).listen(config.server.ports.socket);

            const wss = new WebSocketServer({ server: serverHttps });

            onConnection(wss);
            logger.info(`WebSocket Server (HTTPS) :${config.server.ports.socket}`);
        }

        // Setup cleanup intervals
        setInterval(() => {
            rateLimiter.cleanup();
        }, config.server.rateLimiting?.cleanupInterval || 300000);

        events.emit('serverStarted');
        logger.info("=== Server ready ===");

    }

    catch (error) {
        logger.error("Failed to start server:", error);
        process.exit(1);
    }
}

//----------------------------------
// Graceful shutdown
//----------------------------------
function serverClose() {
    logger.info("\n=== Server shutting down ===");

    events.emit('serverShutdown');

    moduleManager.stopFileWatchers();

    if (connection) {
        connection.end();
    }

    process.exit(0);
}

process.on("SIGINT", serverClose);
process.on("SIGTERM", serverClose);

// Start the server
startServer().catch(error => {
    logger.error("Failed to start server:", error);
    process.exit(1);
});
