<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useReviewStore } from '@/stores/useReviewStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import type { PairItem } from '@/models/pair'
import AppHeader from '@/components/ui/AppHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import FlashCard from '@/components/card/FlashCard.vue'
import RatingButtons from '@/components/card/RatingButtons.vue'
import CardGestureHelpModal from '@/components/card/CardGestureHelpModal.vue'
import PairEditModal from '@/components/matrix/PairEditModal.vue'
import RubikLoader from '@/components/RubikLoader.vue'
import { showSuccessToast } from '@/utils/alerts'

const reviewStore = useReviewStore()
const settingsStore = useSettingsStore()

const editingPair = ref<PairItem | null>(null)
const showEditModal = ref(false)
const showGestureHelp = ref(false)

const hasCards = computed(() => !!reviewStore.currentCard && !!reviewStore.currentPair)

function onKeyDown(e: KeyboardEvent) {
  if (showEditModal.value) return
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    e.target instanceof HTMLSelectElement
  ) {
    return
  }

  if (e.code === 'Space' || e.key === ' ') {
    if (hasCards.value && !reviewStore.isFlipped) {
      e.preventDefault()
      reviewStore.flip()
    }
  } else if ((e.key === 'e' || e.key === 'E') && hasCards.value && reviewStore.currentPair) {
    e.preventDefault()
    onOpenEdit(reviewStore.currentPair)
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  await reviewStore.loadReviewSession()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})

function onOpenEdit(pair: PairItem) {
  editingPair.value = pair
  showEditModal.value = true
}

function onPairSaved() {
  // Recargar la tarjeta actual si fue editada
}

async function onCardUpdated() {
  await reviewStore.loadReviewSession()
}

async function addMoreNewCards() {
  settingsStore.srsSettings.newCardsPerDay += 10
  await reviewStore.loadReviewSession()
  showSuccessToast('Tarjetas añadidas', '+10 tarjetas nuevas agregadas a la sesión')
}

async function onRefreshSession() {
  await reviewStore.loadReviewSession()
  showSuccessToast('Sesión actualizada', 'Se verificó la cola de repaso')
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-dark-950">
    <AppHeader title="Repaso BLD">
      <template #actions>
        <!-- Contador Anki: Nuevas (Azul), Aprendizaje (Naranja), Vencidas (Verde) -->
        <div class="flex items-center gap-1.5 font-mono text-xs font-bold bg-dark-900 border border-dark-700/80 px-2.5 py-1.5 rounded-xl">
          <span class="text-sky-400" title="Nuevas">{{ reviewStore.queueCounts.new }}</span>
          <span class="text-slate-600">•</span>
          <span class="text-amber-400" title="Aprendiendo">{{ reviewStore.queueCounts.learning }}</span>
          <span class="text-slate-600">•</span>
          <span class="text-emerald-400" title="Vencidas">{{ reviewStore.queueCounts.due }}</span>
        </div>
      </template>
    </AppHeader>

    <!-- Filtro de tipo de pieza para la sesión -->
    <div class="px-3 sm:px-4 py-2 border-b border-dark-900 flex items-center justify-between gap-2 shrink-0">
      <div class="flex items-center gap-0.5 sm:gap-1 bg-dark-900 p-1 rounded-xl border border-dark-800 text-xs shrink-0">
        <button
          type="button"
          :class="[
            'px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-colors text-xs',
            reviewStore.filterType === 'all'
              ? 'bg-green-600 text-white'
              : 'text-slate-400 hover:text-slate-200',
          ]"
          @click="reviewStore.filterType = 'all'; reviewStore.loadReviewSession()"
        >
          Todos
        </button>
        <button
          type="button"
          :class="[
            'px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-colors text-xs',
            reviewStore.filterType === 'corner'
              ? 'bg-green-600 text-white'
              : 'text-slate-400 hover:text-slate-200',
          ]"
          @click="reviewStore.filterType = 'corner'; reviewStore.loadReviewSession()"
        >
          Esquinas
        </button>
        <button
          type="button"
          :class="[
            'px-2 sm:px-2.5 py-1 rounded-lg font-medium transition-colors text-xs',
            reviewStore.filterType === 'edge'
              ? 'bg-green-600 text-white'
              : 'text-slate-400 hover:text-slate-200',
          ]"
          @click="reviewStore.filterType = 'edge'; reviewStore.loadReviewSession()"
        >
          Aristas
        </button>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          class="text-xs text-sky-400 hover:text-sky-300 flex items-center justify-center gap-1 font-medium p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 active:scale-95 transition-all"
          title="Ver gestos táctiles"
          aria-label="Ver gestos táctiles"
          @click="showGestureHelp = true"
        >
          <AppIcon name="lucide:hand" :size="15" />
          <span class="hidden sm:inline">Gestos</span>
        </button>

        <button
          type="button"
          class="text-xs text-green-400 hover:text-green-300 flex items-center justify-center gap-1 font-medium p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 active:scale-95 transition-all"
          title="Recargar sesión"
          aria-label="Recargar sesión"
          @click="onRefreshSession"
        >
          <AppIcon name="lucide:rotate-cw" :size="15" />
          <span class="hidden sm:inline">Recargar</span>
        </button>
      </div>
    </div>

    <!-- Contenido Principal -->
    <div class="flex-1 flex flex-col justify-between p-4 overflow-y-auto">
      <!-- CASO 0: Cargando -->
      <div v-if="reviewStore.loading" class="flex-1 flex items-center justify-center my-auto py-12">
        <RubikLoader label="Cargando sesión de repaso..." />
      </div>

      <!-- CASO 1: Sesión en Curso -->
      <template v-else-if="hasCards">
        <div class="flex-1 flex items-center justify-center py-2">
          <FlashCard
            :pair="reviewStore.currentPair!"
            :card="reviewStore.currentCard!"
            :is-flipped="reviewStore.isFlipped"
            :reverse-mode="settingsStore.reversePractice"
            :enable-gestures="settingsStore.enableCardGestures"
            :allow-swipe-before-flip="settingsStore.allowSwipeBeforeFlip"
            :sensitivity="settingsStore.gestureSensitivity"
            :intervals="reviewStore.buttonIntervals"
            @flip="reviewStore.flip"
            @edit="onOpenEdit"
            @rate="reviewStore.rate"
          />
        </div>

        <!-- Controles de la parte inferior -->
        <div class="w-full pt-3 pb-1">
          <!-- Si la tarjeta no se ha volteado aún -->
          <div v-if="!reviewStore.isFlipped" class="w-full max-w-sm mx-auto">
            <AppButton
              variant="primary"
              size="lg"
              class="w-full font-bold shadow-green-600/30"
              icon="lucide:eye"
              @click="reviewStore.flip"
            >
              Mostrar Respuesta (Espacio)
            </AppButton>
          </div>

          <!-- Si la tarjeta ya fue volteada: Botones AnkiDroid -->
          <div v-else>
            <RatingButtons
              :intervals="reviewStore.buttonIntervals"
              @rate="reviewStore.rate"
            />
          </div>

          <!-- Indicador de atajos de teclado para PC (Espacio, 1-4, E) -->
          <div class="hidden sm:flex items-center justify-center gap-4 text-[11px] text-slate-500 mt-2.5 font-mono select-none">
            <span class="flex items-center gap-1.5">
              <kbd class="px-1.5 py-0.5 bg-dark-900 border border-dark-800 rounded text-slate-400 text-[10px]">Espacio</kbd>
              <span>Voltear</span>
            </span>
            <span class="text-slate-700">•</span>
            <span class="flex items-center gap-1.5">
              <kbd class="px-1.5 py-0.5 bg-dark-900 border border-dark-800 rounded text-slate-400 text-[10px]">1 - 4</kbd>
              <span>Calificar</span>
            </span>
            <span class="text-slate-700">•</span>
            <span class="flex items-center gap-1.5">
              <kbd class="px-1.5 py-0.5 bg-dark-900 border border-dark-800 rounded text-slate-400 text-[10px]">E</kbd>
              <span>Editar</span>
            </span>
          </div>
        </div>
      </template>

      <!-- CASO 2: Sin tarjetas pendientes hoy -->
      <template v-else>
        <div class="my-auto flex flex-col items-center justify-center text-center p-6 max-w-sm mx-auto">
          <div class="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/5">
            <AppIcon name="lucide:party-popper" :size="32" />
          </div>

          <h2 class="text-xl font-bold text-white mb-1">
            ¡Has terminado por hoy!
          </h2>
          <p class="text-xs text-slate-400 mb-6">
            Completaste todas las tarjetas programadas para este momento.
          </p>

          <!-- Resumen de sesión -->
          <div
            v-if="reviewStore.sessionStats.reviewedCount > 0"
            class="w-full bg-dark-900 border border-dark-800 rounded-2xl p-4 mb-6 text-left"
          >
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Resumen de la sesión
            </h3>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div class="bg-dark-950 p-2.5 rounded-xl border border-dark-800">
                <span class="text-slate-400">Repasadas</span>
                <p class="text-base font-bold text-white font-mono mt-0.5">
                  {{ reviewStore.sessionStats.reviewedCount }}
                </p>
              </div>
              <div class="bg-dark-950 p-2.5 rounded-xl border border-dark-800">
                <span class="text-slate-400">Aciertos (Bien/Fácil)</span>
                <p class="text-base font-bold text-emerald-400 font-mono mt-0.5">
                  {{ reviewStore.sessionStats.goodCount + reviewStore.sessionStats.easyCount }}
                </p>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-2.5 w-full">
            <AppButton
              variant="secondary"
              size="md"
              icon="lucide:plus"
              @click="addMoreNewCards"
            >
              Estudiar 10 cartas nuevas
            </AppButton>
            <router-link to="/pairs">
              <AppButton variant="outline" size="md" class="w-full" icon="lucide:pencil">
                Completar más palabras e imágenes
              </AppButton>
            </router-link>
          </div>
        </div>
      </template>
    </div>

    <!-- Modal para editar mnemotecnia sobre la marcha -->
    <PairEditModal
      v-model="showEditModal"
      :pair-item="editingPair"
      @saved="onPairSaved"
      @card-updated="onCardUpdated"
    />

    <!-- Modal informativo de gestos de deslizamiento -->
    <CardGestureHelpModal
      v-model="showGestureHelp"
    />
  </div>
</template>
