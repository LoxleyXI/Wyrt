<template>
  <div class="flex h-screen bg-gray-100">
        <Sidebar :status="status" />
        <div class="flex flex-col flex-1 overflow-y-auto">
            <Heading  />
            <div class="p-4">
                <img src="./assets/Wyrt.png" />
                <div class="sticky bottom-0 left-0 right-0 mt-4 sm:mt-6">
                    <div class="max-w-5xl">
                        <div class="bg-black/5 border-2 border-solid border-black/10 font-mono font-medium text-sm rounded-lg p-3 sm:p-4">
                            <Client @onConnect="connection(true)" @onDisconnect="connection(false)" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'

import Heading from './components/Heading.vue'
import Sidebar from './components/Sidebar.vue'
import Client from './components/Client/Client.vue'

const status = ref()

function connection(value: boolean) {
    status.value = value
}
</script>
