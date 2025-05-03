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

function randRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function formatName(name) {
    var words  = name.split(" ")
    var result = []

    for (var i = 0; i < words.length; i++) {
        result.push(words[i][0].toUpperCase() + words[i].substring(1).toLowerCase())
    }

    return result.join("_")
}

function capitalise(str) {
    return str[0].toUpperCase() + str.substring(1).toLowerCase()
}

function pickItem(data, tbl) {
    var total = 0

    for (var i in tbl) {
        total += tbl[i][0]
    }

    var pick = Math.floor(Math.random() * total)
    var sum  = 0

    for (var i in tbl) {
        const row = tbl[i]
        sum += row[0]

        if (sum >= pick) {
            var itemName = row[1]

            if (!data.items[itemName]) {
                console.log(`pickItem: '${itemName}' picked but not found.`)
                return false
            }
            else {
                return itemName
            }
        }
    }
}

function sendMenu(u, data, tbl) {
    u.state = data.states.menu
    u.menu  = tbl

    var options = []

    for (var i = 0; i < tbl.options.length; i++) {
        options.push(`${tbl.options[i][0]}`)
    }

    var result = { "menu": {} }

    if (tbl.title) {
        result.menu.title = tbl.title
    }

    if (tbl.desc) {
        result.menu.desc = tbl.desc
    }

    if (tbl.logo) {
        result.menu.logo = tbl.logo
    }

    if (options.length) {
        result.menu.options = options
    }

    u.write(JSON.stringify(result))
}

function hours(num) {
    return 3600000 * num
}

function minutes(num) {
    return 60000 * num
}

exports.randRange     = randRange
exports.formatName    = formatName
exports.capitalise    = capitalise
exports.pickItem      = pickItem
exports.sendMenu      = sendMenu
exports.hours         = hours
exports.minutes       = minutes
