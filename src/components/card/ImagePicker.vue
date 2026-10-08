<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { processAndCompressImage } from '@/services/imageStorage'
import { showSuccessToast, showErrorToast, showConfirm } from '@/utils/alerts'

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | undefined): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)
const showUrlInput = ref(false)
const manualUrl = ref('')

async function onFileSelected(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isProcessing.value = true
  try {
    const compressed = await processAndCompressImage(file)
    emit('update:modelValue', compressed)
    showSuccessToast('Imagen cargada', 'Optimizada en formato WebP ligero')
  } catch (err: any) {
    showErrorToast('Error con la imagen', err.message || 'No se pudo procesar')
  } finally {
    isProcessing.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

async function pasteFromClipboard() {
  try {
    const clipboardItems = await navigator.clipboard.read()
    let found = false
    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type)
          isProcessing.value = true
          const compressed = await processAndCompressImage(blob)
          emit('update:modelValue', compressed)
          isProcessing.value = false
          showSuccessToast('Imagen pegada', 'Optimizada desde el portapapeles')
          found = true
          return
        }
      }
    }
    if (!found) {
      showErrorToast('Sin imagen', 'No hay imágenes copiadas en el portapapeles')
    }
  } catch (err) {
    showErrorToast('Permiso denegado', 'No se pudo leer el portapapeles del dispositivo')
  }
}

function applyManualUrl() {
  if (manualUrl.value.trim()) {
    emit('update:modelValue', manualUrl.value.trim())
    manualUrl.value = ''
    showUrlInput.value = false
    showSuccessToast('URL aplicada', 'Imagen enlazada correctamente')
  }
}

async function removeImage() {
  const res = await showConfirm(
    '¿Quitar imagen?',
    'Se eliminará la imagen asociada a este par.',
    'Sí, quitar',
  )
  if (res.isConfirmed) {
    emit('update:modelValue', undefined)
    showSuccessToast('Imagen eliminada')
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
      Imagen Mnemotécnica
    </label>

    <!-- Preview si existe imagen -->
    <div
      v-if="modelValue"
      class="relative w-full h-44 rounded-2xl overflow-hidden border border-dark-700 bg-dark-950 flex items-center justify-center group"
    >
      <img
        :src="modelValue"
        alt="Mnemotecnia"
        class="w-full h-full object-contain object-center"
      />
      <div
        class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
      >
        <button
          type="button"
          class="p-2.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl shadow-lg transition-transform active:scale-95"
          @click="removeImage"
        >
          <AppIcon name="lucide:trash-2" :size="18" />
        </button>
      </div>
    </div>

    <!-- Botones de subida si no hay imagen -->
    <div v-else class="flex flex-col gap-2">
      <div
        class="border-2 border-dashed border-dark-700 hover:border-green-500/50 bg-dark-900/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
        @click="fileInputRef?.click()"
      >
        <AppIcon
          v-if="!isProcessing"
          name="lucide:image-plus"
          :size="32"
          class-name="text-slate-500 mb-2"
        />
        <AppIcon
          v-else
          name="lucide:loader-2"
          :size="32"
          class-name="text-green-400 animate-spin mb-2"
        />

        <p class="text-xs font-medium text-slate-300">
          {{ isProcessing ? 'Comprimiendo imagen...' : 'Toca para subir o tomar foto' }}
        </p>
        <p class="text-[10px] text-slate-500 mt-0.5">
          JPG, PNG o WebP (se optimiza automáticamente)
        </p>
      </div>

      <div class="flex items-center gap-2">
        <AppButton
          size="sm"
          variant="secondary"
          icon="lucide:clipboard-paste"
          class="flex-1 text-xs"
          @click="pasteFromClipboard"
        >
          Pegar
        </AppButton>
        <AppButton
          size="sm"
          variant="secondary"
          icon="lucide:link"
          class="flex-1 text-xs"
          @click="showUrlInput = !showUrlInput"
        >
          URL
        </AppButton>
      </div>

      <div v-if="showUrlInput" class="flex gap-2 mt-1">
        <input
          v-model="manualUrl"
          type="url"
          placeholder="https://ejemplo.com/foto.jpg"
          class="flex-1 bg-dark-900 border border-dark-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-green-500"
          @keydown.enter.prevent="applyManualUrl"
        />
        <AppButton size="sm" variant="primary" @click="applyManualUrl">
          OK
        </AppButton>
      </div>
    </div>

    <!-- Input file oculto con soporte de cámara en móvil -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileSelected"
    />
  </div>
</template>
