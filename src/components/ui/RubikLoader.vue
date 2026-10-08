<script setup lang="ts">
import RubikLoader from '../RubikLoader.vue'

defineProps<{
  label?: string
  size?: number
  variant?: '3d' | 'logo'
  blindfold?: boolean
}>()
</script>

<template>
  <RubikLoader
    :label="label"
    :size="size"
    :variant="variant"
    :blindfold="blindfold"
  />
</template>
