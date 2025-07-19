<template>
    <input type="checkbox" id="menu-toggle" class="hidden peer">

    <div class="hidden peer-checked:flex md:flex flex-col w-64 bg-gray-800 transition-all duration-300 ease-in-out">
        <div class="flex items-center justify-between h-16 bg-gray-900 px-4">
            <span class="text-white font-bold">Wyrt ~ 0.0.1</span>
            <label for="menu-toggle" class="text-white cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 lg:hidden" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M6 18L18 6M6 6l12 12" />
                </svg>
            </label>
        </div>
        <div class="flex flex-col flex-1 overflow-y-auto">
            <nav class="flex-1 px-2 py-4 bg-gray-800">
                <ServerStatus :status="props.status" />
                <a href="#" class="flex items-center px-4 py-2 text-gray-100 hover:bg-gray-700 group">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    Settings
                </a>
            </nav>
        </div>
    </div>
</template>
<script setup lang="ts">
import ServerStatus from './ServerStatus.vue'

const props = defineProps({
    status: { type: Boolean, required: true },
})
</script>
