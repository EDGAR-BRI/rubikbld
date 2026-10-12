<script setup lang="ts">
import { computed } from 'vue'
import offlineIconsData from '@/plugins/offlineIcons.json'
import { Icon } from '@iconify/vue'

const props = defineProps<{
  name: string
  size?: number | string
  className?: string
}>()

const iconKey = computed(() => {
  return (props.name || '').replace(/^lucide:/, '').trim()
})

const localIconBody = computed(() => {
  const iconSet = (offlineIconsData as any)?.icons
  const found = iconSet ? iconSet[iconKey.value] : null
  return found?.body || null
})
</script>

<template>
  <!-- Renderizado nativo instantáneo SVG (100% offline, síncrono, sin flicker ni llamadas a red) -->
  <svg
    v-if="localIconBody"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    :width="size || 20"
    :height="size || 20"
    :class="['inline-block shrink-0', className]"
    v-html="localIconBody"
  />
  <!-- Fallback a @iconify/vue para iconos que no estén en la colección local -->
  <Icon
    v-else
    :icon="name"
    :width="size || 20"
    :height="size || 20"
    :class="['inline-block shrink-0', className]"
  />
</template>
