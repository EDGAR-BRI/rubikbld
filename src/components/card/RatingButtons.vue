<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { ReviewRating } from '@/models/card'

const props = defineProps<{
  intervals: {
    1: string
    2: string
    3: string
    4: string
  }
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'rate', rating: ReviewRating): void
}>()

function onRate(rating: ReviewRating) {
  if (props.disabled) return
  if (navigator?.vibrate) {
    navigator.vibrate(15)
  }
  emit('rate', rating)
}

function onKeyDown(e: KeyboardEvent) {
  if (props.disabled) return
  if (e.key === '1') onRate(1)
  else if (e.key === '2') onRate(2)
  else if (e.key === '3') onRate(3)
  else if (e.key === '4') onRate(4)
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="grid grid-cols-4 gap-2 w-full max-w-lg mx-auto safe-bottom select-none">
    <!-- 1: Again -->
    <button
      type="button"
      :disabled="disabled"
      class="group relative flex flex-col items-center justify-center py-3 px-1.5 rounded-2xl bg-rose-950/40 hover:bg-rose-900/50 active:bg-rose-900 border border-rose-800/40 text-rose-300 transition-all active:scale-95 disabled:opacity-40"
      @click="onRate(1)"
    >
      <span class="text-[11px] font-bold tracking-tight uppercase">Otra vez</span>
      <span class="text-xs text-rose-400/90 font-mono font-semibold mt-0.5">
        {{ intervals[1] }}
      </span>
      <span class="text-[10px] text-rose-500/70 mt-0.5 font-mono flex items-center gap-0.5 sm:hidden">←</span>
      <span class="hidden sm:inline-block text-[10px] text-rose-500/60 mt-1 font-mono">[1]</span>
    </button>

    <!-- 2: Hard -->
    <button
      type="button"
      :disabled="disabled"
      class="group relative flex flex-col items-center justify-center py-3 px-1.5 rounded-2xl bg-amber-950/40 hover:bg-amber-900/50 active:bg-amber-900 border border-amber-800/40 text-amber-300 transition-all active:scale-95 disabled:opacity-40"
      @click="onRate(2)"
    >
      <span class="text-[11px] font-bold tracking-tight uppercase">Difícil</span>
      <span class="text-xs text-amber-400/90 font-mono font-semibold mt-0.5">
        {{ intervals[2] }}
      </span>
      <span class="text-[10px] text-amber-500/70 mt-0.5 font-mono flex items-center gap-0.5 sm:hidden">↓</span>
      <span class="hidden sm:inline-block text-[10px] text-amber-500/60 mt-1 font-mono">[2]</span>
    </button>

    <!-- 3: Good -->
    <button
      type="button"
      :disabled="disabled"
      class="group relative flex flex-col items-center justify-center py-3 px-1.5 rounded-2xl bg-emerald-950/40 hover:bg-emerald-900/50 active:bg-emerald-900 border border-emerald-800/40 text-emerald-300 transition-all active:scale-95 disabled:opacity-40"
      @click="onRate(3)"
    >
      <span class="text-[11px] font-bold tracking-tight uppercase">Bien</span>
      <span class="text-xs text-emerald-400/90 font-mono font-semibold mt-0.5">
        {{ intervals[3] }}
      </span>
      <span class="text-[10px] text-emerald-500/70 mt-0.5 font-mono flex items-center gap-0.5 sm:hidden">→</span>
      <span class="hidden sm:inline-block text-[10px] text-emerald-500/60 mt-1 font-mono">[3]</span>
    </button>

    <!-- 4: Easy -->
    <button
      type="button"
      :disabled="disabled"
      class="group relative flex flex-col items-center justify-center py-3 px-1.5 rounded-2xl bg-sky-950/40 hover:bg-sky-900/50 active:bg-sky-900 border border-sky-800/40 text-sky-300 transition-all active:scale-95 disabled:opacity-40"
      @click="onRate(4)"
    >
      <span class="text-[11px] font-bold tracking-tight uppercase">Fácil</span>
      <span class="text-xs text-sky-400/90 font-mono font-semibold mt-0.5">
        {{ intervals[4] }}
      </span>
      <span class="text-[10px] text-sky-500/70 mt-0.5 font-mono flex items-center gap-0.5 sm:hidden">↑</span>
      <span class="hidden sm:inline-block text-[10px] text-sky-500/60 mt-1 font-mono">[4]</span>
    </button>
  </div>
</template>
