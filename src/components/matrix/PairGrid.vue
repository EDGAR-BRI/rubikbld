<script setup lang="ts">
import { computed } from 'vue'
import type { PairItem } from '@/models/pair'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = defineProps<{
  pairs: PairItem[]
  letters: string[]
}>()

const emit = defineEmits<{
  (e: 'select', pair: PairItem): void
}>()

// Mapa para acceso O(1): "LETRA_A:LETRA_B" -> PairItem
const pairsMap = computed(() => {
  const map = new Map<string, PairItem>()
  for (const p of props.pairs) {
    map.set(`${p.firstLetter}:${p.secondLetter}`, p)
  }
  return map
})

function getPair(r: string, c: string): PairItem | undefined {
  return pairsMap.value.get(`${r}:${c}`)
}
</script>

<template>
  <div class="w-full flex flex-col gap-2.5 pb-4">
    <!-- Leyenda de etiquetas de uso -->
    <div class="flex items-center justify-between px-2 text-[11px] text-slate-400">
      <div class="flex items-center gap-3">
        <span class="flex items-center gap-1 font-medium">
          <span class="w-2 h-2 rounded-full bg-purple-400" />
          Ambas
        </span>
        <span class="flex items-center gap-1 font-medium">
          <span class="w-2 h-2 rounded-full bg-amber-400" />
          Solo Esquinas
        </span>
        <span class="flex items-center gap-1 font-medium">
          <span class="w-2 h-2 rounded-full bg-emerald-400" />
          Solo Aristas
        </span>
      </div>
      <span class="text-slate-500 hidden sm:inline">
        Toca cualquier celda para editar palabra e imagen
      </span>
    </div>

    <!-- Tabla Matriz -->
    <div class="w-full overflow-x-auto pb-2">
      <div class="inline-block min-w-full align-middle">
        <div class="border border-dark-700/80 rounded-2xl overflow-hidden bg-dark-950/60 shadow-xl">
          <table class="border-collapse text-center">
            <thead>
              <tr class="bg-dark-900 border-b border-dark-700">
                <!-- Esquina superior izquierda -->
                <th class="p-2 text-xs font-mono font-bold text-slate-400 sticky left-0 z-20 bg-dark-900 border-r border-dark-700 w-10">
                  \
                </th>
                <!-- Letras de columnas (Segunda letra) -->
                <th
                  v-for="colLetter in letters"
                  :key="colLetter"
                  class="p-2 text-xs font-mono font-bold text-green-400 min-w-[54px] border-r border-dark-800"
                >
                  {{ colLetter }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="rowLetter in letters"
                :key="rowLetter"
                class="border-b border-dark-800/60 hover:bg-dark-900/40 transition-colors"
              >
                <!-- Letra de fila (Primera letra) -->
                <td
                  class="p-2 text-xs font-mono font-bold text-green-400 sticky left-0 z-10 bg-dark-900 border-r border-dark-700"
                >
                  {{ rowLetter }}
                </td>

                <!-- Celdas de pares -->
                <td
                  v-for="colLetter in letters"
                  :key="colLetter"
                  class="p-1 border-r border-dark-800/60"
                >
                  <template v-if="rowLetter === colLetter">
                    <!-- Misma letra no permitida en BLD -->
                    <div class="w-full h-11 bg-dark-950/40 rounded-lg flex items-center justify-center text-slate-700 text-xs select-none">
                      -
                    </div>
                  </template>

                  <template v-else-if="getPair(rowLetter, colLetter)">
                    <button
                      type="button"
                      :class="[
                        'w-full h-11 rounded-lg px-1 flex flex-col items-center justify-center transition-all select-none active:scale-95 border relative group',
                        getPair(rowLetter, colLetter)!.word.trim().length > 0
                          ? 'bg-green-950/40 hover:bg-green-900/50 border-green-500/30 text-green-200'
                          : 'bg-dark-900/60 hover:bg-dark-800 border-dark-800 text-slate-500',
                      ]"
                      @click="emit('select', getPair(rowLetter, colLetter)!)"
                    >
                      <div class="flex items-center gap-1">
                        <span class="text-[11px] font-mono font-bold tracking-tight">
                          {{ rowLetter }}{{ colLetter }}
                        </span>
                        <!-- Indicador de uso: Ambas (morado), Esquina (ámbar), Arista (verde) -->
                        <span
                          :class="[
                            'w-1.5 h-1.5 rounded-full shrink-0',
                            getPair(rowLetter, colLetter)!.usage === 'both'
                              ? 'bg-purple-400'
                              : getPair(rowLetter, colLetter)!.usage === 'corner'
                                ? 'bg-amber-400'
                                : 'bg-emerald-400',
                          ]"
                          :title="
                            getPair(rowLetter, colLetter)!.usage === 'both'
                              ? 'Ambas (Esquinas y Aristas)'
                              : getPair(rowLetter, colLetter)!.usage === 'corner'
                                ? 'Solo Esquinas'
                                : 'Solo Aristas'
                          "
                        />
                      </div>

                      <span
                        v-if="getPair(rowLetter, colLetter)!.word"
                        class="text-[9px] text-slate-300 font-medium truncate max-w-[46px] leading-tight mt-0.5"
                      >
                        {{ getPair(rowLetter, colLetter)!.word }}
                      </span>
                      <span v-else class="text-[8px] text-slate-600 leading-tight mt-0.5">
                        vacío
                      </span>
                    </button>
                  </template>

                  <template v-else>
                    <!-- Bloqueado por misma pieza física o buffer -->
                    <div
                      class="w-full h-11 bg-dark-950/80 rounded-lg flex items-center justify-center text-dark-700 text-[10px] select-none"
                      title="Imposible físicamente o buffer"
                    >
                      <AppIcon name="lucide:ban" :size="12" class-name="opacity-40" />
                    </div>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
