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
import { Data } from "../types/Data"
import { Menu } from "../types/Menu"
import { User } from "../types/User"
import { GameState } from "../types/GameState"
import { MessageType } from "../types/MessageType"

export abstract class Util {
    public static randRange(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    public static formatName(name: string) {
        var words  = name.split(" ")
        var result = []

        for (var i = 0; i < words.length; i++) {
            result.push(words[i][0].toUpperCase() + words[i].substring(1).toLowerCase())
        }

        return result.join("_")
    }

    public static capitalise(str: string) {
        return str[0].toUpperCase() + str.substring(1).toLowerCase()
    }

    public static pickItem(data: Data, tbl: any) {
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

    public static sendMenu(u: User, data: Data, tbl: Menu) {
        u.state = GameState.Menu;
        u.menu  = tbl

        var options = []

        for (var i = 0; i < tbl.options.length; i++) {
            options.push(`${tbl.options[i][0]}`)
        }

        var result = { menu: new Menu() }

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

        u.output(JSON.stringify(result), MessageType.System)
    }

    public static hours(num: number) {
        return 3600000 * num
    }

    public static minutes(num: number) {
        return 60000 * num
    }
}
