<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    label?: string
    placeholder?: string
    icon?: string
    type?: string
    error?: string
    disabled?: boolean
    clearable?: boolean
    autofocus?: boolean
  }>(),
  {
    placeholder: '',
    type: 'text',
    disabled: false,
    clearable: false,
    autofocus: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'clear'): void
  (e: 'enter', event: KeyboardEvent): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)

function focus() {
  inputRef.value?.focus()
}

function select() {
  inputRef.value?.select()
}

function triggerFocus() {
  if (props.autofocus && !props.disabled) {
    nextTick(() => {
      focus()
      select()
    })
    setTimeout(() => {
      focus()
      select()
    }, 60)
  }
}

onMounted(() => {
  triggerFocus()
})

watch(
  () => props.autofocus,
  (val) => {
    if (val) triggerFocus()
  },
)

defineExpose({
  focus,
  select,
  input: inputRef,
})

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    const target = event.target as HTMLInputElement
    emit('update:modelValue', target.value)
    emit('enter', event)
  }
}

function clear() {
  emit('update:modelValue', '')
  emit('clear')
}
</script>

<template>
  <div class="flex flex-col gap-1.5 w-full">
    <label v-if="label" class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
      {{ label }}
    </label>
    <div
      class="relative flex items-center bg-dark-900 border border-dark-700 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-xl transition-all"
    >
      <div v-if="icon" class="pl-3.5 text-slate-500 pointer-events-none flex items-center">
        <AppIcon :name="icon" :size="18" />
      </div>

      <input
        ref="inputRef"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :autofocus="autofocus"
        class="w-full bg-transparent px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50"
        @input="onInput"
        @keydown="onKeyDown"
      />

      <button
        v-if="clearable && modelValue"
        type="button"
        class="pr-3 text-slate-500 hover:text-slate-300 p-1 transition-colors"
        @click="clear"
      >
        <AppIcon name="lucide:x" :size="16" />
      </button>
    </div>

    <span v-if="error" class="text-xs text-rose-400 mt-0.5">
      {{ error }}
    </span>
  </div>
</template>
