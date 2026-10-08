<script setup lang="ts">
import AppIcon from './AppIcon.vue'

defineProps<{
  title: string
  subtitle?: string
  showBack?: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()
</script>

<template>
  <header
    class="w-full bg-dark-900/95 backdrop-blur-md border-b border-dark-800/80 px-4 min-h-[52px] flex items-center justify-between z-30 shrink-0"
    style="padding-top: max(0.75rem, calc(0.75rem + env(safe-area-inset-top, 0px))); padding-bottom: 0.75rem;"
  >
    <div class="flex items-center gap-3 min-w-0">
      <button
        v-if="showBack"
        type="button"
        class="p-2 -ml-2 text-slate-300 hover:text-white rounded-lg hover:bg-dark-800 transition-colors"
        @click="emit('back')"
      >
        <AppIcon name="lucide:arrow-left" :size="20" />
      </button>

      <img
        v-if="!showBack"
        src="/favicon.png"
        alt="Logo"
        class="w-7 h-7 rounded-lg object-contain shrink-0 drop-shadow-sm"
      />

      <div class="truncate">
        <h1 class="text-base font-bold text-white tracking-tight flex items-center gap-2 truncate">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="text-xs text-slate-400 truncate">
          {{ subtitle }}
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <slot name="actions" />
    </div>
  </header>
</template>
