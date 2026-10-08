import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/db'
import type { PairItem, PairStats, PairUsage } from '@/models/pair'

export const usePairsStore = defineStore('pairs', () => {
  const pairs = ref<PairItem[]>([])
  const loading = ref(false)

  // Filtros
  const filterUsage = ref<PairUsage | 'all'>('all')
  const filterStatus = ref<'all' | 'completed' | 'missing' | 'with_image'>('all')
  const searchQuery = ref('')
  const selectedLetter = ref<string | null>(null)

  async function loadPairs(force: boolean = false) {
    if (pairs.value.length > 0 && !force) return
    loading.value = true
    try {
      const items = await db.pairs.toArray()
      pairs.value = items
    } finally {
      loading.value = false
    }
  }

  // Estadísticas globales y por tipo
  const stats = computed<PairStats>(() => {
    let list = pairs.value
    if (filterUsage.value !== 'all') {
      list = list.filter(p => p.usage === filterUsage.value)
    }

    const total = list.length
    const completed = list.filter(p => p.word.trim().length > 0).length
    const withImage = list.filter(p => !!p.image).length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    const bothCount = pairs.value.filter(p => p.usage === 'both').length
    const cornerOnlyCount = pairs.value.filter(p => p.usage === 'corner').length
    const edgeOnlyCount = pairs.value.filter(p => p.usage === 'edge').length

    return {
      total,
      completed,
      withImage,
      percentage,
      bothCount,
      cornerOnlyCount,
      edgeOnlyCount,
    }
  })

  // Lista de todas las letras iniciales únicas presentes en los pares
  const availableLetters = computed(() => {
    let list = pairs.value
    if (filterUsage.value !== 'all') {
      list = list.filter(p => p.usage === filterUsage.value)
    }
    const set = new Set<string>()
    list.forEach(p => set.add(p.firstLetter))
    return Array.from(set).sort()
  })

  // Pares filtrados según los controles de la UI
  const filteredPairs = computed(() => {
    let result = pairs.value

    if (filterUsage.value !== 'all') {
      result = result.filter(p => p.usage === filterUsage.value)
    }

    if (filterStatus.value === 'completed') {
      result = result.filter(p => p.word.trim().length > 0)
    } else if (filterStatus.value === 'missing') {
      result = result.filter(p => p.word.trim().length === 0)
    } else if (filterStatus.value === 'with_image') {
      result = result.filter(p => !!p.image)
    }

    if (selectedLetter.value) {
      result = result.filter(p => p.firstLetter === selectedLetter.value)
    }

    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      result = result.filter(
        p => p.pair.toLowerCase().includes(q) || p.word.toLowerCase().includes(q),
      )
    }

    return result.sort((a, b) => a.pair.localeCompare(b.pair))
  })

  async function updatePair(
    id: string,
    data: { word: string; image?: string; notes?: string },
  ) {
    const idx = pairs.value.findIndex(p => p.id === id)
    if (idx === -1) return

    const updated: PairItem = {
      ...pairs.value[idx],
      word: data.word.trim(),
      image: data.image,
      notes: data.notes?.trim() || '',
      updatedAt: Date.now(),
    }

    pairs.value[idx] = updated
    await db.pairs.put(updated)
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
    loadPairs,
    updatePair,
    getPairById,
  }
})
