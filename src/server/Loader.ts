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
import fs from "fs"
import yaml, { YAMLException } from "js-yaml"
import { Data } from "../types/Data"
import server from "../../config/server.json";

const config: any = { server: server }

export abstract class Loader {
    private static basicLoader(obj: Data, path: string, dataType: string) {
        try {
            const result = yaml.load(fs.readFileSync(path, "utf8")) as any;

            if (!obj[dataType]) {
                obj[dataType] = {}
            }

            for (var name in result) {
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

    private static loaders = {
        items: function(obj: Data, path: string) {
            return Loader.basicLoader(obj, path, "items")
        },
    }

    private static logLoad(dataType: string) {
        console.log(`= data.${dataType} =`)
    }

    private static loadDir(obj: Data, dataType: string, path: string) {
        Loader.logLoad(dataType)

        const result = fs.readdirSync(path, { recursive: true })
        var str = []

        for (const filename of result) {
            if (Loader.loaders[dataType]) {
                if (Loader.loaders[dataType](obj, `${path}/${filename}`)) {
                    str.push(filename.toString().replace(".yaml", ""))
                }
            }
            else {
                console.log(`[Loader] No loader defined for data type ${dataType}!`)
            }
        }

        console.log(str.join(", "))
    }

    public static init(obj: Data) {
        console.log(`=== Loading data ===`)

        var base = "./data/"

        if (config.server.options.example) {
            base = "./data/example/"
        }

        const result = fs.readdirSync(base, { recursive: false })
        var str = []

        for (const dir of result) {
            Loader.loadDir(obj, dir.toString(), `${base}${dir}`)
        }

        console.log(`=== Watching data ===`)

        fs.watch(base, { recursive: true }, function (event, filename) {
            if (event == "change") {
                const path = filename.split(/[/|\\]/g)

                console.log(`=== Reloading: ${path[1]} ===`)

                if (Loader.loaders[path[0]]) {
                    Loader.loaders[path[0]](obj, `${base}/${filename}`)
                }
            }
        })
    }
}
