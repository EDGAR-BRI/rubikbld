import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/db'
import type { ReviewRating, SRSCard, ReviewLog } from '@/models/card'
import type { PairItem } from '@/models/pair'
import { calculateNextInterval } from '@/srs/algorithm'
import { useSettingsStore } from './useSettingsStore'
import { usePairsStore } from './usePairsStore'

export const useReviewStore = defineStore('review', () => {
  const settingsStore = useSettingsStore()
  const pairsStore = usePairsStore()

  const loading = ref(false)
  const filterType = ref<'all' | 'corner' | 'edge'>('all')

  // Colas de tarjetas
  const newQueue = ref<SRSCard[]>([])
  const learningQueue = ref<SRSCard[]>([])
  const dueQueue = ref<SRSCard[]>([])

  // Estado del repaso actual
  const currentCard = ref<SRSCard | null>(null)
  const isFlipped = ref(false)
  const reviewStartTime = ref(Date.now())

  // Métricas de la sesión actual
  const sessionStats = ref({
    reviewedCount: 0,
    againCount: 0,
    hardCount: 0,
    goodCount: 0,
    easyCount: 0,
  })

  // Tarjeta actual como objeto PairItem completo (con palabra e imagen)
  const currentPair = computed<PairItem | null>(() => {
    if (!currentCard.value) return null
    return pairsStore.getPairById(currentCard.value.id) || null
  })

  // Conteo de tarjetas pendientes
  const queueCounts = computed(() => ({
    new: newQueue.value.length,
    learning: learningQueue.value.length,
    due: dueQueue.value.length,
    total: newQueue.value.length + learningQueue.value.length + dueQueue.value.length,
  }))

  // Previsualizaciones de los botones de calificación (ej: "1m", "10m", "1d", "4d")
  const buttonIntervals = computed(() => {
    if (!currentCard.value) {
      return { 1: '< 1m', 2: '< 10m', 3: '1d', 4: '4d' }
    }
    const card = currentCard.value
    const srs = settingsStore.srsSettings
    return {
      1: calculateNextInterval(card, 1, srs).label,
      2: calculateNextInterval(card, 2, srs).label,
      3: calculateNextInterval(card, 3, srs).label,
      4: calculateNextInterval(card, 4, srs).label,
    }
  })

  async function loadReviewSession() {
    loading.value = true
    try {
      await pairsStore.loadPairs()
      const allCards = await db.cards.toArray()
      const now = Date.now()

      // Filtrar por pares completados si la configuración lo exige
      const validPairIds = new Set(
        pairsStore.pairs
          .filter(p => !settingsStore.practiceOnlyCompleted || p.word.trim().length > 0)
          .map(p => p.id),
      )

      let candidateCards = allCards.filter(c => validPairIds.has(c.id))

      if (filterType.value !== 'all') {
        candidateCards = candidateCards.filter(c =>
          filterType.value === 'corner'
            ? c.usage === 'corner' || c.usage === 'both'
            : c.usage === 'edge' || c.usage === 'both',
        )
      }

      // Separar por tipo de cola
      const due: SRSCard[] = []
      const learning: SRSCard[] = []
      const news: SRSCard[] = []

      for (const card of candidateCards) {
        if (card.state === 'learning' || card.state === 'relearning') {
          learning.push(card)
        } else if (card.state === 'review') {
          if (card.due <= now) due.push(card)
        } else if (card.state === 'new') {
          news.push(card)
        }
      }

      // Ordenar por vencimiento
      due.sort((a, b) => a.due - b.due)
      learning.sort((a, b) => a.due - b.due)

      // Limitar tarjetas nuevas según ajuste
      const maxNew = settingsStore.srsSettings.newCardsPerDay
      newQueue.value = news.slice(0, maxNew)
      dueQueue.value = due
      learningQueue.value = learning

      nextCard()
    } finally {
      loading.value = false
    }
  }

  function nextCard() {
    isFlipped.value = false
    reviewStartTime.value = Date.now()

    // Prioridad de Anki: Learning vencidas > Due > New > Learning no vencidas
    const now = Date.now()
    const readyLearningIdx = learningQueue.value.findIndex(c => c.due <= now)

    if (readyLearningIdx !== -1) {
      currentCard.value = learningQueue.value.splice(readyLearningIdx, 1)[0]
    } else if (dueQueue.value.length > 0) {
      currentCard.value = dueQueue.value.shift() || null
    } else if (newQueue.value.length > 0) {
      currentCard.value = newQueue.value.shift() || null
    } else if (learningQueue.value.length > 0) {
      // Si solo quedan tarjetas de aprendizaje en espera de pocos minutos, las tomamos
      currentCard.value = learningQueue.value.shift() || null
    } else {
      currentCard.value = null
    }
  }

  function flip() {
    isFlipped.value = true
  }

  async function rate(rating: ReviewRating) {
    if (!currentCard.value) return

    const card = currentCard.value
    const now = Date.now()
    const timeSpentMs = now - reviewStartTime.value
    const srs = settingsStore.srsSettings

    const next = calculateNextInterval(card, rating, srs, now)

    // Registrar en el log de repasos
    const log: ReviewLog = {
      cardId: card.id,
      pair: card.pair,
      pieceType: card.usage,
      rating,
      stateBefore: card.state,
      stateAfter: next.nextState,
      intervalBefore: card.interval,
      intervalAfter: next.nextInterval,
      easeFactorBefore: card.easeFactor,
      easeFactorAfter: next.nextEase,
      timeSpentMs,
      timestamp: now,
    }
    await db.reviews.add(log)

    // Actualizar objeto de tarjeta
    const updatedCard: SRSCard = {
      ...card,
      state: next.nextState,
      due: next.nextDue,
      interval: next.nextInterval,
      easeFactor: next.nextEase,
      stepIndex: next.nextStepIndex,
      repetitions: rating >= 3 ? card.repetitions + 1 : 0,
      lapses: rating === 1 && card.state === 'review' ? card.lapses + 1 : card.lapses,
      lastReviewed: now,
    }

    await db.cards.put(updatedCard)

    // Actualizar métricas de sesión
    sessionStats.value.reviewedCount += 1
    if (rating === 1) sessionStats.value.againCount += 1
    if (rating === 2) sessionStats.value.hardCount += 1
    if (rating === 3) sessionStats.value.goodCount += 1
    if (rating === 4) sessionStats.value.easyCount += 1

    // Si la tarjeta sigue en fase de aprendizaje, volver a encolarla en learning
    if (next.nextState === 'learning' || next.nextState === 'relearning') {
      learningQueue.value.push(updatedCard)
    }

    nextCard()
  }

  return {
    loading,
    filterType,
    currentCard,
    currentPair,
    isFlipped,
    sessionStats,
    queueCounts,
    buttonIntervals,
    loadReviewSession,
    flip,
    rate,
  }
})
