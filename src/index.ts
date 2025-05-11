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
import express from "express";
import mysql from "mysql";
import net from "net";
import { WebSocketServer } from "ws";
import fs from "fs";
import SHA2 from "sha2";
import https from "https";
import yaml from "js-yaml";

// Types
import { Data } from "./types/Data";
import { User } from "./types/User";

// Systems
import server from "../config/server.json";
import { Loader } from "./server/Loader";
import { Commands } from "./server/Commands";

//----------------------------------
// Data containers
//----------------------------------
const config: any = { server: server }
const data: Data = new Data();
const commands: Commands = new Commands();

//----------------------------------
// Database connection
//----------------------------------
if (!config.server.options.nodb) {
    const connection = mysql.createConnection(config.server.db);

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
// User inbound
//----------------------------------
function onReceived(u: User, input: string) {
    // TODO: Check player state
    // TODO: Check player HP

    try {
        const result = JSON.parse(input);

        // TODO: Process movement

        if (result.type === "command") {
            const command = commands.cmd[result.name];

            if (!config.server.options.dev && command.gmlv && u.player.gmlv < command.gmlv) {
                console.log(`[Player] ${u.player.name} does not have sufficient GM Level to use '${result.name}'.`);
            } else {
                command.exec(u, data, result.args);
            }
        }
    } catch (exception) {
        console.log(`[Player] Client sent invalid response.`);
        console.log(exception);
    }
}

function onConnection(wss: WebSocketServer) {
    wss.on("connection", (ws: WebSocketServer) => {
        data.counter++;
        const u = new User(ws, data.counter);
        data.users[u.id] = u;

        // TODO: Trigger first action
        // account.showMainMenu(u.socket)
        u.system("connection");

        ws.on("message", function(received: string) {
            /*
            if (msg.length < config.options.ratePoolSize) {
                u.msg.push(received)
            }
            */

            onReceived(u, received)
        });

        ws.on("close", function() {
            console.log("- connection: ");
            // TODO: Remove player from area
            delete data.users[u.id];
        });
    });
}

//----------------------------------
// WebSocket Server
//----------------------------------
if (config.server.options.dev) {
    const wss = new WebSocketServer({ port: config.server.ports.socket });
    onConnection(wss);
}
else {
    const serverHttps = https.createServer({
        cert: fs.readFileSync(`./config/${config.server.certificates.cert}`),
        key:  fs.readFileSync(`./config/${config.server.certificates.key}`),
    }).listen(config.server.ports.socket);

    const wss = new WebSocketServer({ server: serverHttps });
    onConnection(wss);
}

console.log(`=== WebSocket Server :${config.server.ports.socket} ===`);

//----------------------------------
// Web Server
//----------------------------------
if (config.server.options.web) {
    const app  = express();
    const port = config.server.ports.web;

    app.set("view engine", "ejs");
    app.set("views", "./www/views");

    var jsonParser = express.json();

    app.get("/", (req, res) => {
      res.render("index");
    });

    app.use("/static", express.static("www/static"));

    app.listen(port, () => {
      console.log(`=== Web Server :${config.server.ports.web} ===`);
    });
}
