<template>
    <ul>
        <li v-for="text in msg">{{ text }}</li>
    </ul>
    <div class="flex items-center gap-3">
        <span class="text-[#5271ff] text-lg sm:text-xl animate-pulse">&gt;</span>
        <input type="text" 
            class="flex-1 bg-transparent border-none text-black focus:outline-none text-base sm:text-lg placeholder-neutral-500 focus:placeholder-neutral-600" 
            placeholder="Enter commands..." 
            aria-label="Command input"
            v-model="command"
            v-on:keyup.enter="sendCommand"
        >
    </div>
    <Shortcuts :shortcuts="shortcuts" />
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Shortcut } from '../../types/Shortcut.ts'
import Shortcuts from './Shortcuts.vue'

const emit = defineEmits(['onConnect', 'onDisconnect'])

var status = ref()
var command = ref()
var msg = ref<string[]>([])
var ws: WebSocket

// TODO: Query commands list from server
var shortcuts = ref<Shortcut[]>([])
shortcuts.value.push(new Shortcut("/item", "/item <Item_Name>"))

onMounted(() => {
    ws = new WebSocket("ws://localhost:8080")

    ws.onopen = () => {
        status.value = true
        emit("onConnect")
    }

    ws.onmessage = (event) => {
        msg.value.push(event.data)
    }

    ws.onclose = () => {
        status.value = false
        emit("onDisconnect")
    }

    ws.onerror = (error) => {
        console.error("WebSocket error:", error)
    }
})

function sendCommand(_event: Event) {
    if (!command.value || command.value.length === 0 || !status.value) {
        return
    }

    if (command.value[0] == "/") {
        const args = command.value.slice(1).split(" ")
        ws.send(JSON.stringify({ type: "command", name: args[0], args: args.slice(1) }))
    }
    else {
        ws.send(JSON.stringify({ type: "chat", msg: command.value }))
    }

    command.value = ""
}
</script>