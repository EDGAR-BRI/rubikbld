<script setup lang="ts">
import AppIcon from './AppIcon.vue'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost' | 'outline'
    size?: 'sm' | 'md' | 'lg' | 'icon'
    icon?: string
    iconPosition?: 'left' | 'right'
    disabled?: boolean
    loading?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    iconPosition: 'left',
    disabled: false,
    loading: false,
    type: 'button',
  },
)

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const baseClasses =
  'inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-95 select-none focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 disabled:pointer-events-none'

const variantClasses: Record<string, string> = {
  primary:
    'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/25 active:bg-green-700',
  secondary:
    'bg-dark-800 hover:bg-dark-700 text-slate-200 border border-dark-700 active:bg-dark-900',
  success:
    'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:bg-emerald-700',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 active:bg-rose-700',
  warning:
    'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 active:bg-amber-700',
  ghost:
    'bg-transparent hover:bg-dark-800/60 text-slate-300 hover:text-white',
  outline:
    'bg-transparent border border-dark-600 hover:border-slate-400 text-slate-300 hover:text-white',
}

const sizeClasses: Record<string, string> = {
  sm: 'text-xs px-2.5 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
  lg: 'text-base px-6 py-3 rounded-2xl gap-2.5',
  icon: 'p-2.5 rounded-xl',
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[baseClasses, variantClasses[variant], sizeClasses[size]]"
    @click="emit('click', $event)"
  >
    <AppIcon
      v-if="loading"
      name="lucide:loader-2"
      :size="size === 'sm' ? 14 : 18"
      class-name="animate-spin"
    />
    <AppIcon
      v-else-if="icon && iconPosition === 'left'"
      :name="icon"
      :size="size === 'sm' ? 14 : 18"
    />

    <slot />

    <AppIcon
      v-if="!loading && icon && iconPosition === 'right'"
      :name="icon"
      :size="size === 'sm' ? 14 : 18"
    />
  </button>
</template>
