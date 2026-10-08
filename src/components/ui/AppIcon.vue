<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  name: string
  size?: number | string
  className?: string
}>()
</script>

<template>
  <Icon
    :icon="name"
    :width="size || 20"
    :height="size || 20"
    :class="['inline-block shrink-0', className]"
  />
</template>
