<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import AppHeader from '@/components/ui/AppHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppModal from '@/components/ui/AppModal.vue'
import Cube3D from '@/components/scheme/Cube3D.vue'
import { useSchemeStore } from '@/stores/useSchemeStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import {
  generatePracticeSolve,
  type PracticeSolve,
} from '@/services/bldPracticeService'
import { splitPair } from '@/models/cube'
import { showConfirm } from '@/utils/alerts'

const schemeStore = useSchemeStore()
const settingsStore = useSettingsStore()

type PracticeMode = 'free' | 'test'
type TestPhase = 'memo' | 'recall' | 'result'
type TargetFilter = 'all' | 'edges' | 'corners'

const mode = ref<PracticeMode>('free')
const testPhase = ref<TestPhase>('memo')
const targetFilter = ref<TargetFilter>('all')

const solve = ref<PracticeSolve | null>(null)
const loading = ref(false)
const showMemoInFree = ref(false)
const showLettersOnCube = ref(true)
const copied = ref(false)

// Modal de preparación para iniciar modo reloj
const showReadyModal = ref(false)

// Indica si hay una resolución activa en curso (en fase memo o recall)
const isTestActive = computed(
  () => mode.value === 'test' && (testPhase.value === 'memo' || testPhase.value === 'recall'),
)

// Cronómetro de práctica
const memoStartTime = ref<number>(0)
const memoElapsedMs = ref<number>(0)
const recallStartTime = ref<number>(0)
const recallElapsedMs = ref<number>(0)
let timerInterval: number | null = null

// Respuestas del usuario en fase de evocación (recall)
const userInputText = ref('')

// Carga inicial y generación de scramble
async function loadNewScramble(customScramble?: string) {
  loading.value = true
  try {
    if (!schemeStore.currentScheme.id) {
      await schemeStore.loadScheme()
    }
    const res = await generatePracticeSolve(schemeStore.currentScheme, customScramble)
    solve.value = res
    showMemoInFree.value = false
    resetTestState()
  } catch (err) {
    console.error('Error generando práctica BLD:', err)
  } finally {
    loading.value = false
  }
}

function resetTestState() {
  testPhase.value = 'memo'
  memoElapsedMs.value = 0
  recallElapsedMs.value = 0
  userInputText.value = ''
  stopTimer()
}

function startTimer(type: 'memo' | 'recall') {
  stopTimer()
  if (type === 'memo') {
    memoStartTime.value = Date.now()
    timerInterval = window.setInterval(() => {
      memoElapsedMs.value = Date.now() - memoStartTime.value
    }, 50)
  } else {
    recallStartTime.value = Date.now()
    timerInterval = window.setInterval(() => {
      recallElapsedMs.value = Date.now() - recallStartTime.value
    }, 50)
  }
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

// Abrir modal de preparación antes de entrar a contrarreloj
function requestStartTest() {
  if (isTestActive.value) return
  showReadyModal.value = true
}

// Confirmar inicio: genera scramble NUEVO fresco y arranca la prueba
async function confirmStartTest() {
  showReadyModal.value = false
  // Generar un scramble completamente nuevo para que no venga con el del modo libre
  await loadNewScramble()
  mode.value = 'test'
  testPhase.value = 'memo'
  userInputText.value = ''
  startTimer('memo')
}

function finishMemo() {
  stopTimer()
  testPhase.value = 'recall'
  startTimer('recall')
}

function finishRecall() {
  stopTimer()
  testPhase.value = 'result'
}

// Intentar salir del modo test (bloquea si hay resolución activa)
async function handleAttemptExitTest() {
  if (!isTestActive.value) {
    exitTest()
    return
  }
  const res = await showConfirm(
    '¿Cancelar resolución?',
    'Hay una sesión contrarreloj en curso. Si vuelves al Modo Libre se perderá el tiempo y progreso actual.',
    'Sí, cancelar sesión',
    'Continuar resolviendo',
  )
  if (res.isConfirmed) {
    exitTest()
  }
}

function exitTest() {
  resetTestState()
  mode.value = 'free'
}

// Formateador de tiempo mm:ss.ms
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const tenths = Math.floor((ms % 1000) / 100)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`
}

async function copyScramble() {
  if (!solve.value?.scramble) return
  try {
    await navigator.clipboard.writeText(solve.value.scramble)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {}
}

// Lista de pares ordenada según la preferencia del usuario (aristas primero o esquinas primero)
const orderedPairs = computed(() => {
  if (!solve.value) return []
  return settingsStore.bldMemoOrder === 'corners_first'
    ? [...solve.value.cornerPairs, ...solve.value.edgePairs]
    : [...solve.value.edgePairs, ...solve.value.cornerPairs]
})

// Pares filtrados según la selección del usuario
const displayedPairs = computed(() => {
  if (!solve.value) return []
  if (targetFilter.value === 'edges') return solve.value.edgePairs
  if (targetFilter.value === 'corners') return solve.value.cornerPairs
  return orderedPairs.value
})

// Evaluación de respuestas en fase de resultados
interface EvaluationItem {
  expectedPair: string
  expectedLetters: string[]
  expectedWord?: string
  typedPair?: string
  isCorrect: boolean
  pieceType: 'edge' | 'corner'
}

const evaluation = computed(() => {
  if (!solve.value) return { items: [], correctCount: 0, total: 0, accuracy: 0 }

  // Parsear texto del usuario en pares o tokens de 2 letras
  const rawTokens = splitPair(userInputText.value.replace(/\s+/g, ''))
  const typedPairs: string[] = []
  for (let i = 0; i < rawTokens.length; i += 2) {
    typedPairs.push(rawTokens.slice(i, i + 2).join(''))
  }

  const expectedList = orderedPairs.value
  const items: EvaluationItem[] = []
  let correctCount = 0

  expectedList.forEach((exp, idx) => {
    const typed = typedPairs[idx] || ''
    const isCorrect = typed.toUpperCase() === exp.pair.toUpperCase()
    if (isCorrect) correctCount++

    items.push({
      expectedPair: exp.pair,
      expectedLetters: exp.letters,
      expectedWord: exp.word,
      typedPair: typed,
      isCorrect,
      pieceType: exp.pieceType,
    })
  })

  const total = expectedList.length
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0

  return { items, correctCount, total, accuracy }
})

// Atajo de teclado: Barra espaciadora para avanzar fases en modo test
function onKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.code === 'Space') {
    e.preventDefault()
    if (showReadyModal.value) {
      confirmStartTest()
      return
    }
    if (mode.value === 'test') {
      if (testPhase.value === 'memo') finishMemo()
      else if (testPhase.value === 'recall') finishRecall()
    }
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  await settingsStore.loadSettings()
  await loadNewScramble()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  stopTimer()
})

watch(() => schemeStore.currentScheme, () => {
  if (solve.value) {
    loadNewScramble(solve.value.scramble)
  }
})
</script>

<template>
  <div class="flex flex-col flex-1 h-full min-h-0 bg-dark-950 text-slate-100 overflow-y-auto pb-20 select-none">
    <!-- Header principal -->
    <AppHeader
      title="Práctica BLD"
      subtitle="Generador de scrambles y entrenamiento de memorización"
    >
      <template #actions>
        <AppButton
          variant="secondary"
          size="sm"
          icon="lucide:refresh-cw"
          :loading="loading"
          :disabled="isTestActive"
          :title="isTestActive ? 'No disponible durante una resolución en curso' : 'Generar nuevo scramble'"
          @click="loadNewScramble()"
        >
          Nuevo
        </AppButton>
      </template>
    </AppHeader>

    <div class="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-5 py-4 space-y-4">
      <!-- Barra de modos: Libre vs Test (Grid 50/50 protegido durante resolución) -->
      <div class="grid grid-cols-2 gap-1.5 bg-dark-900 border border-dark-800 p-1.5 rounded-2xl shadow-sm">
        <button
          type="button"
          :class="[
            'py-2 px-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap min-h-[42px]',
            mode === 'free'
              ? 'bg-green-600 text-white shadow-md shadow-green-600/30'
              : (isTestActive
                  ? 'text-slate-400 hover:text-slate-200 bg-dark-950/40 border border-dark-800/60'
                  : 'text-slate-400 hover:text-white'),
          ]"
          :title="isTestActive ? 'Resolución en curso (pulsa para cancelar)' : 'Modo Libre'"
          @click="handleAttemptExitTest"
        >
          <AppIcon
            :name="isTestActive ? 'lucide:lock' : 'lucide:eye'"
            :size="15"
            :class-name="isTestActive ? 'text-amber-400 shrink-0' : 'shrink-0'"
          />
          <span>Modo Libre</span>
        </button>

        <button
          type="button"
          :class="[
            'py-2 px-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap min-h-[42px]',
            mode === 'test'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'text-slate-400 hover:text-white',
          ]"
          :title="isTestActive ? 'Resolución contrarreloj en curso' : 'Iniciar Modo Contrarreloj'"
          @click="requestStartTest"
        >
          <AppIcon name="lucide:timer" :size="16" class-name="shrink-0" />
          <span>{{ isTestActive ? 'En Curso' : 'Contrarreloj' }}</span>
        </button>
      </div>

      <!-- Selector compacto de Orden de Memorización (bloqueado durante resolución) -->
      <div
        class="flex items-center justify-between gap-2 bg-dark-900/90 border border-dark-800/80 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl shadow-sm transition-opacity"
        :class="isTestActive ? 'opacity-50 pointer-events-none' : ''"
      >
        <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-300 shrink-0">
          <AppIcon name="lucide:arrow-right-left" :size="13" class-name="text-green-400 shrink-0" />
          <span class="hidden sm:inline">Orden de memo:</span>
          <span class="sm:hidden">Orden:</span>
        </div>

        <div class="grid grid-cols-2 gap-1 bg-dark-950 p-1 rounded-xl border border-dark-800/80">
          <button
            type="button"
            :class="[
              'px-2 py-1 rounded-lg text-xs font-bold transition-all text-center whitespace-nowrap',
              settingsStore.bldMemoOrder === 'edges_first'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white',
            ]"
            @click="settingsStore.setBldMemoOrder('edges_first')"
          >
            <span class="hidden sm:inline">Aristas → Esquinas</span>
            <span class="sm:hidden">Aristas 1º</span>
          </button>
          <button
            type="button"
            :class="[
              'px-2 py-1 rounded-lg text-xs font-bold transition-all text-center whitespace-nowrap',
              settingsStore.bldMemoOrder === 'corners_first'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white',
            ]"
            @click="settingsStore.setBldMemoOrder('corners_first')"
          >
            <span class="hidden sm:inline">Esquinas → Aristas</span>
            <span class="sm:hidden">Esquinas 1º</span>
          </button>
        </div>
      </div>

      <!-- Tarjeta del Scramble -->
      <div class="bg-dark-900/90 border border-dark-800/80 rounded-2xl p-3 sm:p-4 shadow-lg backdrop-blur-sm relative">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Scramble 3x3</span>
            <AppBadge v-if="solve?.hasParity" variant="warning" size="sm">
              Paridad
            </AppBadge>
            <AppBadge v-else variant="neutral" size="sm">
              Sin paridad
            </AppBadge>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              class="p-1.5 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors flex items-center gap-1 text-xs"
              title="Copiar scramble"
              @click="copyScramble"
            >
              <AppIcon :name="copied ? 'lucide:check' : 'lucide:copy'" :size="14" :class-name="copied ? 'text-green-400' : ''" />
              <span>{{ copied ? 'Copiado' : 'Copiar' }}</span>
            </button>
          </div>
        </div>

        <!-- Texto del scramble -->
        <p class="font-mono text-sm sm:text-base font-semibold text-green-300 leading-relaxed tracking-wide select-all break-words">
          {{ solve?.scramble || 'Generando...' }}
        </p>
      </div>

      <!-- ============================================== -->
      <!-- VISTA MODO LIBRE / ANÁLISIS                   -->
      <!-- ============================================== -->
      <template v-if="mode === 'free'">
        <!-- Visualizador 3D interactivo con estado mezclado real -->
        <div class="space-y-2">
          <div class="flex items-center justify-between px-1">
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cubo 3D Mezclado</span>
            <label class="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input
                v-model="showLettersOnCube"
                type="checkbox"
                class="rounded bg-dark-800 border-dark-700 text-green-600 focus:ring-green-500/30"
              />
              <span>Mostrar esquema</span>
            </label>
          </div>

          <Cube3D
            :scheme="schemeStore.currentScheme"
            :cube-string="solve?.cubeString"
            :letter-at-position="solve?.letterAtPosition"
            :show-letters="showLettersOnCube"
            :compact="true"
            :editable="false"
          />
        </div>

        <!-- Sección de Memorización (Revelable) -->
        <div class="bg-dark-900/90 border border-dark-800/80 rounded-2xl p-4 shadow-lg space-y-4">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <AppIcon name="lucide:brain" :size="20" class-name="text-green-400" />
              <h2 class="text-sm font-bold text-white uppercase tracking-wider">Trazado de Memorización</h2>
            </div>

            <!-- Filtros Todo / Aristas / Esquinas (Adaptativo en móvil) -->
            <div class="w-full sm:w-auto grid grid-cols-3 sm:flex items-center gap-1 bg-dark-950 p-1 rounded-xl border border-dark-800 text-xs">
              <button
                type="button"
                :class="[
                  'py-1.5 sm:px-2.5 rounded-lg font-semibold transition-colors text-center truncate',
                  targetFilter === 'all' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white',
                ]"
                @click="targetFilter = 'all'"
              >
                Todo
              </button>
              <button
                type="button"
                :class="[
                  'py-1.5 sm:px-2.5 rounded-lg font-semibold transition-colors text-center truncate',
                  targetFilter === 'edges' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white',
                ]"
                @click="targetFilter = 'edges'"
              >
                Aristas ({{ solve?.edgePairs.length || 0 }})
              </button>
              <button
                type="button"
                :class="[
                  'py-1.5 sm:px-2.5 rounded-lg font-semibold transition-colors text-center truncate',
                  targetFilter === 'corners' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white',
                ]"
                @click="targetFilter = 'corners'"
              >
                Esquinas ({{ solve?.cornerPairs.length || 0 }})
              </button>
            </div>
          </div>

          <!-- Botón para revelar / ocultar la memo -->
          <div class="flex justify-center">
            <AppButton
              variant="outline"
              size="sm"
              :icon="showMemoInFree ? 'lucide:eye-off' : 'lucide:eye'"
              @click="showMemoInFree = !showMemoInFree"
            >
              {{ showMemoInFree ? 'Ocultar memorización' : 'Revelar memorización y palabras' }}
            </AppButton>
          </div>

          <!-- Contenido de los pares (cuando está visible) -->
          <div v-if="showMemoInFree" class="space-y-4 pt-2">
            <div v-if="displayedPairs.length === 0" class="text-center py-6 text-slate-500 text-sm">
              No hay targets en esta sección (el cubo ya está resuelto en estas piezas).
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              <div
                v-for="(item, idx) in displayedPairs"
                :key="`${item.pieceType}-${item.pair}-${idx}`"
                class="bg-dark-950/80 border border-dark-800 rounded-xl p-2.5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm"
              >
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-[10px] font-mono text-slate-400 font-bold">#{{ idx + 1 }}</span>
                  <span
                    class="text-[9px] uppercase px-1.5 py-0.5 rounded font-extrabold"
                    :class="item.pieceType === 'edge' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-purple-500/20 text-purple-300'"
                  >
                    {{ item.pieceType === 'edge' ? 'Arista' : 'Esquina' }}
                  </span>
                </div>

                <!-- Par de letras -->
                <div class="text-center my-1">
                  <span class="text-xl sm:text-2xl font-black font-mono tracking-widest text-green-400">
                    {{ item.pair }}
                  </span>
                </div>

                <!-- Palabra mnemotécnica del usuario -->
                <div class="text-center pt-1 border-t border-dark-800/80 min-h-[22px]">
                  <span v-if="item.word" class="text-xs font-semibold text-slate-200">
                    {{ item.word }}
                  </span>
                  <span v-else class="text-[10px] text-slate-500 italic">
                    Sin palabra
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ============================================== -->
      <!-- VISTA MODO TEST (CONTRARRELOJ)                 -->
      <!-- ============================================== -->
      <template v-else>
        <!-- FASE 1: MEMORIZACIÓN -->
        <div v-if="testPhase === 'memo'" class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-2xl text-center space-y-5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-amber-400">Fase 1: Memorización</span>
            <AppButton variant="ghost" size="sm" icon="lucide:x" @click="handleAttemptExitTest">
              Cancelar
            </AppButton>
          </div>

          <!-- Cronómetro grande -->
          <div class="py-2">
            <div class="text-4xl sm:text-6xl font-mono font-black text-amber-300 tracking-wider">
              {{ formatTime(memoElapsedMs) }}
            </div>
            <p class="text-xs text-slate-400 mt-1">Memoriza el cubo con la vista 3D o con tu cubo físico</p>
          </div>

          <!-- Cubo 3D mezclado (sin letras para simular competencia real) -->
          <Cube3D
            :scheme="schemeStore.currentScheme"
            :cube-string="solve?.cubeString"
            :letter-at-position="solve?.letterAtPosition"
            :show-letters="false"
            :compact="true"
            :editable="false"
          />

          <!-- Botón de acción con pulgar -->
          <AppButton
            variant="primary"
            size="lg"
            class="w-full py-4 text-base font-bold shadow-xl shadow-green-600/30"
            icon="lucide:check-circle"
            @click="finishMemo"
          >
            ¡Listo, memorizado! (Espacio)
          </AppButton>
        </div>

        <!-- FASE 2: EVOCACIÓN (RECALL) -->
        <div v-else-if="testPhase === 'recall'" class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-2xl text-center space-y-5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-purple-400">Fase 2: Evocación (Ojos Vendados)</span>
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono text-slate-400">Memo: {{ formatTime(memoElapsedMs) }}</span>
              <AppButton variant="ghost" size="sm" icon="lucide:x" @click="handleAttemptExitTest">
                Cancelar
              </AppButton>
            </div>
          </div>

          <div class="py-2">
            <div class="text-4xl sm:text-6xl font-mono font-black text-purple-300 tracking-wider">
              {{ formatTime(recallElapsedMs) }}
            </div>
            <p class="text-xs text-slate-400 mt-1">Escribe los pares de letras que memorizaste</p>
          </div>

          <!-- Campo para escribir las respuestas -->
          <div class="text-left space-y-1.5">
            <div class="flex items-center justify-between flex-wrap gap-1">
              <label class="text-xs font-semibold text-slate-300">Tus pares de letras memorizados:</label>
              <span
                class="text-[10px] font-bold px-2 py-0.5 rounded-md"
                :class="settingsStore.bldMemoOrder === 'corners_first' ? 'bg-purple-950 text-purple-300 border border-purple-800/60' : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'"
              >
                Orden: {{ settingsStore.bldMemoOrder === 'corners_first' ? 'Esquinas → Aristas' : 'Aristas → Esquinas' }}
              </span>
            </div>
            <textarea
              v-model="userInputText"
              rows="3"
              :placeholder="settingsStore.bldMemoOrder === 'corners_first' ? 'Ejemplo: [Esquinas...] [Aristas...]' : 'Ejemplo: [Aristas...] [Esquinas...]'"
              class="w-full bg-dark-950 border border-dark-700 rounded-2xl p-3 font-mono text-lg text-green-300 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500/50"
              autofocus
            />
            <p class="text-[11px] text-slate-500">
              Escribe primero las {{ settingsStore.bldMemoOrder === 'corners_first' ? 'esquinas y luego las aristas' : 'aristas y luego las esquinas' }}, separados por espacio o todos juntos.
            </p>
          </div>

          <AppButton
            variant="success"
            size="lg"
            class="w-full py-4 text-base font-bold"
            icon="lucide:check"
            @click="finishRecall"
          >
            Comprobar Respuestas
          </AppButton>
        </div>

        <!-- FASE 3: RESULTADOS -->
        <div v-else-if="testPhase === 'result'" class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-2xl space-y-6">
          <div class="flex items-center justify-between flex-wrap gap-2 border-b border-dark-800 pb-3">
            <div>
              <h3 class="text-base sm:text-lg font-bold text-white">Resultados de la Sesión</h3>
              <p class="text-xs text-slate-400">Resumen de precisión y tiempos de resolución</p>
            </div>
            <AppButton variant="secondary" size="sm" icon="lucide:rotate-ccw" @click="loadNewScramble()">
              Nuevo Scramble
            </AppButton>
          </div>

          <!-- Métricas de la sesión -->
          <div class="grid grid-cols-3 gap-2 sm:gap-3 text-center">
            <div class="bg-dark-950 border border-dark-800 p-2.5 sm:p-3 rounded-2xl">
              <span class="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold block">Aciertos</span>
              <span class="text-xl sm:text-2xl font-black text-green-400">
                {{ evaluation.correctCount }}/{{ evaluation.total }}
              </span>
              <span class="text-[11px] sm:text-xs text-slate-500 block mt-0.5">{{ evaluation.accuracy }}%</span>
            </div>

            <div class="bg-dark-950 border border-dark-800 p-2.5 sm:p-3 rounded-2xl">
              <span class="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold block">Tiempo Memo</span>
              <span class="text-base sm:text-2xl font-mono font-bold text-amber-300">
                {{ formatTime(memoElapsedMs) }}
              </span>
            </div>

            <div class="bg-dark-950 border border-dark-800 p-2.5 sm:p-3 rounded-2xl">
              <span class="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold block">Tiempo Recall</span>
              <span class="text-base sm:text-2xl font-mono font-bold text-purple-300">
                {{ formatTime(recallElapsedMs) }}
              </span>
            </div>
          </div>

          <!-- Comparativa de pares esperados vs escritos -->
          <div class="space-y-2">
            <div class="flex items-center justify-between flex-wrap gap-1.5">
              <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Comparativa de Pares</h4>
              <span
                class="text-[10px] font-bold px-2 py-0.5 rounded-md"
                :class="settingsStore.bldMemoOrder === 'corners_first' ? 'bg-purple-950 text-purple-300 border border-purple-800/60' : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'"
              >
                <span class="hidden sm:inline">Evaluado en orden: </span>{{ settingsStore.bldMemoOrder === 'corners_first' ? 'Esquinas → Aristas' : 'Aristas → Esquinas' }}
              </span>
            </div>
            <div class="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              <div
                v-for="(item, idx) in evaluation.items"
                :key="idx"
                :class="[
                  'flex items-center justify-between p-2.5 sm:p-3 rounded-xl border text-sm gap-2',
                  item.isCorrect
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/20 border-rose-500/40 text-rose-200',
                ]"
              >
                <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span class="font-mono text-xs text-slate-500 font-bold shrink-0">#{{ idx + 1 }}</span>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 sm:gap-2">
                      <span class="font-mono font-black text-sm sm:text-base tracking-wider shrink-0">{{ item.expectedPair }}</span>
                      <span v-if="item.expectedWord" class="text-xs text-slate-400 truncate">({{ item.expectedWord }})</span>
                    </div>
                    <span class="text-[10px] text-slate-500 uppercase">{{ item.pieceType === 'edge' ? 'Arista' : 'Esquina' }}</span>
                  </div>
                </div>

                <div class="text-right shrink-0">
                  <div class="flex items-center gap-1 sm:gap-1.5 font-mono text-xs sm:text-sm font-bold">
                    <span class="hidden sm:inline">Escribiste:</span>
                    <span :class="item.isCorrect ? 'text-emerald-400' : 'text-rose-400'">
                      {{ item.typedPair || '—' }}
                    </span>
                    <AppIcon
                      :name="item.isCorrect ? 'lucide:check-circle-2' : 'lucide:x-circle'"
                      :size="15"
                      :class-name="item.isCorrect ? 'text-emerald-400' : 'text-rose-400'"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Botones de salida -->
          <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-dark-800">
            <AppButton variant="secondary" size="md" class="w-full sm:w-auto" @click="exitTest">
              Volver al modo libre
            </AppButton>
            <AppButton variant="primary" size="md" icon="lucide:play" class="w-full sm:w-auto" @click="requestStartTest">
              Repetir con nuevo scramble
            </AppButton>
          </div>
        </div>
      </template>
    </div>

    <!-- Modal: ¿Preparado para iniciar? (Modo Contrarreloj) -->
    <AppModal
      v-model="showReadyModal"
      title="¿Preparado para iniciar?"
      subtitle="Modo Contrarreloj 3x3 BLD"
      max-width="md"
    >
      <div class="space-y-4 py-1 text-slate-200">
        <!-- Banner informativo con scramble nuevo -->
        <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
          <div class="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
            <AppIcon name="lucide:timer" :size="20" />
          </div>
          <div class="space-y-1 text-xs sm:text-sm">
            <p class="font-bold text-amber-200">Prueba cronometrada a ciegas</p>
            <p class="text-slate-400 leading-relaxed text-xs">
              Al comenzar se generará automáticamente un <span class="text-amber-300 font-semibold">nuevo scramble</span> y se iniciará el cronómetro de memorización.
            </p>
          </div>
        </div>

        <!-- Fases de la prueba -->
        <div class="space-y-2.5 text-xs bg-dark-950 p-3.5 rounded-2xl border border-dark-800">
          <div class="flex items-start gap-2.5">
            <span class="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
            <div>
              <p class="font-bold text-slate-200">Fase 1: Memorización (Cronometrada)</p>
              <p class="text-slate-400 text-[11px]">Memoriza usando el visor 3D o aplicando la mezcla a tu cubo real.</p>
            </div>
          </div>

          <div class="flex items-start gap-2.5">
            <span class="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
            <div>
              <p class="font-bold text-slate-200">Fase 2: Evocación a Ciegas</p>
              <p class="text-slate-400 text-[11px]">Escribe tus pares de letras memorizados sin ver el cubo.</p>
            </div>
          </div>

          <div class="flex items-start gap-2.5">
            <span class="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
            <div>
              <p class="font-bold text-slate-200">Fase 3: Resultados y Evaluación</p>
              <p class="text-slate-400 text-[11px]">Comprobación automática de aciertos, orden y tiempos.</p>
            </div>
          </div>
        </div>

        <!-- Orden de memo activo -->
        <div class="flex items-center justify-between text-xs bg-dark-950/80 px-3 py-2.5 rounded-xl border border-dark-800">
          <span class="text-slate-400">Orden de memorización:</span>
          <span
            class="font-bold px-2 py-0.5 rounded-md text-[11px]"
            :class="settingsStore.bldMemoOrder === 'corners_first' ? 'bg-purple-950 text-purple-300 border border-purple-800/60' : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'"
          >
            {{ settingsStore.bldMemoOrder === 'corners_first' ? 'Esquinas → Aristas' : 'Aristas → Esquinas' }}
          </span>
        </div>

        <!-- Indicador de bloqueo -->
        <p class="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5 pt-0.5">
          <AppIcon name="lucide:lock" :size="13" class-name="text-amber-400 shrink-0" />
          <span>El modo permanecerá protegido hasta terminar o cancelar la resolución.</span>
        </p>

        <!-- Botones de acción -->
        <div class="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-dark-800">
          <AppButton
            variant="secondary"
            size="md"
            class="w-full sm:w-1/3 order-2 sm:order-1"
            @click="showReadyModal = false"
          >
            Cancelar
          </AppButton>
          <AppButton
            variant="primary"
            size="md"
            icon="lucide:play"
            :loading="loading"
            class="w-full sm:w-2/3 order-1 sm:order-2 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-lg shadow-amber-600/25"
            @click="confirmStartTest"
          >
            Comenzar ahora (Espacio)
          </AppButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>
