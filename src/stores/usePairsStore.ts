import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/db'
import type { PairItem, PairStats, PairUsage } from '@/models/pair'
import { useSchemeStore } from './useSchemeStore'
import { generateUnifiedPairs } from '@/services/pairGenerator'
import { searchAndRankPairs } from '@/services/pairSearch'

export const usePairsStore = defineStore('pairs', () => {
  const schemeStore = useSchemeStore()
  const pairs = ref<PairItem[]>([])
  const loading = ref(false)

  // Filtros
  const filterUsage = ref<PairUsage | 'all'>('all')
  const filterStatus = ref<'all' | 'active' | 'completed' | 'missing' | 'with_image' | 'archived' | 'outside_scheme'>('all')
  const searchQuery = ref('')
  const selectedLetter = ref<string | null>(null)

  async function loadPairs(force: boolean = false) {
    if (pairs.value.length > 0 && !force) return
    loading.value = true
    try {
      if (!schemeStore.currentScheme?.stickers || Object.keys(schemeStore.currentScheme.stickers).length === 0) {
        await schemeStore.loadScheme()
      }
      const items = await db.pairs.toArray()
      pairs.value = items
    } finally {
      loading.value = false
    }
  }

  // Identificadores de pares que pertenecen al esquema actualmente activo
  const validSchemePairIds = computed(() => {
    if (!schemeStore.currentScheme?.stickers) return new Set<string>()
    const valid = generateUnifiedPairs(schemeStore.currentScheme)
    return new Set(valid.map(p => p.pair))
  })

  // Lista de pares existentes que no pertenecen al esquema actual
  const pairsOutsideScheme = computed(() => {
    if (validSchemePairIds.value.size === 0) return []
    return pairs.value.filter(p => !validSchemePairIds.value.has(p.id))
  })

  // Letras individuales presentes en pares fuera de esquema
  const outsideSchemeLetters = computed(() => {
    const set = new Set<string>()
    for (const p of pairsOutsideScheme.value) {
      if (p.firstLetter) set.add(p.firstLetter)
      if (p.secondLetter) set.add(p.secondLetter)
    }
    return Array.from(set).sort()
  })

  function isPairOutsideScheme(id: string): boolean {
    if (validSchemePairIds.value.size === 0) return false
    return !validSchemePairIds.value.has(id)
  }

  // Estadísticas globales y por tipo
  const stats = computed<PairStats>(() => {
    let list = pairs.value
    if (filterUsage.value !== 'all') {
      list = list.filter(p => p.usage === filterUsage.value)
    }

    const activeList = list.filter(p => !p.isArchived)
    const total = activeList.length
    const completed = activeList.filter(p => p.word.trim().length > 0).length
    const withImage = activeList.filter(p => !!p.image).length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    const bothCount = activeList.filter(p => p.usage === 'both').length
    const cornerOnlyCount = activeList.filter(p => p.usage === 'corner').length
    const edgeOnlyCount = activeList.filter(p => p.usage === 'edge').length
    const archivedCount = list.filter(p => !!p.isArchived).length
    const outsideSchemeCount = list.filter(p => !validSchemePairIds.value.has(p.id)).length

    return {
      total,
      completed,
      withImage,
      percentage,
      bothCount,
      cornerOnlyCount,
      edgeOnlyCount,
      archivedCount,
      outsideSchemeCount,
    }
  })

  // Lista de todas las letras iniciales únicas presentes en los pares
  const availableLetters = computed(() => {
    let list = pairs.value

    if (filterStatus.value === 'archived') {
      list = list.filter(p => !!p.isArchived)
    } else if (filterStatus.value === 'outside_scheme') {
      list = list.filter(p => !validSchemePairIds.value.has(p.id))
    } else if (filterStatus.value === 'active') {
      list = list.filter(p => !p.isArchived)
    }

    if (filterUsage.value !== 'all') {
      list = list.filter(p => p.usage === filterUsage.value)
    }
    const set = new Set<string>()
    list.forEach(p => {
      if (p.firstLetter) set.add(p.firstLetter)
    })
    return Array.from(set).sort()
  })

  // Pares filtrados según los controles de la UI
  const filteredPairs = computed(() => {
    let result = pairs.value

    if (filterStatus.value === 'archived') {
      result = result.filter(p => !!p.isArchived)
    } else if (filterStatus.value === 'outside_scheme') {
      result = result.filter(p => !validSchemePairIds.value.has(p.id))
    } else if (filterStatus.value === 'active') {
      result = result.filter(p => !p.isArchived)
    } else {
      // En 'all', 'completed', 'missing' y 'with_image', mostramos los pares correspondientes.
      // Los pares archivados se identifican con su propio distintivo/badge en la lista.
      if (filterStatus.value === 'completed') {
        result = result.filter(p => p.word.trim().length > 0)
      } else if (filterStatus.value === 'missing') {
        result = result.filter(p => p.word.trim().length === 0)
      } else if (filterStatus.value === 'with_image') {
        result = result.filter(p => !!p.image)
      }
    }

    if (filterUsage.value !== 'all') {
      result = result.filter(p => p.usage === filterUsage.value)
    }

    const query = searchQuery.value.trim()

    // Si el usuario escribe una búsqueda en texto, no restringimos por letra de chip
    // para evitar que se limite o corte la búsqueda global inadvertidamente.
    if (selectedLetter.value && !query) {
      result = result.filter(p => p.firstLetter === selectedLetter.value)
    }

    if (query) {
      return searchAndRankPairs(result, query)
    }

    return result.sort((a, b) => a.pair.localeCompare(b.pair))
  })

  async function updatePair(
    id: string,
    data: { word: string; image?: string; notes?: string; isArchived?: boolean },
  ) {
    const idx = pairs.value.findIndex(p => p.id === id)
    if (idx === -1) return

    const updated: PairItem = {
      ...pairs.value[idx],
      word: data.word.trim(),
      image: data.image,
      notes: data.notes?.trim() || '',
      isArchived: data.isArchived !== undefined ? data.isArchived : (pairs.value[idx].isArchived ?? false),
      updatedAt: Date.now(),
    }

    pairs.value[idx] = updated
    await db.pairs.put(updated)

    // Si se modificó el estado archivado, sincronizar la tarjeta SRS
    if (data.isArchived !== undefined) {
      const card = await db.cards.get(id)
      if (card && card.isArchived !== data.isArchived) {
        await db.cards.put({
          ...card,
          isArchived: data.isArchived,
        })
      }
    }
  }

  async function setPairArchived(id: string, isArchived: boolean = true) {
    const idx = pairs.value.findIndex(p => p.id === id)
    if (idx !== -1) {
      pairs.value[idx] = {
        ...pairs.value[idx],
        isArchived,
        updatedAt: Date.now(),
      }
    }
    await db.setPairsArchived([id], isArchived)
  }

  async function archivePairs(ids: string[], isArchived: boolean = true) {
    const idSet = new Set(ids)
    const now = Date.now()
    pairs.value = pairs.value.map(p => {
      if (idSet.has(p.id)) {
        return {
          ...p,
          isArchived,
          updatedAt: now,
        }
      }
      return p
    })
    await db.setPairsArchived(ids, isArchived)
  }

  async function deletePair(id: string) {
    pairs.value = pairs.value.filter(p => p.id !== id)
    await db.deletePair(id)
  }

  async function deletePairs(ids: string[]) {
    const idSet = new Set(ids)
    pairs.value = pairs.value.filter(p => !idSet.has(p.id))
    await db.deletePairs(ids)
  }

  async function archiveAllOutsideScheme() {
    const ids = pairsOutsideScheme.value.map(p => p.id)
    if (ids.length > 0) {
      await archivePairs(ids, true)
    }
  }

  async function deleteAllOutsideScheme() {
    const ids = pairsOutsideScheme.value.map(p => p.id)
    if (ids.length > 0) {
      await deletePairs(ids)
    }
  }

  function getPairById(id: string): PairItem | undefined {
    return pairs.value.find(p => p.id === id)
  }

  return {
    pairs,
    loading,
    filterUsage,
    filterStatus,
    searchQuery,
    selectedLetter,
    availableLetters,
    stats,
    filteredPairs,
    validSchemePairIds,
    pairsOutsideScheme,
    outsideSchemeLetters,
    isPairOutsideScheme,
    loadPairs,
    updatePair,
    setPairArchived,
    archivePairs,
    deletePair,
    deletePairs,
    archiveAllOutsideScheme,
    deleteAllOutsideScheme,
    getPairById,
  }
})
