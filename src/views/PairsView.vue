<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { usePairsStore } from '@/stores/usePairsStore'
import type { PairItem, PairUsage } from '@/models/pair'
import { cleanPairLetters } from '@/services/pairSearch'
import { showConfirm, showSuccessToast } from '@/utils/alerts'
import AppHeader from '@/components/ui/AppHeader.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import PairGrid from '@/components/matrix/PairGrid.vue'
import PairEditModal from '@/components/matrix/PairEditModal.vue'
import RubikLoader from '@/components/RubikLoader.vue'

const pairsStore = usePairsStore()

const viewMode = ref<'list' | 'matrix'>('list')
const editingPair = ref<PairItem | null>(null)
const showModal = ref(false)

// Modo de selección múltiple para acciones en lote (archivar / desarchivar)
const isSelectMode = ref(false)
const selectedPairIds = ref<Set<string>>(new Set())

function toggleSelectMode() {
  isSelectMode.value = !isSelectMode.value
  if (!isSelectMode.value) {
    selectedPairIds.value.clear()
  } else if (viewMode.value !== 'list') {
    viewMode.value = 'list'
  }
}

function toggleSelectPair(id: string) {
  const next = new Set(selectedPairIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedPairIds.value = next
}

const isAllSelected = computed(() => {
  if (displayedPairs.value.length === 0) return false
  return displayedPairs.value.every(p => selectedPairIds.value.has(p.id))
})

function toggleSelectAll() {
  const next = new Set(selectedPairIds.value)
  if (isAllSelected.value) {
    displayedPairs.value.forEach(p => next.delete(p.id))
  } else {
    displayedPairs.value.forEach(p => next.add(p.id))
  }
  selectedPairIds.value = next
}

const selectedArchivedCount = computed(() => {
  let count = 0
  for (const id of selectedPairIds.value) {
    const pair = pairsStore.getPairById(id)
    if (pair?.isArchived) count++
  }
  return count
})

const selectedActiveCount = computed(() => {
  return selectedPairIds.value.size - selectedArchivedCount.value
})

async function handleBatchArchive(archive: boolean) {
  const ids = Array.from(selectedPairIds.value)
  if (ids.length === 0) return

  const actionName = archive ? 'archivar' : 'desarchivar'
  const count = ids.length
  const confirmText = archive
    ? `¿Archivar ${count} pares seleccionados?`
    : `¿Desarchivar ${count} pares seleccionados?`
  const confirmDesc = archive
    ? 'Estos pares se ocultarán de tus sesiones de repaso SRS diario. Sus palabras, notas e imágenes se conservarán intactas.'
    : 'Estos pares volverán a estar activos en tus sesiones de repaso SRS.'

  const res = await showConfirm(
    confirmText,
    confirmDesc,
    `Sí, ${actionName}`,
    'Cancelar',
  )
  if (!res.isConfirmed) return

  await pairsStore.archivePairs(ids, archive)
  showSuccessToast(
    archive ? `${count} pares archivados` : `${count} pares desarchivados`,
    archive
      ? 'Se marcaron como archivados en el sistema'
      : 'Se restablecieron como activos en tus repasos',
  )

  selectedPairIds.value.clear()
  isSelectMode.value = false
}

function handleCardClick(item: PairItem) {
  if (isSelectMode.value) {
    toggleSelectPair(item.id)
  } else {
    onOpenEdit(item)
  }
}

function handleCardContextMenu(item: PairItem, event: MouseEvent) {
  event.preventDefault()
  if (!isSelectMode.value) {
    isSelectMode.value = true
  }
  toggleSelectPair(item.id)
}

// Paginación incremental para rendimiento instantáneo (< 10ms render)
const PAGE_SIZE = 50
const displayLimit = ref(PAGE_SIZE)
const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const isSearching = computed(() => !!pairsStore.searchQuery.trim())

// Cuando hay una búsqueda activa, mostramos todos los resultados encontrados de inmediato
// para que el usuario nunca sienta que el buscador "se limita" o queda incompleto
const displayedPairs = computed(() => {
  if (isSearching.value) {
    return pairsStore.filteredPairs
  }
  return pairsStore.filteredPairs.slice(0, displayLimit.value)
})

const hasMore = computed(() => {
  if (isSearching.value) return false
  return displayLimit.value < pairsStore.filteredPairs.length
})

function loadMore() {
  if (hasMore.value) {
    displayLimit.value += PAGE_SIZE
  }
}

function isExactPairMatch(item: PairItem): boolean {
  const q = pairsStore.searchQuery.trim()
  if (!q) return false
  const clean = cleanPairLetters(q)
  return clean.length > 0 && item.pair.toUpperCase() === clean
}

// Al escribir en el buscador, deseleccionar chip de letra para buscar libremente en todo el catálogo
watch(
  () => pairsStore.searchQuery,
  (newVal) => {
    if (newVal.trim() && pairsStore.selectedLetter) {
      pairsStore.selectedLetter = null
    }
  },
)

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

const statusFilters = computed(() => {
  const list = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'completed', label: 'Listos' },
    { value: 'missing', label: 'Vacíos' },
    {
      value: 'archived',
      label: 'Archivados',
      badge: pairsStore.stats.archivedCount > 0 ? pairsStore.stats.archivedCount : null,
      badgeClass: 'bg-amber-500/20 text-amber-300',
    },
  ] as Array<{ value: any; label: string; badge?: number | null; badgeClass?: string }>

  if (pairsStore.pairsOutsideScheme.length > 0) {
    list.push({
      value: 'outside_scheme',
      label: 'Fuera de esquema',
      badge: pairsStore.pairsOutsideScheme.length,
      badgeClass: 'bg-rose-500/20 text-rose-300',
    })
  }

  return list
})

async function confirmArchiveOutside() {
  const count = pairsStore.pairsOutsideScheme.length
  if (count === 0) return
  const letters = pairsStore.outsideSchemeLetters.join(', ')
  const res = await showConfirm(
    `¿Archivar ${count} pares fuera de esquema?`,
    `Estos pares (letras: ${letters}) se ocultarán de tu lista activa y no aparecerán en tus repasos SRS. Tus palabras e imágenes se conservarán.`,
    `Sí, archivar ${count} pares`,
    'Cancelar',
  )
  if (!res.isConfirmed) return
  await pairsStore.archiveAllOutsideScheme()
  showSuccessToast('Pares archivados', `Se archivaron ${count} pares correctamente`)
}

async function confirmDeleteOutside() {
  const count = pairsStore.pairsOutsideScheme.length
  if (count === 0) return
  const letters = pairsStore.outsideSchemeLetters.join(', ')
  const res = await showConfirm(
    `¿Eliminar definitivamente ${count} pares fuera de esquema?`,
    `Se borrarán permanentemente estos ${count} pares (letras: ${letters}), sus palabras y sus tarjetas SRS. Esta acción no se puede deshacer.`,
    `Sí, eliminar definitivamente`,
    'Cancelar',
  )
  if (!res.isConfirmed) return
  await pairsStore.deleteAllOutsideScheme()
  showSuccessToast('Pares eliminados', `Se eliminaron ${count} pares del sistema`)
}

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

  // Carga continua de respaldo si el IntersectionObserver se retarda
  if (hasMore.value && target.scrollTop + target.clientHeight >= target.scrollHeight - 350) {
    loadMore()
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-dark-950">
    <AppHeader title="Gestor de Pares">
      <template #actions>
        <!-- Botón Selección en Lote -->
        <button
          type="button"
          :class="[
            'h-[30px] px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer',
            isSelectMode
              ? 'bg-green-600 text-white shadow-sm'
              : 'bg-dark-900 border border-dark-700/80 text-slate-300 hover:text-white',
          ]"
          :title="isSelectMode ? 'Cancelar selección' : 'Seleccionar pares en lote'"
          @click="toggleSelectMode"
        >
          <AppIcon :name="isSelectMode ? 'lucide:x' : 'lucide:list-checks'" :size="14" />
          <span>{{ isSelectMode ? 'Cancelar' : 'Seleccionar' }}</span>
        </button>

        <!-- Selector Lista / Matriz -->
        <div class="h-[30px] inline-flex items-center bg-dark-900 border border-dark-700/80 p-0.5 rounded-lg gap-0.5">
          <button
            type="button"
            :class="[
              'h-full w-7 flex items-center justify-center rounded-md transition-all duration-150',
              viewMode === 'list'
                ? 'bg-green-600 text-white shadow-sm'
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
                ? 'bg-green-600 text-white shadow-sm'
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
      <div class="max-w-lg md:max-w-6xl mx-auto w-full">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="text-slate-400 font-medium">
            Progreso de tu lista de pares
          </span>
          <span class="font-mono font-bold text-green-400">
            {{ pairsStore.stats.completed }} / {{ pairsStore.stats.total }} ({{ pairsStore.stats.percentage }}%)
          </span>
        </div>

        <!-- Barra de progreso animada -->
        <div class="w-full h-2 bg-dark-800 rounded-md overflow-hidden flex">
          <div
            class="bg-green-500 h-full transition-all duration-300"
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
          <span v-if="pairsStore.stats.archivedCount > 0" class="flex items-center gap-1 font-medium text-amber-400">
            <AppIcon name="lucide:archive" :size="12" />
            {{ pairsStore.stats.archivedCount }} archivados
          </span>
          <span v-if="pairsStore.stats.outsideSchemeCount > 0" class="flex items-center gap-1 font-medium text-rose-400">
            <AppIcon name="lucide:alert-triangle" :size="12" />
            {{ pairsStore.stats.outsideSchemeCount }} fuera de esquema
          </span>
          <span class="flex items-center gap-1 font-medium ml-auto">
            <AppIcon name="lucide:image" :size="12" class-name="text-green-400" />
            {{ pairsStore.stats.withImage }} con foto
          </span>
        </div>
      </div>
    </div>

    <!-- Filtros de búsqueda y uso -->
    <div class="p-3 border-b border-dark-900 flex flex-col gap-2.5 shrink-0 bg-dark-950">
      <div class="max-w-lg md:max-w-6xl mx-auto w-full flex flex-col gap-2.5">
      <!-- Fila Buscador y Botón de Filtros -->
      <div class="flex items-center gap-2 w-full">
        <div class="flex-1 min-w-0 transition-all duration-300">
          <AppInput
            v-model="pairsStore.searchQuery"
            placeholder="Buscar par (ej: PJ, CA) o palabra..."
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
            class="h-11 px-3 rounded-xl bg-dark-900 border border-dark-700 hover:border-green-500/70 text-slate-300 hover:text-white flex items-center justify-center transition-all duration-150 active:scale-95 shrink-0 relative shadow-sm"
            @click="showFilters = true"
          >
            <AppIcon name="lucide:sliders-horizontal" :size="18" />
            <!-- Indicador dot si hay filtros activos aplicados -->
            <span
              v-if="hasActiveFilters"
              class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 ring-2 ring-dark-950 rounded-full"
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

            <!-- Filtro de Estado (Completos, Vacíos, Archivados, Fuera de Esquema) -->
            <div class="flex items-center gap-1 bg-dark-900 p-0.5 rounded-xl border border-dark-800 shrink-0">
              <button
                v-for="st in statusFilters"
                :key="st.value"
                type="button"
                :class="[
                  'px-2 py-1 rounded-lg font-medium transition-colors text-xs flex items-center gap-1 shrink-0',
                  pairsStore.filterStatus === st.value
                    ? 'bg-dark-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200',
                ]"
                @click="pairsStore.filterStatus = st.value"
              >
                <span>{{ st.label }}</span>
                <span
                  v-if="st.badge"
                  class="text-[9px] px-1 py-0.2 rounded-full font-mono font-bold"
                  :class="st.badgeClass"
                >
                  {{ st.badge }}
                </span>
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
                  ? 'bg-green-600 text-white shadow-sm'
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
              <span v-if="hasActiveFilters" class="text-green-400 font-medium">
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
  </div>

    <!-- Contenedor con scroll para Lista o Matriz -->
    <div class="flex-1 overflow-y-auto p-3 md:p-6" @scroll="onListScroll">
      <!-- Loading State -->
      <div v-if="pairsStore.loading" class="flex items-center justify-center py-20">
        <RubikLoader label="Cargando pares de letras..." />
      </div>

      <template v-else>
        <!-- Banner de alerta si hay pares que no pertenecen al esquema actual -->
        <div
          v-if="pairsStore.pairsOutsideScheme.length > 0 && pairsStore.filterStatus !== 'archived'"
          class="max-w-lg md:max-w-6xl mx-auto w-full mb-3"
        >
          <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div class="flex items-start gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <AppIcon name="lucide:alert-triangle" :size="16" />
              </div>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="text-xs font-bold text-amber-200">
                    {{ pairsStore.pairsOutsideScheme.length }} pares no pertenecen a tu esquema actual
                  </h4>
                  <span class="text-[10px] font-mono text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                    Letras: {{ pairsStore.outsideSchemeLetters.join(', ') }}
                  </span>
                </div>
                <p class="text-[11px] text-amber-300/80 mt-1 leading-relaxed">
                  Pares con letras que no existen en tus pegatinas del cubo (como {{ pairsStore.outsideSchemeLetters.slice(0, 3).join(', ') }}). Puedes archivarlos para ocultarlos o eliminarlos.
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                class="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold border border-amber-500/30 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                @click="confirmArchiveOutside"
              >
                <AppIcon name="lucide:archive" :size="13" />
                <span>Archivar ({{ pairsStore.pairsOutsideScheme.length }})</span>
              </button>

              <button
                type="button"
                class="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                @click="confirmDeleteOutside"
              >
                <AppIcon name="lucide:trash-2" :size="13" />
                <span>Eliminar ({{ pairsStore.pairsOutsideScheme.length }})</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Banner informativo si se está filtrando por archivados -->
        <div
          v-if="pairsStore.filterStatus === 'archived'"
          class="max-w-lg md:max-w-6xl mx-auto w-full mb-3"
        >
          <div class="p-3 rounded-2xl bg-dark-900/90 border border-dark-800 flex items-center gap-2.5 text-xs text-slate-300">
            <AppIcon name="lucide:archive" :size="16" class-name="text-amber-400 shrink-0" />
            <span>
              Mostrando <strong>{{ pairsStore.filteredPairs.length }}</strong> pares archivados. No se estudian en SRS ni aparecen en la lista activa. Toca cualquier par para desarchivarlo.
            </span>
          </div>
        </div>

        <!-- VISTA LISTA: Carga incremental fluida e instantánea en cuadrícula para Desktop -->
        <div v-if="viewMode === 'list'" class="max-w-lg md:max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div
            v-for="item in displayedPairs"
            :key="item.id"
            :class="[
              'flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer active:scale-[0.99] relative overflow-hidden select-none',
              selectedPairIds.has(item.id)
                ? 'bg-green-950/40 border-2 border-green-500 shadow-lg shadow-green-500/10 ring-1 ring-green-500/40'
                : isExactPairMatch(item)
                  ? 'bg-gradient-to-r from-green-950/40 via-dark-900 to-dark-900 border-2 border-green-500/80 shadow-lg shadow-green-500/10 ring-1 ring-green-500/30'
                  : item.isArchived
                    ? 'bg-dark-900/60 border border-amber-500/25 hover:border-amber-500/50'
                    : 'bg-dark-900/90 border border-dark-800 hover:border-dark-700',
            ]"
            @click="handleCardClick(item)"
            @contextmenu="handleCardContextMenu(item, $event)"
          >
            <div class="flex items-center gap-3 min-w-0">
              <!-- Checkbox en modo selección -->
              <div
                v-if="isSelectMode"
                class="shrink-0 flex items-center justify-center transition-all"
              >
                <div
                  :class="[
                    'w-5 h-5 rounded-md border flex items-center justify-center transition-all',
                    selectedPairIds.has(item.id)
                      ? 'bg-green-500 border-green-500 text-white shadow-sm'
                      : 'border-dark-600 bg-dark-950/80 text-transparent hover:border-dark-400',
                  ]"
                >
                  <AppIcon name="lucide:check" :size="13" class-name="stroke-[3]" />
                </div>
              </div>

              <!-- Letra del Par -->
              <div
                :class="[
                  'w-12 h-12 rounded-xl flex items-center justify-center font-mono font-black text-lg shrink-0 shadow-inner transition-colors',
                  selectedPairIds.has(item.id)
                    ? 'bg-green-600 text-white shadow-green-500/30 ring-1 ring-white/20'
                    : isExactPairMatch(item)
                      ? 'bg-green-600 text-white shadow-green-500/30 ring-1 ring-white/20'
                      : item.isArchived
                        ? 'bg-dark-950 border border-amber-500/40 text-amber-200'
                        : 'bg-dark-950 border border-dark-700/80 text-white',
                ]"
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
                  <!-- Distintivo de coincidencia exacta con el par buscado -->
                  <span
                    v-if="isExactPairMatch(item)"
                    class="text-[10px] font-bold text-green-300 bg-green-500/20 px-1.5 py-0.5 rounded border border-green-500/40 shrink-0"
                  >
                    Par exacto
                  </span>

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

                <!-- Etiquetas de uso y badges de estado -->
                <div class="flex items-center gap-2 mt-1">
                  <AppBadge
                    :variant="item.usage === 'both' ? 'accent' : item.usage === 'corner' ? 'warning' : 'success'"
                    size="sm"
                  >
                    {{ item.usage === 'both' ? 'Ambas' : item.usage === 'corner' ? 'Solo Esquinas' : 'Solo Aristas' }}
                  </AppBadge>

                  <!-- Badge Destacado de Par Archivado -->
                  <span
                    v-if="item.isArchived"
                    class="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-amber-500/15 border-amber-500/40 text-amber-300 flex items-center gap-1 shrink-0"
                    title="Esta tarjeta está archivada (no se estudia en SRS)"
                  >
                    <AppIcon name="lucide:archive" :size="11" />
                    <span>Archivado</span>
                  </span>

                  <span
                    v-if="pairsStore.isPairOutsideScheme(item.id)"
                    class="px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-400 flex items-center gap-1"
                  >
                    <AppIcon name="lucide:alert-circle" :size="10" />
                    <span>Fuera de esquema</span>
                  </span>
                  <span v-if="item.notes" class="text-[11px] text-slate-400 truncate max-w-[120px]">
                    {{ item.notes }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Botón editar o indicador de selección -->
            <div class="text-slate-400 p-2 hover:text-white shrink-0">
              <AppIcon
                :name="isSelectMode ? (selectedPairIds.has(item.id) ? 'lucide:check-circle-2' : 'lucide:circle') : 'lucide:chevron-right'"
                :size="18"
                :class-name="isSelectMode && selectedPairIds.has(item.id) ? 'text-green-400' : ''"
              />
            </div>
          </div>

          <!-- Empty state si no hay resultados con opción de restablecer filtros -->
          <div
            v-if="pairsStore.filteredPairs.length === 0"
            class="col-span-full py-12 flex flex-col items-center justify-center text-center gap-3 px-4"
          >
            <div class="w-12 h-12 rounded-2xl bg-dark-900 border border-dark-800 flex items-center justify-center text-slate-500">
              <AppIcon name="lucide:search-x" :size="24" />
            </div>
            <div class="flex flex-col gap-1 max-w-sm">
              <p class="text-sm font-semibold text-slate-300">
                No se encontraron pares
              </p>
              <p v-if="hasActiveFilters" class="text-xs text-slate-500">
                Tienes filtros activos que pueden estar limitando los resultados.
              </p>
              <p v-else class="text-xs text-slate-500">
                No hay coincidencias para "{{ pairsStore.searchQuery }}".
              </p>
            </div>
            <AppButton
              v-if="hasActiveFilters"
              variant="outline"
              size="sm"
              icon="lucide:rotate-ccw"
              @click="resetFilters"
            >
              Restablecer filtros y ver todos
            </AppButton>
          </div>

          <!-- Contador de resultados o Sentinel para scroll infinito -->
          <div v-if="!isSearching" ref="sentinelRef" class="col-span-full h-8 flex items-center justify-center">
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
          <div v-else-if="pairsStore.filteredPairs.length > 0" class="col-span-full py-2 text-center text-[11px] text-slate-500 font-medium">
            Mostrando {{ pairsStore.filteredPairs.length }} par{{ pairsStore.filteredPairs.length > 1 ? 'es encontrados' : ' encontrado' }}
          </div>
        </div>

      <!-- VISTA MATRIZ -->
      <div v-else class="max-w-4xl md:max-w-6xl mx-auto w-full">
        <PairGrid
          :pairs="pairsStore.filteredPairs"
          :letters="pairsStore.availableLetters"
          @select="onOpenEdit"
        />
      </div>
    </template>
  </div>

  <!-- Barra de acciones en lote fija en la parte inferior cuando el modo selección está activo -->
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-8"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-8"
  >
    <div
      v-if="isSelectMode"
      class="shrink-0 px-3.5 py-2.5 sm:px-6 bg-dark-900/95 border-t border-dark-700/80 backdrop-blur-md shadow-2xl flex flex-wrap items-center justify-between gap-2.5 z-30"
    >
      <!-- Lado izquierdo: Contador y selección rápida -->
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="font-mono font-bold text-xs text-white bg-dark-800 border border-dark-700 px-2.5 py-1 rounded-xl shrink-0">
          {{ selectedPairIds.size }} seleccionados
        </span>
        <button
          type="button"
          class="text-xs text-green-400 hover:text-green-300 underline font-medium truncate cursor-pointer"
          @click="toggleSelectAll"
        >
          {{ isAllSelected ? 'Deseleccionar todos' : 'Seleccionar visibles' }}
        </button>
      </div>

      <!-- Lado derecho: Botones de archivar / desarchivar en lote -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Botón Archivar -->
        <AppButton
          variant="warning"
          size="sm"
          icon="lucide:archive"
          :disabled="selectedPairIds.size === 0"
          @click="handleBatchArchive(true)"
        >
          Archivar ({{ selectedActiveCount > 0 ? selectedActiveCount : selectedPairIds.size }})
        </AppButton>

        <!-- Botón Desarchivar (si hay seleccionados archivados) -->
        <AppButton
          v-if="selectedArchivedCount > 0"
          variant="secondary"
          size="sm"
          icon="lucide:archive-restore"
          @click="handleBatchArchive(false)"
        >
          Desarchivar ({{ selectedArchivedCount }})
        </AppButton>

        <!-- Cerrar modo selección -->
        <button
          type="button"
          class="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors cursor-pointer"
          title="Cerrar selección"
          @click="toggleSelectMode"
        >
          <AppIcon name="lucide:x" :size="18" />
        </button>
      </div>
    </div>
  </Transition>

  <!-- Modal de edición -->
  <PairEditModal
    v-model="showModal"
    :pair-item="editingPair"
    @deleted="() => editingPair = null"
  />
</div>
</template>
