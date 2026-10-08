<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { PairItem } from '@/models/pair'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import ImagePicker from '@/components/card/ImagePicker.vue'
import { usePairsStore } from '@/stores/usePairsStore'
import { showSuccessToast } from '@/utils/alerts'

const props = defineProps<{
  modelValue: boolean
  pairItem: PairItem | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
  (e: 'saved', pair: PairItem): void
}>()

const pairsStore = usePairsStore()

const word = ref('')
const image = ref<string | undefined>(undefined)
const notes = ref('')
const isSaving = ref(false)

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => {
    emit('update:modelValue', val)
    if (!val) {
      emit('close')
    }
  },
})

function closeModal() {
  isOpen.value = false
}

watch(
  () => props.pairItem,
  (item) => {
    if (item) {
      word.value = item.word || ''
      image.value = item.image
      notes.value = item.notes || ''
    }
  },
  { immediate: true },
)

async function onSave() {
  if (!props.pairItem) return
  const pairName = props.pairItem.pair
  const wordVal = word.value.trim()

  isSaving.value = true
  try {
    await pairsStore.updatePair(props.pairItem.id, {
      word: word.value,
      image: image.value,
      notes: notes.value,
    })

    const updated = pairsStore.getPairById(props.pairItem.id)
    if (updated) emit('saved', updated)
    closeModal()

    showSuccessToast(
      `Par ${pairName} guardado`,
      wordVal ? `Palabra: "${wordVal}"` : 'Mnemotecnia actualizada',
    )
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <AppModal
    v-model="isOpen"
    :title="pairItem ? `Detalle del Par: ${pairItem.pair}` : 'Detalle del Par'"
    subtitle="Asigna tu palabra e imagen mnemotécnica propia"
    @close="closeModal"
  >
    <div v-if="pairItem" class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <AppBadge
          :variant="pairItem.usage === 'both' ? 'accent' : pairItem.usage === 'corner' ? 'warning' : 'success'"
        >
          {{ pairItem.usage === 'both' ? 'Ambas (Esquinas y Aristas)' : pairItem.usage === 'corner' ? 'Solo Esquinas' : 'Solo Aristas' }}
        </AppBadge>
        <span class="text-xs text-slate-400 font-mono">
          Letras: {{ pairItem.firstLetter }} + {{ pairItem.secondLetter }}
        </span>
      </div>

      <!-- Palabra mnemotécnica -->
      <AppInput
        v-model="word"
        label="Palabra Mnemotécnica"
        placeholder="Ej: Pijama, Pikachu, Batman..."
        icon="lucide:type"
        clearable
        autofocus
        @enter="onSave"
      />

      <!-- Imagen -->
      <ImagePicker v-model="image" />

      <!-- Notas / Descripción opcional -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Historia / Notas (Opcional)
        </label>
        <textarea
          v-model="notes"
          rows="2"
          placeholder="Ej: Imagina ponerte el pijama al revés..."
          class="w-full bg-dark-900 border border-dark-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none"
        />
      </div>
    </div>

    <template #footer>
      <AppButton
        variant="ghost"
        size="md"
        @click="closeModal"
      >
        Cancelar
      </AppButton>
      <AppButton
        variant="primary"
        size="md"
        icon="lucide:check"
        :loading="isSaving"
        @click="onSave"
      >
        Guardar
      </AppButton>
    </template>
  </AppModal>
</template>
