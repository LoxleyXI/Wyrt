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
const express = require("express")
const mysql   = require("mysql")
const net     = require("net")
const wsocket = require("ws")
const fs      = require("fs")
const SHA2    = require("sha2")
const https   = require("https")
const yaml    = require("js-yaml")

// Systems
const config  = require("./config/server.js")
/*
const util    = require("./server/util")
const loader  = require("./server/loader")
const cmd     = require("./server/commands")
*/

//----------------------------------
// Data containers
//----------------------------------
const data = { users: {}, counter: 0 }

//----------------------------------
// Create command aliases
//----------------------------------
/*
for (var func in cmd) {
    if (
        cmd[func].alias &&
        cmd[func].alias.length
    ) {
        for (var other in cmd[func].alias) {
            cmd[cmd[func].alias[other]] = cmd[func]
        }
    }
}
*/

//----------------------------------
// Database connection
//----------------------------------
if (!config.server.options.nodb) {
    const connection = mysql.createConnection(config.server.db)

    if (!connection.nodb) {
        connection.connect()
        console.log(`=== Database connected ===`)
    }
}

//----------------------------------
// Load data
//----------------------------------
// loader(data)

//----------------------------------
// User constructor
//----------------------------------
const msgType = {
    system: "system",
    error:  "error",
    chat:   "chat",
}

const User = function(socket, id) {
    this.id        = id
    this.player    = {}
    this.socket    = socket
    this.log       = []

    console.log("+ connection (web)")

    this.output = function(msg, type) {
        socket.send(JSON.stringify({
            type: type,
            time: new Date().valueOf(),
            msg:  msg,
        }))
    }

    this.system = function(msg, ...args) {
        this.output(msg, msgType.system)
    }

    this.error = function(msg, ...args) {
        this.output(msg, msgType.error)
    }

    this.chat = function(msg, ...args) {
        this.output(msg, msgType.chat)
    }
}

//----------------------------------
// User inbound
//----------------------------------
function onReceived(u, input, log, reg) {
    // TODO: Check player state
    // TODO: Check player HP

    try {
        const result = JSON.parse(input)

        // TODO: Process movement

        if (result.command) {
            const command = cmd[result.command.name]
            const args    = result.command.args

            if (!config.server.options.dev && command.gmlv && u.player.gmlv < command.gmlv) {
                console.log(`[Player] ${u.player.name} does not have sufficient GM Level to use '${result.command.name}'.`)
            }
            else {
                command.exec(u, data, result.command.args)
            }
        }
    }
    catch(exception) {
        console.log(`[Player] Client sent invalid response.`)
        console.log(exception)
    }
}

function onConnection(wss) {
    wss.on("connection", (ws) => {
        let log = {}
        let reg = {}

        data.counter++
        const u = new User(ws, data.counter, true)
        data.users[u.id] = u

        // TODO: Trigger first action
        // account.showMainMenu(u.socket)
        u.system("connection")

        ws.on("data", function(received) {
            onReceived(u, input, log, reg)
        })

        ws.on("end", function() {
            console.log("- connection: ")
            // TODO: Remove player from area
            delete data.users[u.id]
        })
    })
}

//----------------------------------
// WebSocket Server
//----------------------------------
if (config.server.options.dev) {
    const wss = new wsocket.Server({ port: config.server.ports.socket })
    onConnection(wss)
}
else {
    const serverHttps = https.createServer({
        cert: fs.readFileSync(`./config/${config.server.certificates.cert}`),
        key:  fs.readFileSync(`./config/${config.server.certificates.key}`),
    }).listen(config.server.ports.socket);

    const wss = new wsocket.Server({ server: serverHttps })
    onConnection(wss)
}

console.log(`=== WebSocket Server :${config.server.ports.socket} ===`)

//----------------------------------
// Battle Server
//----------------------------------
data.battle = {}

//----------------------------------
// Web Server
//----------------------------------
if (config.server.options.web) {
    const app  = express()
    const port = config.server.ports.web

    app.set("view engine", "ejs")
    app.set('views', __dirname + '/www/views');

    var jsonParser = express.json()

    app.get("/", (req, res) => {
      res.render("index")
    })

    app.use("/static", express.static("www/static"))

    app.listen(port, () => {
      console.log(`=== Web Server :${config.server.ports.web} ===`)
    })
}
