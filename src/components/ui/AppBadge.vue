<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'accent' | 'cube-u' | 'cube-l' | 'cube-f' | 'cube-r' | 'cube-b' | 'cube-d'
    size?: 'sm' | 'md'
  }>(),
  {
    variant: 'neutral',
    size: 'sm',
  },
)

const variantClasses: Record<string, string> = {
  primary: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
  accent: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  danger: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  neutral: 'bg-dark-800 text-slate-300 border border-dark-700',
  'cube-u': 'bg-slate-200 text-slate-900 border border-slate-300 font-semibold',
  'cube-l': 'bg-orange-500/20 text-orange-400 border border-orange-500/40',
  'cube-f': 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
  'cube-r': 'bg-rose-500/20 text-rose-400 border border-rose-500/40',
  'cube-b': 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
  'cube-d': 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
}
</script>

<template>
  <span
    :class="[
      'inline-flex items-center justify-center font-medium rounded-full',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
      variantClasses[variant] || variantClasses.neutral,
    ]"
  >
    <slot />
  </span>
</template>
