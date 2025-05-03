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

const util = require("../server/util")

//----------------------------------
// test
// A test command
//----------------------------------
exports.test = {
    alias: ["t"],
    exec: function(u, data, args) {
        if (args[0]) {
            u.system(`Test command executed with param ${args[0]}`)
        }
        else {
            u.system("Test command executed")
        }
    },
}

//----------------------------------
// item
// Display info about an item
//----------------------------------
exports.item = {
    exec: function(u, data, args) {
        if (!args[0]) {
            u.system(`item: No item name specified`)
        }
        else {
            if (!data.items[args[0]]) {
                u.system(`item: (${args[0]}): No such item exists`)
            }
            else {
                // TODO: Give a different response type for JSON lookups that aren't printed
                u.system(`item (${args[0]}): ${JSON.stringify(data.items[args[0]])}`)
            }
        }
    },
}
