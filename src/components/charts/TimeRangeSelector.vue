<template>
  <div class="flex gap-1 flex-wrap">
    <button
      v-for="range in ranges"
      :key="range.value"
      class="btn btn-xs"
      :class="modelValue === range.value ? 'btn-primary' : 'btn-ghost'"
      @click="$emit('update:modelValue', range.value)"
    >{{ range.label }}</button>
  </div>
</template>

<script setup>
defineProps({ modelValue: String })
defineEmits(['update:modelValue'])
const ranges = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '3W', label: '3W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '1Y', label: '1Y' },
  { value: '5Y', label: '5Y' },
  { value: 'All', label: 'Inception' },
]
</script>
