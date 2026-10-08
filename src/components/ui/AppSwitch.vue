<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    label?: string
    description?: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'change', value: boolean): void
}>()

function toggle() {
  emit('update:modelValue', !props.modelValue)
  emit('change', !props.modelValue)
}
</script>

<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>

<template>
  <div class="flex items-center justify-between gap-3 select-none">
    <div v-if="label || description" class="flex flex-col cursor-pointer" @click="!disabled && toggle()">
      <span v-if="label" class="text-sm font-medium text-slate-200">
        {{ label }}
      </span>
      <p v-if="description" class="text-xs text-slate-400">
        {{ description }}
      </p>
    </div>

    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      :class="[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500/40 disabled:opacity-50 disabled:cursor-not-allowed',
        modelValue ? 'bg-green-600' : 'bg-dark-700 hover:bg-dark-600',
      ]"
      @click="toggle"
    >
      <span
        :class="[
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out',
          modelValue ? 'translate-x-5' : 'translate-x-0',
        ]"
      />
    </button>
  </div>
</template>
