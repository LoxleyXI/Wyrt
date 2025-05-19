<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { Shortcut } from './types/Shortcut.ts'

import Header from './components/Header.vue'
import Sidebar from './components/Sidebar.vue'

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
    }

    ws.onmessage = (event) => {
        msg.value.push(event.data)
    }

    ws.onclose = () => {
        status.value = false
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

<template>
  <div class="flex h-screen bg-gray-100">
        <Sidebar :status="status" />
        <div class="flex flex-col flex-1 overflow-y-auto">
            <Header />
            <div class="p-4">
                <img src="./assets/Wyrt.png" />
                <div class="sticky bottom-0 left-0 right-0 mt-4 sm:mt-6">
                    <div class="max-w-5xl">
                        <div class="bg-black/5 border-2 border-solid border-black/10 font-mono font-medium text-sm rounded-lg p-3 sm:p-4">
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
                            <div class="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-[#5271ff]/20 scrollbar-track-transparent">
                                <button
                                    class="px-2 py-1 bg-neutral-800/50 rounded text-xs text-neutral-400 hover:bg-[#5271ff]/20 whitespace-nowrap transition-colors"
                                    v-for="shortcut in shortcuts"
                                    :title="shortcut.title"
                                >
                                    {{ shortcut.name }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
</style>
