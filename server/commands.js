/* const util = require("../server/util") */

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
