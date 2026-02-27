<template>
  <div class="flex gap-1 flex-wrap">
    <button
      v-for="range in ranges"
      :key="range"
      class="btn btn-xs"
      :class="modelValue === range ? 'btn-primary' : 'btn-ghost'"
      @click="$emit('update:modelValue', range)"
    >{{ range }}</button>
  </div>
</template>

<script setup>
defineProps({ modelValue: String })
defineEmits(['update:modelValue'])
const ranges = ['1W', '3W', '1M', '3M', '1Y', '5Y', 'All']
</script>
