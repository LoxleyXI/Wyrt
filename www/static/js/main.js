import { config } from "./config.js"

const ws    = new WebSocket(config.ws)
const msg   = document.getElementById("msg")
const log   = document.getElementById("log")
const cmd   = []
var   depth = 0

msg.onkeyup = function(event) {
    // Enter
    if (event.keyCode === 13 && msg.value !== "") {
        const val = msg.value
        msg.value = ""
        ws.send(val + "\n")
        cmd.unshift(val)
        depth = 0
    }

    const filtered = cmd.filter((str) => {
        if (isNaN(parseInt(str))) {
            return str
        }
    })

    // Up
    if (event.keyCode === 38) {
        msg.value = filtered[depth] || ""

        if (depth < filtered.length - 1) {
            depth++
        }
    }

    // Down
    if (event.keyCode === 40) {
        msg.value = filtered[depth - 1] || ""

        if (depth > 0) {
            depth--
        }
    }
}

ws.onmessage = function(event) {
    const li = document.createElement("li")
    var data = event.data

    li.innerHTML = data.replace(/\n/g, "<br />")

    log.appendChild(li)
    log.scrollTo(0, log.scrollHeight)
}
