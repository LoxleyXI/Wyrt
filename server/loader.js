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

const fs     = require("fs")
const yaml   = require("js-yaml")
const config = require("../config/server.js")

function basicLoader(obj, path, dataType) {
    try {
        const result = yaml.load(fs.readFileSync(path, "utf8"))

        if (!obj[dataType]) {
            obj[dataType] = {}
        }

        for (name in result) {
            obj[dataType][name] = result[name]
        }

        return true
    }
    catch(err) {
        console.log("Data failed to parse:")
        console.log(err)

        return false
    }
}

const loaders = {
    items: function(obj, path) {
        return basicLoader(obj, path, "items")
    },
}

function logLoad(dataType) {
    console.log(`= data.${dataType} =`)
}

function loadDir(obj, dataType, path) {
    logLoad(dataType)

    const result = fs.readdirSync(path, { recursive: true })
    var str = []

    for (const filename of result) {
        if (loaders[dataType]) {
            if (loaders[dataType](obj, `${path}/${filename}`)) {
                str.push(filename.replace(".yaml", ""))
            }
        }
        else {
            console.log(`[Loader] No loader defined for data type ${dataType}!`)
        }
    }

    console.log(str.join(", "))
}

function init(obj) {
    console.log(`=== Loading data ===`)

    var base = "./data/"

    if (config.server.options.example) {
        base = "./data/example/"
    }

    const result = fs.readdirSync(base, { recursive: false })
    var str = []

    for (const dir of result) {
        loadDir(obj, dir, `${base}${dir}`)
    }

    console.log(`=== Watching data ===`)

    fs.watch(base, { recursive: true }, function (event, filename) {
        if (event == "change") {
            const path = filename.split(/[/|\\]/g)

            console.log(`=== Reloading: ${path[1]} ===`)

            if (loaders[path[0]]) {
                loaders[path[0]](obj, `${base}/${filename}`)
            }
        }
    })
}

module.exports = init
