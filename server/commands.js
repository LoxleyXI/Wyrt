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
