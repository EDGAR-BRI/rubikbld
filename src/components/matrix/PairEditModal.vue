<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { PairItem } from '@/models/pair'
import type { SRSCard, ReviewLog } from '@/models/card'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import ImagePicker from '@/components/card/ImagePicker.vue'
import { usePairsStore } from '@/stores/usePairsStore'
import { useReviewStore } from '@/stores/useReviewStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { db } from '@/db'
import { showSuccessToast, showConfirm } from '@/utils/alerts'

const props = defineProps<{
  modelValue: boolean
  pairItem: PairItem | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
  (e: 'saved', pair: PairItem): void
  (e: 'deleted', pairId: string): void
  (e: 'cardUpdated', card: SRSCard): void
}>()

const pairsStore = usePairsStore()
const reviewStore = useReviewStore()
const settingsStore = useSettingsStore()

const isOutsideScheme = computed(() => {
  if (!props.pairItem) return false
  return pairsStore.isPairOutsideScheme(props.pairItem.id)
})

const isArchived = computed(() => {
  return !!props.pairItem?.isArchived || !!srsCard.value?.isArchived
})

// Navegación interna: 'detail' (formulario habitual) o 'srs' (métricas y acciones de repaso)
const currentView = ref<'detail' | 'srs'>('detail')

// Estado de Mnemotecnia
const word = ref('')
const image = ref<string | undefined>(undefined)
const notes = ref('')
const isSaving = ref(false)

// Estado de SRS
const srsCard = ref<SRSCard | null>(null)
const reviewLogs = ref<ReviewLog[]>([])
const loadingSRS = ref(false)

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

const modalTitle = computed(() => {
  if (!props.pairItem) return 'Detalle del Par'
  return currentView.value === 'srs'
    ? `Repaso SRS: ${props.pairItem.pair}`
    : `Detalle del Par: ${props.pairItem.pair}`
})

const modalSubtitle = computed(() => {
  return currentView.value === 'srs'
    ? 'Métricas de memoria, intervalos y opciones de la tarjeta'
    : 'Asigna tu palabra e imagen mnemotécnica propia'
})

async function loadSRSData() {
  if (!props.pairItem) {
    srsCard.value = null
    reviewLogs.value = []
    return
  }

  loadingSRS.value = true
  try {
    let card = await db.cards.get(props.pairItem.id)
    if (!card) {
      const now = Date.now()
      card = {
        id: props.pairItem.id,
        pair: props.pairItem.pair,
        usage: props.pairItem.usage,
        state: 'new',
        due: now,
        interval: 0,
        easeFactor: settingsStore.srsSettings.startingEase || 2.5,
        stepIndex: 0,
        repetitions: 0,
        lapses: 0,
        isArchived: false,
        createdAt: now,
      }
    }
    srsCard.value = card

    const logs = await db.reviews
      .where('cardId')
      .equals(props.pairItem.id)
      .reverse()
      .sortBy('timestamp')
    reviewLogs.value = logs
  } catch (err) {
    console.error('Error cargando información SRS:', err)
  } finally {
    loadingSRS.value = false
  }
}

watch(
  () => props.pairItem,
  (item) => {
    if (item) {
      word.value = item.word || ''
      image.value = item.image
      notes.value = item.notes || ''
      currentView.value = 'detail'
      loadSRSData()
    } else {
      srsCard.value = null
      reviewLogs.value = []
    }
  },
  { immediate: true },
)

// Helpers de formateo
function formatRelativeDue(dueTimestamp: number): { text: string; isDue: boolean } {
  const now = Date.now()
  const diffMs = dueTimestamp - now

  if (diffMs <= 0) {
    const passedMinutes = Math.floor(Math.abs(diffMs) / (60 * 1000))
    if (passedMinutes < 60) {
      return { text: 'Pendiente hoy', isDue: true }
    }
    const passedHours = Math.floor(passedMinutes / 60)
    if (passedHours < 24) {
      return { text: `Vencida (${passedHours}h)`, isDue: true }
    }
    const passedDays = Math.floor(passedHours / 24)
    return { text: `Vencida (${passedDays}d)`, isDue: true }
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000))
  if (diffMinutes < 60) {
    return { text: `En ${diffMinutes}m`, isDue: false }
  }
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return { text: `En ${diffHours}h`, isDue: false }
  }
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) {
    return { text: 'Mañana', isDue: false }
  }
  return { text: `En ${diffDays}d`, isDue: false }
}

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return 'Nunca'
  const now = Date.now()
  const diffMs = now - timestamp
  if (diffMs < 60 * 1000) return 'Hace poco'
  const diffMinutes = Math.floor(diffMs / (60 * 1000))
  if (diffMinutes < 60) return `Hace ${diffMinutes}m`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `Hace ${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Ayer'
  return `Hace ${diffDays}d`
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Computados de SRS
const stateMeta = computed(() => {
  const st = srsCard.value?.state || 'new'
  switch (st) {
    case 'new':
      return {
        label: 'Nueva',
        desc: 'Aún no iniciada',
        colorClass: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
        dotClass: 'bg-sky-400',
        icon: 'lucide:sparkles',
      }
    case 'learning':
      return {
        label: 'En Aprendizaje',
        desc: 'Pasos iniciales',
        colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        dotClass: 'bg-amber-400',
        icon: 'lucide:book-open',
      }
    case 'review':
      return {
        label: 'En Repaso',
        desc: 'Memorizada',
        colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        dotClass: 'bg-emerald-400',
        icon: 'lucide:check-circle-2',
      }
    case 'relearning':
      return {
        label: 'En Reaprendizaje',
        desc: 'Olvidada recientemente',
        colorClass: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
        dotClass: 'bg-rose-400',
        icon: 'lucide:rotate-ccw',
      }
  }
})

const dueInfo = computed(() => {
  if (!srsCard.value) return { text: 'Sin programar', isDue: false, dateStr: '' }
  if (srsCard.value.state === 'new') {
    return { text: 'Disponible', isDue: true, dateStr: 'En cola de nuevas' }
  }
  const rel = formatRelativeDue(srsCard.value.due)
  return {
    ...rel,
    dateStr: formatDateTime(srsCard.value.due),
  }
})

const formattedInterval = computed(() => {
  if (!srsCard.value) return '0 d'
  if (srsCard.value.state === 'learning' || srsCard.value.state === 'relearning') {
    const stepIdx = srsCard.value.stepIndex
    const steps = settingsStore.srsSettings.learningStepsMinutes
    const min = steps[stepIdx] || steps[0] || 1
    return `< ${min}m (paso ${stepIdx + 1}/${steps.length})`
  }
  if (srsCard.value.interval === 0) return '0 días'
  if (srsCard.value.interval === 1) return '1 día'
  return `${srsCard.value.interval} días`
})

const retentionRate = computed(() => {
  if (reviewLogs.value.length === 0) return 0
  const successful = reviewLogs.value.filter(l => l.rating >= 3).length
  return Math.round((successful / reviewLogs.value.length) * 100)
})

const averageResponseTime = computed(() => {
  if (reviewLogs.value.length === 0) return null
  const total = reviewLogs.value.reduce((acc, l) => acc + (l.timeSpentMs || 0), 0)
  const avgSeconds = total / reviewLogs.value.length / 1000
  return avgSeconds < 10 ? avgSeconds.toFixed(1) + 's' : Math.round(avgSeconds) + 's'
})

const ratingBadges: Record<number, { text: string; class: string }> = {
  1: { text: 'Otra vez', class: 'text-rose-400 bg-rose-500/10 border-rose-500/25' },
  2: { text: 'Difícil', class: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  3: { text: 'Bien', class: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  4: { text: 'Fácil', class: 'text-sky-400 bg-sky-500/10 border-sky-500/25' },
}

// Acciones de SRS
async function onResetCard() {
  if (!props.pairItem || !srsCard.value) return

  const result = await showConfirm(
    `¿Reiniciar tarjeta ${props.pairItem.pair}?`,
    'El progreso volverá a 0 repeticiones e intervalo inicial. Tu palabra e imagen mnemotécnica se mantendrán intactas.',
    'Sí, reiniciar tarjeta',
    'Cancelar',
  )

  if (!result.isConfirmed) return

  const now = Date.now()
  const startingEase = settingsStore.srsSettings.startingEase || 2.5

  const resetCard: SRSCard = {
    ...srsCard.value,
    state: 'new',
    due: now,
    interval: 0,
    easeFactor: startingEase,
    stepIndex: 0,
    repetitions: 0,
    lapses: 0,
    lastReviewed: undefined,
  }

  await db.cards.put(resetCard)
  srsCard.value = resetCard

  if (reviewStore.currentCard?.id === resetCard.id) {
    reviewStore.currentCard = resetCard
  }

  emit('cardUpdated', resetCard)
  showSuccessToast(
    `Tarjeta ${props.pairItem.pair} reiniciada`,
    'Volvió al estado Nueva con 0 repeticiones',
  )
}

async function onTogglePairArchive() {
  if (!props.pairItem) return

  const willArchive = !isArchived.value

  if (willArchive) {
    const result = await showConfirm(
      `¿Archivar par ${props.pairItem.pair}?`,
      'El par no aparecerá en tus sesiones de estudio ni en la vista principal activa. Tu palabra, imagen y notas se conservarán.',
      'Sí, archivar',
      'Cancelar',
    )
    if (!result.isConfirmed) return
  }

  await pairsStore.setPairArchived(props.pairItem.id, willArchive)
  if (srsCard.value) {
    srsCard.value = {
      ...srsCard.value,
      isArchived: willArchive,
    }
  }

  showSuccessToast(
    willArchive ? `Par ${props.pairItem.pair} archivado` : `Par ${props.pairItem.pair} desarchivado`,
    willArchive
      ? 'Oculto de las listas activas y sesiones de repaso'
      : 'Vuelve a estar activo en tu lista y repasos',
  )
}

async function onDeletePair() {
  if (!props.pairItem) return
  const pairName = props.pairItem.pair
  const pairId = props.pairItem.id

  const result = await showConfirm(
    `¿Eliminar par ${pairName}?`,
    `Se eliminará definitivamente el par ${pairName}, su palabra, imagen y su tarjeta de repaso SRS. Esta acción no se puede deshacer.`,
    'Sí, eliminar permanentemente',
    'Cancelar',
  )

  if (!result.isConfirmed) return

  await pairsStore.deletePair(pairId)
  emit('deleted', pairId)
  closeModal()

  showSuccessToast(
    `Par ${pairName} eliminado`,
    'Eliminado de tu lista y base de datos',
  )
}

async function onToggleArchive() {
  if (!props.pairItem || !srsCard.value) return

  const willArchive = !srsCard.value.isArchived

  if (willArchive) {
    const result = await showConfirm(
      `¿Archivar tarjeta ${props.pairItem.pair}?`,
      'Esta tarjeta no volverá a aparecer en tus sesiones de estudio hasta que la desarchives. Tu palabra, imagen y progreso no se perderán.',
      'Sí, archivar',
      'Cancelar',
    )
    if (!result.isConfirmed) return
  }

  const updated: SRSCard = {
    ...srsCard.value,
    isArchived: willArchive,
  }

  await db.cards.put(updated)
  await pairsStore.setPairArchived(props.pairItem.id, willArchive)
  srsCard.value = updated

  if (reviewStore.currentCard?.id === updated.id) {
    reviewStore.currentCard = updated
  }

  emit('cardUpdated', updated)
  showSuccessToast(
    willArchive ? `Tarjeta ${props.pairItem.pair} archivada` : `Tarjeta ${props.pairItem.pair} desarchivada`,
    willArchive
      ? 'No se mostrará más en tus sesiones de estudio'
      : 'Volverá a aparecer en tus sesiones de repaso',
  )
}

async function onMakeDueToday() {
  if (!props.pairItem || !srsCard.value) return

  const updated: SRSCard = {
    ...srsCard.value,
    due: Date.now(),
  }

  await db.cards.put(updated)
  srsCard.value = updated

  if (reviewStore.currentCard?.id === updated.id) {
    reviewStore.currentCard = updated
  }

  emit('cardUpdated', updated)
  showSuccessToast(
    `Tarjeta ${props.pairItem.pair} lista`,
    'Disponible en tu sesión de estudio de hoy',
  )
}

async function onGraduateCard() {
  if (!props.pairItem || !srsCard.value) return

  const now = Date.now()
  const graduatingDays = settingsStore.srsSettings.graduatingIntervalDays || 1

  const updated: SRSCard = {
    ...srsCard.value,
    state: 'review',
    interval: graduatingDays,
    due: now + graduatingDays * 24 * 60 * 60 * 1000,
    repetitions: Math.max(1, (srsCard.value.repetitions || 0) + 1),
    stepIndex: 0,
    lastReviewed: now,
  }

  await db.cards.put(updated)
  srsCard.value = updated

  if (reviewStore.currentCard?.id === updated.id) {
    reviewStore.currentCard = updated
  }

  emit('cardUpdated', updated)
  showSuccessToast(
    `Tarjeta ${props.pairItem.pair} graduada`,
    `Fijada en Repaso con intervalo de ${graduatingDays} día(s)`,
  )
}

async function onClearHistory() {
  if (!props.pairItem || reviewLogs.value.length === 0) return

  const result = await showConfirm(
    `¿Borrar registros de ${props.pairItem.pair}?`,
    'Se eliminará el historial de respuestas pasadas de este par.',
    'Sí, borrar',
    'Cancelar',
  )

  if (!result.isConfirmed) return

  const logIds = reviewLogs.value
    .map(l => l.id)
    .filter((id): id is number => typeof id === 'number')

  if (logIds.length > 0) {
    await db.reviews.bulkDelete(logIds)
  }
  reviewLogs.value = []
  showSuccessToast('Registros borrados', 'El historial del par ha sido limpiado')
}

// Guardar Mnemotecnia
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
    :title="modalTitle"
    :subtitle="modalSubtitle"
    max-width="md"
    @close="closeModal"
  >
    <div v-if="pairItem" class="flex flex-col gap-4">
      <!-- ============================================== -->
      <!-- VISTA 1: DETALLE PRINCIPAL DEL PAR             -->
      <!-- ============================================== -->
      <template v-if="currentView === 'detail'">
        <!-- Fila de Uso y Letras -->
        <div class="flex items-center justify-between text-xs pb-1">
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

          <!-- Indicador si está archivada o fuera de esquema -->
          <div class="flex items-center gap-1.5">
            <span
              v-if="isOutsideScheme"
              class="px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-400 flex items-center gap-1"
            >
              <AppIcon name="lucide:alert-circle" :size="11" />
              <span>Fuera de esquema</span>
            </span>
            <span
              v-if="isArchived"
              class="px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-amber-500/10 border-amber-500/30 text-amber-400 flex items-center gap-1"
            >
              <AppIcon name="lucide:archive" :size="11" />
              <span>Archivada</span>
            </span>
          </div>
        </div>

        <!-- Alerta si el par no pertenece al esquema actual -->
        <div
          v-if="isOutsideScheme"
          class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200"
        >
          <AppIcon name="lucide:alert-triangle" :size="16" class-name="text-amber-400 shrink-0 mt-0.5" />
          <div class="flex-1">
            <p class="font-bold text-amber-300">Este par no pertenece a tu esquema actual</p>
            <p class="text-[11px] text-amber-400/80 mt-0.5 leading-relaxed">
              Las letras de este par no están presentes en tu cubo o corresponden al buffer. Puedes archivarlo para ocultarlo o eliminarlo permanentemente.
            </p>
          </div>
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
            class="w-full bg-dark-900 border border-dark-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none"
          />
        </div>

        <!-- Acciones del Par (Archivar / Eliminar) -->
        <div class="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-dark-950/80 border border-dark-800">
          <button
            type="button"
            class="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            :class="isArchived ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25' : 'bg-dark-900 border-dark-700 text-slate-300 hover:text-white hover:bg-dark-850'"
            @click="onTogglePairArchive"
          >
            <AppIcon :name="isArchived ? 'lucide:archive-restore' : 'lucide:archive'" :size="14" />
            <span>{{ isArchived ? 'Desarchivar par' : 'Archivar par' }}</span>
          </button>

          <button
            type="button"
            class="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 hover:border-rose-500/40 text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            @click="onDeletePair"
          >
            <AppIcon name="lucide:trash-2" :size="14" />
            <span>Eliminar par</span>
          </button>
        </div>

        <!-- Tarjeta para ir a Ver SRS -->
        <button
          type="button"
          class="w-full p-3 rounded-2xl bg-dark-950/90 border border-dark-800 hover:border-dark-700 active:scale-[0.99] flex items-center justify-between text-xs transition-all shadow-sm group cursor-pointer"
          @click="currentView = 'srs'"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div
              class="w-8 h-8 rounded-xl flex items-center justify-center border shrink-0"
              :class="srsCard?.isArchived ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : stateMeta.colorClass"
            >
              <AppIcon :name="srsCard?.isArchived ? 'lucide:archive' : 'lucide:brain'" :size="16" />
            </div>
            <div class="text-left truncate">
              <span class="font-bold text-slate-200">
                {{ srsCard?.isArchived ? 'Tarjeta Archivada' : 'Repetición Espaciada' }}
              </span>
              <p v-if="srsCard?.isArchived" class="text-amber-400 font-medium text-[11px] truncate mt-0.5">
                Oculta en sesiones de estudio
              </p>
              <p v-else class="text-slate-400 font-mono text-[11px] truncate mt-0.5">
                {{ stateMeta.label }} • {{ srsCard?.repetitions || 0 }} repeticiones • {{ formattedInterval }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1 font-semibold text-emerald-400 group-hover:text-emerald-300 shrink-0 ml-2 text-xs">
            <span>Ver SRS</span>
            <AppIcon name="lucide:chevron-right" :size="16" />
          </div>
        </button>
      </template>

      <!-- ============================================== -->
      <!-- VISTA 2: CONTENIDO COMPLETO SRS                -->
      <!-- ============================================== -->
      <template v-else-if="currentView === 'srs'">
        <!-- Botón único y claro de Retroceder -->
        <div class="flex items-center justify-between pb-1 border-b border-dark-800/60">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-dark-950 border border-dark-800 hover:border-dark-700 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95 shadow-sm"
            @click="currentView = 'detail'"
          >
            <AppIcon name="lucide:arrow-left" :size="15" />
            <span>Retroceder</span>
          </button>

          <span class="text-xs font-mono text-slate-400">
            Par: <strong class="text-white">{{ pairItem.pair }}</strong> ({{ pairItem.firstLetter }} + {{ pairItem.secondLetter }})
          </span>
        </div>

        <!-- Banner de advertencia si la tarjeta está archivada -->
        <div
          v-if="srsCard?.isArchived"
          class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs"
        >
          <div class="flex items-center gap-2 text-amber-400 font-medium min-w-0">
            <AppIcon name="lucide:archive" :size="16" class-name="shrink-0" />
            <span class="truncate">Tarjeta archivada: no aparece en tus repasos</span>
          </div>
          <button
            type="button"
            class="text-xs font-bold text-amber-300 hover:text-white underline cursor-pointer shrink-0"
            @click="onToggleArchive"
          >
            Desarchivar
          </button>
        </div>

        <!-- Tarjeta de Estado y Vencimiento -->
        <div class="p-3.5 rounded-2xl bg-dark-950/90 border border-dark-800 flex flex-col gap-2.5">
          <div class="flex items-center justify-between gap-2">
            <!-- Estado principal -->
            <div class="flex items-center gap-2.5 min-w-0">
              <div
                class="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0"
                :class="stateMeta.colorClass"
              >
                <AppIcon :name="stateMeta.icon" :size="18" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <h4 class="text-sm font-bold text-white truncate">
                    {{ stateMeta.label }}
                  </h4>
                  <span class="w-2 h-2 rounded-full shrink-0" :class="stateMeta.dotClass" />
                </div>
                <p class="text-[11px] text-slate-400 truncate">
                  {{ stateMeta.desc }}
                </p>
              </div>
            </div>

            <!-- Vencimiento Badge -->
            <div
              class="px-2.5 py-1 rounded-xl text-xs font-medium border flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              :class="dueInfo.isDue ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-dark-800 border-dark-700 text-slate-300'"
            >
              <AppIcon :name="dueInfo.isDue ? 'lucide:bell-ring' : 'lucide:clock'" :size="13" />
              <span>{{ dueInfo.text }}</span>
            </div>
          </div>

          <!-- Próximo repaso y última revisión -->
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-dark-900 text-xs">
            <div class="flex flex-col min-w-0">
              <span class="text-slate-500 text-[10px] uppercase font-semibold tracking-wider">Próximo</span>
              <span class="text-slate-200 font-mono text-xs truncate mt-0.5" :title="dueInfo.dateStr">
                {{ dueInfo.dateStr }}
              </span>
            </div>
            <div class="flex flex-col min-w-0">
              <span class="text-slate-500 text-[10px] uppercase font-semibold tracking-wider">Último</span>
              <span class="text-slate-200 text-xs truncate mt-0.5">
                {{ formatRelativeTime(srsCard?.lastReviewed) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Grid de 4 Métricas Clave de Repetición Espaciada -->
        <div class="grid grid-cols-2 gap-2">
          <!-- Métrica 1: Repeticiones -->
          <div class="p-3 rounded-xl bg-dark-900 border border-dark-800 flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-400">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Repeticiones</span>
              <AppIcon name="lucide:rotate-cw" :size="13" class-name="text-emerald-400" />
            </div>
            <div class="flex items-baseline gap-1 my-1">
              <span class="text-xl sm:text-2xl font-black text-white font-mono">
                {{ srsCard?.repetitions || 0 }}
              </span>
              <span class="text-[10px] text-slate-500">aciertos</span>
            </div>
            <span class="text-[10px] text-slate-400 truncate">Racha seguida</span>
          </div>

          <!-- Métrica 2: Intervalo Actual -->
          <div class="p-3 rounded-xl bg-dark-900 border border-dark-800 flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-400">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Intervalo</span>
              <AppIcon name="lucide:calendar" :size="13" class-name="text-sky-400" />
            </div>
            <div class="flex items-baseline gap-1 my-1">
              <span class="text-lg sm:text-xl font-bold text-white font-mono truncate">
                {{ formattedInterval }}
              </span>
            </div>
            <span class="text-[10px] text-slate-400 truncate">Espaciado actual</span>
          </div>

          <!-- Métrica 3: Facilidad -->
          <div class="p-3 rounded-xl bg-dark-900 border border-dark-800 flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-400">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Facilidad</span>
              <AppIcon name="lucide:gauge" :size="13" class-name="text-purple-400" />
            </div>
            <div class="flex items-baseline gap-1 my-1">
              <span class="text-xl sm:text-2xl font-black text-white font-mono">
                {{ srsCard ? Math.round(srsCard.easeFactor * 100) : 250 }}%
              </span>
            </div>
            <span class="text-[10px] text-slate-400 truncate">Factor SM-2</span>
          </div>

          <!-- Métrica 4: Olvidos -->
          <div class="p-3 rounded-xl bg-dark-900 border border-dark-800 flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-400">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Olvidos</span>
              <AppIcon name="lucide:alert-triangle" :size="13" class-name="text-amber-400" />
            </div>
            <div class="flex items-baseline gap-1 my-1">
              <span class="text-xl sm:text-2xl font-black font-mono" :class="(srsCard?.lapses || 0) > 0 ? 'text-amber-400' : 'text-slate-200'">
                {{ srsCard?.lapses || 0 }}
              </span>
              <span class="text-[10px] text-slate-500">veces</span>
            </div>
            <span class="text-[10px] text-slate-400 truncate">Fallos en repaso</span>
          </div>
        </div>

        <!-- Rendimiento histórico y estadísticas de respuesta (si hay datos) -->
        <div v-if="reviewLogs.length > 0" class="p-3 rounded-xl bg-dark-900 border border-dark-800 flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-semibold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <AppIcon name="lucide:activity" :size="13" class-name="text-emerald-400" />
              <span>Historial ({{ reviewLogs.length }})</span>
            </span>
            <div class="flex items-center gap-2 text-[11px] font-mono">
              <span class="text-emerald-400 font-bold">{{ retentionRate }}% acierto</span>
              <span v-if="averageResponseTime" class="text-slate-500">•</span>
              <span v-if="averageResponseTime" class="text-sky-400 font-bold">{{ averageResponseTime }}</span>
            </div>
          </div>

          <!-- Últimos repasos registrados -->
          <div class="flex flex-col gap-1 max-h-28 overflow-y-auto pr-1">
            <div
              v-for="log in reviewLogs.slice(0, 4)"
              :key="log.id || log.timestamp"
              class="flex items-center justify-between py-1 px-2 rounded-lg bg-dark-950/60 border border-dark-800/40 text-[11px]"
            >
              <div class="flex items-center gap-1.5">
                <span
                  class="px-1.5 py-0.2 rounded text-[10px] font-bold border font-mono"
                  :class="ratingBadges[log.rating]?.class"
                >
                  {{ ratingBadges[log.rating]?.text }}
                </span>
                <span class="text-slate-400">
                  {{ formatRelativeTime(log.timestamp) }}
                </span>
              </div>

              <div class="flex items-center gap-1.5 text-slate-400 font-mono text-[10px]">
                <span v-if="log.timeSpentMs">{{ (log.timeSpentMs / 1000).toFixed(1) }}s</span>
                <span>•</span>
                <span>{{ log.intervalBefore }}d → {{ log.intervalAfter }}d</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Panel de Acciones SRS -->
        <div class="p-3 rounded-2xl bg-dark-950 border border-dark-800 flex flex-col gap-2.5">
          <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <AppIcon name="lucide:settings-2" :size="13" />
            <span>Acciones SRS</span>
          </span>

          <!-- BOTÓN ARCHIVAR / DESARCHIVAR TARJETA -->
          <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-dark-900 border border-dark-800">
            <div class="flex flex-col min-w-0 pr-1">
              <span class="text-xs font-bold text-slate-200 flex items-center gap-1.5 truncate">
                <AppIcon :name="srsCard?.isArchived ? 'lucide:archive-restore' : 'lucide:archive'" :size="14" class-name="text-amber-400 shrink-0" />
                {{ srsCard?.isArchived ? 'Desarchivar tarjeta' : 'Archivar tarjeta' }}
              </span>
              <span class="text-[10px] text-slate-400 truncate">
                {{ srsCard?.isArchived ? 'Vuelve a incluirla en tus repasos' : 'No mostrar más hasta que la desarchives' }}
              </span>
            </div>
            <AppButton
              :variant="srsCard?.isArchived ? 'success' : 'secondary'"
              size="sm"
              :icon="srsCard?.isArchived ? 'lucide:archive-restore' : 'lucide:archive'"
              class="shrink-0 text-xs font-semibold px-2.5 py-1.5"
              @click="onToggleArchive"
            >
              {{ srsCard?.isArchived ? 'Desarchivar' : 'Archivar' }}
            </AppButton>
          </div>

          <!-- BOTÓN DESTACADO: REINICIAR TARJETA -->
          <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
            <div class="flex flex-col min-w-0 pr-1">
              <span class="text-xs font-bold text-rose-300 truncate">
                Reiniciar tarjeta
              </span>
              <span class="text-[10px] text-slate-400 truncate">
                Vuelve a 0 repeticiones e intervalo inicial
              </span>
            </div>
            <AppButton
              variant="danger"
              size="sm"
              icon="lucide:rotate-ccw"
              class="shrink-0 text-xs font-semibold px-2.5 py-1.5"
              @click="onResetCard"
            >
              Reiniciar
            </AppButton>
          </div>

          <!-- Acciones secundarias en 2 columnas -->
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              :disabled="dueInfo.isDue"
              class="p-2 rounded-xl bg-dark-900 border border-dark-800 hover:border-dark-700 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-all flex items-center justify-between group cursor-pointer"
              @click="onMakeDueToday"
            >
              <div class="flex flex-col min-w-0 pr-1">
                <span class="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors truncate">
                  Repasar Hoy
                </span>
                <span class="text-[10px] text-slate-500 truncate">
                  {{ dueInfo.isDue ? 'Ya disponible' : 'Adelantar fecha' }}
                </span>
              </div>
              <AppIcon name="lucide:calendar-clock" :size="15" class-name="text-slate-400 group-hover:text-emerald-400 shrink-0" />
            </button>

            <button
              type="button"
              :disabled="srsCard?.state === 'review'"
              class="p-2 rounded-xl bg-dark-900 border border-dark-800 hover:border-dark-700 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-all flex items-center justify-between group cursor-pointer"
              @click="onGraduateCard"
            >
              <div class="flex flex-col min-w-0 pr-1">
                <span class="text-xs font-semibold text-slate-200 group-hover:text-sky-400 transition-colors truncate">
                  Graduar
                </span>
                <span class="text-[10px] text-slate-500 truncate">
                  {{ srsCard?.state === 'review' ? 'Ya en repaso' : 'Marcar aprendida' }}
                </span>
              </div>
              <AppIcon name="lucide:graduation-cap" :size="15" class-name="text-slate-400 group-hover:text-sky-400 shrink-0" />
            </button>
          </div>

          <!-- Limpiar historial si existe -->
          <div v-if="reviewLogs.length > 0" class="pt-0.5 flex justify-end">
            <button
              type="button"
              class="text-[10px] text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
              @click="onClearHistory"
            >
              <AppIcon name="lucide:trash-2" :size="11" />
              <span>Borrar registros de repasos</span>
            </button>
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <template v-if="currentView === 'detail'">
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

      <!-- En la vista SRS: solo una opción de retroceder -->
      <template v-else>
        <AppButton
          variant="secondary"
          size="md"
          icon="lucide:arrow-left"
          class="w-full sm:w-auto"
          @click="currentView = 'detail'"
        >
          Retroceder
        </AppButton>
      </template>
    </template>
  </AppModal>
</template>
