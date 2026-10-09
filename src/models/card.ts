import type { PairUsage } from './pair'

// Modelo de Repetición Espaciada (SRS estilo Anki / SM-2)

export type SRSState = 'new' | 'learning' | 'review' | 'relearning'

export interface SRSCard {
  id: string // Coincide con pair (ej: "PJ")
  pair: string // "PJ"
  usage: PairUsage // 'both' | 'corner' | 'edge'
  state: SRSState
  
  // Parámetros de intervalos Anki / SM-2
  due: number // Timestamp (ms) en que la tarjeta vence / toca repasar
  interval: number // Intervalo en días (0 mientras está en aprendizaje)
  easeFactor: number // Factor de facilidad (inicial 2.5, min 1.3)
  stepIndex: number // Paso en la fase de aprendizaje (ej: 0 = 1m, 1 = 10m)
  repetitions: number // Repasos consecutivos exitosos
  lapses: number // Cantidad de veces que se ha olvidado (Again en estado review)
  
  lastReviewed?: number
  createdAt: number
  isArchived?: boolean // Si está archivada, se excluye de las sesiones de estudio
}

export type ReviewRating = 1 | 2 | 3 | 4 // 1: Again, 2: Hard, 3: Good, 4: Easy

export interface ReviewLog {
  id?: number
  cardId: string
  pair: string
  pieceType: string
  rating: ReviewRating
  stateBefore: SRSState
  stateAfter: SRSState
  intervalBefore: number
  intervalAfter: number
  easeFactorBefore: number
  easeFactorAfter: number
  timeSpentMs: number // Tiempo que tardó el usuario en voltear/responder
  timestamp: number
}

export interface SRSSettings {
  newCardsPerDay: number // ej. 15
  maxReviewsPerDay: number // ej. 100
  learningStepsMinutes: number[] // ej. [1, 10]
  graduatingIntervalDays: number // ej. 1
  easyIntervalDays: number // ej. 4
  startingEase: number // ej. 2.5
  easyBonus: number // ej. 1.3
  intervalModifier: number // ej. 1.0
  minimumEase: number // ej. 1.3
}

export const DEFAULT_SRS_SETTINGS: SRSSettings = {
  newCardsPerDay: 20,
  maxReviewsPerDay: 150,
  learningStepsMinutes: [1, 10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  startingEase: 2.5,
  easyBonus: 1.3,
  intervalModifier: 1.0,
  minimumEase: 1.3,
}
