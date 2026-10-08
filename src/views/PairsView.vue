<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { usePairsStore } from '@/stores/usePairsStore'
import type { PairItem, PairUsage } from '@/models/pair'
import AppHeader from '@/components/ui/AppHeader.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import PairGrid from '@/components/matrix/PairGrid.vue'
import PairEditModal from '@/components/matrix/PairEditModal.vue'
import RubikLoader from '@/components/RubikLoader.vue'

const pairsStore = usePairsStore()

const viewMode = ref<'list' | 'matrix'>('list')
const editingPair = ref<PairItem | null>(null)
const showModal = ref(false)

// Paginación incremental para rendimiento instantáneo (< 10ms render)
const PAGE_SIZE = 40
const displayLimit = ref(PAGE_SIZE)
const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const displayedPairs = computed(() => {
  return pairsStore.filteredPairs.slice(0, displayLimit.value)
})

const hasMore = computed(() => {
  return displayLimit.value < pairsStore.filteredPairs.length
})

function loadMore() {
  if (hasMore.value) {
    displayLimit.value += PAGE_SIZE
  }
}

// Reset de paginación al cambiar cualquier filtro
watch(
  [
    () => pairsStore.filterUsage,
    () => pairsStore.filterStatus,
    () => pairsStore.searchQuery,
    () => pairsStore.selectedLetter,
    viewMode,
  ],
  () => {
    displayLimit.value = PAGE_SIZE
  },
)

onMounted(async () => {
  await pairsStore.loadPairs()

  // Configurar IntersectionObserver para infinite scroll fluido sin bloquear el hilo principal
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        loadMore()
      }
    },
    { rootMargin: '300px' },
  )

  if (sentinelRef.value) {
    observer.observe(sentinelRef.value)
  }
})

watch(sentinelRef, (newEl, oldEl) => {
  if (oldEl && observer) observer.unobserve(oldEl)
  if (newEl && observer) observer.observe(newEl)
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
})

function onOpenEdit(pair: PairItem) {
  editingPair.value = pair
  showModal.value = true
}

function selectLetter(letter: string | null) {
  pairsStore.selectedLetter = pairsStore.selectedLetter === letter ? null : letter
}

const usageFilters = [
  { value: 'all', label: 'Todos' },
  { value: 'both', label: 'Ambas' },
  { value: 'corner', label: 'Solo Esquinas' },
  { value: 'edge', label: 'Solo Aristas' },
] as const

const showFilters = ref(false)

const hasActiveFilters = computed(() => {
  return (
    pairsStore.filterUsage !== 'all' ||
    pairsStore.filterStatus !== 'all' ||
    pairsStore.selectedLetter !== null
  )
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (pairsStore.filterUsage !== 'all') count++
  if (pairsStore.filterStatus !== 'all') count++
  if (pairsStore.selectedLetter !== null) count++
  return count
})

function resetFilters() {
  pairsStore.filterUsage = 'all'
  pairsStore.filterStatus = 'all'
  pairsStore.selectedLetter = null
}

let lastScrollTop = 0
function onListScroll(event: Event) {
  const target = event.target as HTMLElement
  const currentScrollTop = target.scrollTop

  // Si el usuario scrollea hacia abajo y los filtros están desplegados, replegarlos
  if (showFilters.value && currentScrollTop > 30 && currentScrollTop > lastScrollTop) {
    showFilters.value = false
  }
  lastScrollTop = currentScrollTop
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-dark-950">
    <AppHeader title="Gestor de Pares">
      <template #actions>
        <!-- Selector Lista / Matriz -->
        <div class="h-[30px] inline-flex items-center bg-dark-900 border border-dark-700/80 p-0.5 rounded-lg gap-0.5">
          <button
            type="button"
            :class="[
              'h-full w-7 flex items-center justify-center rounded-md transition-all duration-150',
              viewMode === 'list'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white',
            ]"
            title="Vista de Lista"
            @click="viewMode = 'list'"
          >
            <AppIcon name="lucide:list" :size="14" />
          </button>
          <button
            type="button"
            :class="[
              'h-full w-7 flex items-center justify-center rounded-md transition-all duration-150',
              viewMode === 'matrix'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white',
            ]"
            title="Vista de Matriz"
            @click="viewMode = 'matrix'"
          >
            <AppIcon name="lucide:grid-2x2" :size="14" />
          </button>
        </div>
      </template>
    </AppHeader>

    <!-- Barra de progreso y estadísticas detalladas por uso -->
    <div class="px-4 py-2.5 bg-dark-900/60 border-b border-dark-800/80 shrink-0">
      <div class="flex items-center justify-between text-xs mb-1.5">
        <span class="text-slate-400 font-medium">
          Progreso de tu lista de pares
        </span>
        <span class="font-mono font-bold text-indigo-400">
          {{ pairsStore.stats.completed }} / {{ pairsStore.stats.total }} ({{ pairsStore.stats.percentage }}%)
        </span>
      </div>

      <!-- Barra de progreso animada -->
      <div class="w-full h-2 bg-dark-800 rounded-full overflow-hidden flex">
        <div
          class="bg-indigo-500 h-full transition-all duration-300"
          :style="{ width: `${pairsStore.stats.percentage}%` }"
        />
      </div>

      <!-- Métricas y etiquetas de uso -->
      <div class="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
        <span class="flex items-center gap-1 font-medium">
          <span class="w-2 h-2 rounded-full bg-purple-400" />
          {{ pairsStore.stats.bothCount }} Ambas
        </span>
        <span class="flex items-center gap-1 font-medium">
          <span class="w-2 h-2 rounded-full bg-amber-400" />
          {{ pairsStore.stats.cornerOnlyCount }} Solo Esquinas
        </span>
        <span class="flex items-center gap-1 font-medium">
          <span class="w-2 h-2 rounded-full bg-emerald-400" />
          {{ pairsStore.stats.edgeOnlyCount }} Solo Aristas
        </span>
        <span class="flex items-center gap-1 font-medium ml-auto">
          <AppIcon name="lucide:image" :size="12" class-name="text-indigo-400" />
          {{ pairsStore.stats.withImage }} con foto
        </span>
      </div>
    </div>

    <!-- Filtros de búsqueda y uso -->
    <div class="p-3 border-b border-dark-900 flex flex-col gap-2.5 shrink-0 bg-dark-950">
      <!-- Fila Buscador y Botón de Filtros -->
      <div class="flex items-center gap-2 w-full">
        <div class="flex-1 min-w-0 transition-all duration-300">
          <AppInput
            v-model="pairsStore.searchQuery"
            placeholder="Buscar par o palabra (ej: PJ, Pijama)..."
            icon="lucide:search"
            clearable
          />
        </div>

        <!-- Botón que se oculta al presionarlo, haciendo que el buscador tome todo el ancho -->
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 scale-90 -mr-2 w-0"
          enter-to-class="opacity-100 scale-100 mr-0 w-11"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 scale-100 mr-0 w-11"
          leave-to-class="opacity-0 scale-90 -mr-2 w-0"
        >
          <button
            v-if="!showFilters"
            type="button"
            title="Abrir filtros"
            class="h-11 px-3 rounded-xl bg-dark-900 border border-dark-700 hover:border-indigo-500/70 text-slate-300 hover:text-white flex items-center justify-center transition-all duration-150 active:scale-95 shrink-0 relative shadow-sm"
            @click="showFilters = true"
          >
            <AppIcon name="lucide:sliders-horizontal" :size="18" />
            <!-- Indicador dot si hay filtros activos aplicados -->
            <span
              v-if="hasActiveFilters"
              class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 ring-2 ring-dark-950 rounded-full"
            />
          </button>
        </Transition>
      </div>

      <!-- Panel de Filtros Desplegable -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out overflow-hidden"
        enter-from-class="opacity-0 max-h-0 -translate-y-2"
        enter-to-class="opacity-100 max-h-96 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in overflow-hidden"
        leave-from-class="opacity-100 max-h-96 translate-y-0"
        leave-to-class="opacity-0 max-h-0 -translate-y-2"
      >
        <div v-if="showFilters" class="flex flex-col gap-2.5 pt-1">
          <!-- Filtros por etiqueta de uso y estado -->
          <div class="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            <!-- Filtro de Etiquetas de Uso (Ambas, Solo Esquinas, Solo Aristas) -->
            <div class="flex items-center gap-1 bg-dark-900 p-0.5 rounded-xl border border-dark-800 shrink-0">
              <button
                v-for="uf in usageFilters"
                :key="uf.value"
                type="button"
                :class="[
                  'px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 flex items-center gap-1',
                  pairsStore.filterUsage === uf.value
                    ? 'bg-dark-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200',
                ]"
                @click="pairsStore.filterUsage = uf.value as PairUsage | 'all'"
              >
                <span
                  v-if="uf.value === 'both'"
                  class="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block"
                />
                <span
                  v-else-if="uf.value === 'corner'"
                  class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"
                />
                <span
                  v-else-if="uf.value === 'edge'"
                  class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"
                />
                <span>{{ uf.label }}</span>
              </button>
            </div>

            <!-- Filtro de Estado (Completos / Vacíos) -->
            <div class="flex items-center gap-1 bg-dark-900 p-0.5 rounded-xl border border-dark-800 shrink-0">
              <button
                v-for="st in (['all', 'completed', 'missing'] as const)"
                :key="st"
                type="button"
                :class="[
                  'px-2 py-1 rounded-lg font-medium transition-colors',
                  pairsStore.filterStatus === st
                    ? 'bg-dark-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200',
                ]"
                @click="pairsStore.filterStatus = st"
              >
                {{ st === 'all' ? 'Todos' : st === 'completed' ? 'Listos' : 'Vacíos' }}
              </button>
            </div>
          </div>

          <!-- Chips de letra inicial para saltar rápido -->
          <div class="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            <button
              v-for="letter in pairsStore.availableLetters"
              :key="letter"
              type="button"
              :class="[
                'px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all shrink-0',
                pairsStore.selectedLetter === letter
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-dark-900 text-slate-400 hover:text-white border border-dark-800',
              ]"
              @click="selectLetter(letter)"
            >
              {{ letter }}
            </button>
          </div>

          <!-- Barra inferior del panel: estado de filtros y pestaña "Ocultar filtros ▲" -->
          <div class="flex items-center justify-between pt-1 border-t border-dark-900/80">
            <div class="flex items-center gap-2 text-[11px] text-slate-400">
              <span v-if="hasActiveFilters" class="text-indigo-400 font-medium">
                {{ activeFiltersCount }} filtro{{ activeFiltersCount > 1 ? 's' : '' }} activo{{ activeFiltersCount > 1 ? 's' : '' }}
              </span>
              <button
                v-if="hasActiveFilters"
                type="button"
                class="text-xs text-rose-400 hover:text-rose-300 underline font-medium"
                @click="resetFilters"
              >
                Restablecer
              </button>
              <span v-else class="text-slate-500">Sin filtros activos</span>
            </div>

            <!-- Botón / Pestaña para volver a cerrar los filtros -->
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-dark-900 hover:bg-dark-800 text-slate-300 hover:text-white border border-dark-800 text-xs font-medium transition-all active:scale-95 shadow-sm"
              @click="showFilters = false"
            >
              <span>Ocultar filtros</span>
              <AppIcon name="lucide:chevron-up" :size="14" />
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Contenedor con scroll para Lista o Matriz -->
    <div class="flex-1 overflow-y-auto p-3" @scroll="onListScroll">
      <!-- Loading State -->
      <div v-if="pairsStore.loading" class="flex items-center justify-center py-20">
        <RubikLoader label="Cargando pares de letras..." />
      </div>

      <!-- VISTA LISTA: Carga incremental fluida e instantánea -->
      <div v-else-if="viewMode === 'list'" class="flex flex-col gap-2 max-w-lg mx-auto">
        <div
          v-for="item in displayedPairs"
          :key="item.id"
          class="flex items-center justify-between p-3 rounded-2xl bg-dark-900/90 border border-dark-800 hover:border-dark-700 active:scale-[0.99] transition-all cursor-pointer"
          @click="onOpenEdit(item)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <!-- Letra del Par -->
            <div
              class="w-12 h-12 rounded-xl bg-dark-950 border border-dark-700/80 flex items-center justify-center font-mono font-black text-lg text-white shrink-0 shadow-inner"
            >
              {{ item.pair }}
            </div>

            <!-- Miniatura de imagen si existe -->
            <div
              v-if="item.image"
              class="w-12 h-12 rounded-xl overflow-hidden bg-dark-950 border border-dark-800 shrink-0 flex items-center justify-center"
            >
              <img :src="item.image" class="w-full h-full object-cover" />
            </div>

            <!-- Detalles de texto -->
            <div class="truncate">
              <div class="flex items-center gap-2">
                <span
                  v-if="item.word"
                  class="font-bold text-sm text-slate-100 truncate"
                >
                  {{ item.word }}
                </span>
                <span
                  v-else
                  class="text-xs text-slate-500 italic"
                >
                  (Sin palabra)
                </span>
              </div>

              <!-- Etiquetas de uso (Ambas, Solo Esquinas, Solo Aristas) -->
              <div class="flex items-center gap-2 mt-1">
                <AppBadge
                  :variant="item.usage === 'both' ? 'accent' : item.usage === 'corner' ? 'warning' : 'success'"
                  size="sm"
                >
                  {{ item.usage === 'both' ? 'Ambas' : item.usage === 'corner' ? 'Solo Esquinas' : 'Solo Aristas' }}
                </AppBadge>
                <span v-if="item.notes" class="text-[11px] text-slate-400 truncate max-w-[120px]">
                  {{ item.notes }}
                </span>
              </div>
            </div>
          </div>

          <!-- Botón editar -->
          <div class="text-slate-400 p-2 hover:text-white">
            <AppIcon name="lucide:chevron-right" :size="18" />
          </div>
        </div>

        <!-- Empty state si no hay resultados -->
        <div
          v-if="pairsStore.filteredPairs.length === 0"
          class="py-12 text-center text-slate-500 text-xs"
        >
          No se encontraron pares con estos filtros.
        </div>

        <!-- Sentinel invisible para scroll infinito sin retrasos -->
        <div ref="sentinelRef" class="h-6 flex items-center justify-center">
          <span
            v-if="hasMore"
            class="text-[11px] text-slate-500 cursor-pointer hover:text-slate-300 py-2"
            @click="loadMore"
          >
            Cargando más pares ({{ displayedPairs.length }} de {{ pairsStore.filteredPairs.length }})...
          </span>
          <span
            v-else-if="pairsStore.filteredPairs.length > 0"
            class="text-[10px] text-slate-600 py-2"
          >
            Mostrando todos los {{ pairsStore.filteredPairs.length }} pares
          </span>
        </div>
      </div>

      <!-- VISTA MATRIZ -->
      <div v-else class="max-w-4xl mx-auto">
        <PairGrid
          :pairs="pairsStore.filteredPairs"
          :letters="pairsStore.availableLetters"
          @select="onOpenEdit"
        />
      </div>
    </div>

    <!-- Modal de edición -->
    <PairEditModal
      v-model="showModal"
      :pair-item="editingPair"
    />
  </div>
</template>
