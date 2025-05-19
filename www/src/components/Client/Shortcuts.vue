<template>
    <div class="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-[#5271ff]/20 scrollbar-track-transparent">
        <button
            class="px-2 py-1 bg-neutral-800/50 rounded text-xs text-neutral-400 hover:bg-[#5271ff]/20 whitespace-nowrap transition-colors cursor-pointer"
            v-for="shortcut in props.shortcuts"
            :title="shortcut.title"
        >
            {{ shortcut.name }}
        </button>
    </div>
</template>
<script setup lang="ts">
import type { PropType } from 'vue'
import { Shortcut } from '../../types/Shortcut';

const props = defineProps({
    shortcuts: Array as PropType<Shortcut[]>,
})
</script>
