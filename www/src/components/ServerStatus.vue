<template>
    <a href="#" class="flex items-center px-4 py-2 text-gray-100 hover:bg-gray-700 group">
        <span class="h-6 w-6 rounded-full inline-block mr-2" :class="props.status ? 'bg-green-700' : 'bg-red-700'"></span>
        {{ props.status ? 'Connected' : 'Disconnected' }}
    </a>
</template>
<script setup lang="ts">
const props = defineProps({
    status: { type: Boolean, required: true },
})
</script>
