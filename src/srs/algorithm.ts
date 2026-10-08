// Motor de Repetición Espaciada (SRS Anki / SM-2)
import type { ReviewRating, SRSCard, SRSSettings } from '@/models/card'

export interface NextIntervalResult {
  nextDue: number
  nextInterval: number
  nextEase: number
  nextState: SRSCard['state']
  nextStepIndex: number
  label: string // Para mostrar en el botón: ej. "1 min", "10 min", "1 d", "4 d"
}

export function formatIntervalLabel(minutesOrDays: { unit: 'm' | 'd'; val: number }): string {
  if (minutesOrDays.unit === 'm') {
    if (minutesOrDays.val < 1) return '< 1m'
    return `${Math.round(minutesOrDays.val)}m`
  }
  const days = minutesOrDays.val
  if (days < 1) return '< 1d'
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${(days / 30).toFixed(1)}m`
  return `${(days / 365).toFixed(1)}a`
}

export function calculateNextInterval(
  card: SRSCard,
  rating: ReviewRating,
  settings: SRSSettings,
  now: number = Date.now(),
): NextIntervalResult {
  const steps = settings.learningStepsMinutes
  const isLearning = card.state === 'new' || card.state === 'learning' || card.state === 'relearning'

  if (isLearning) {
    switch (rating) {
      case 1: { // Again
        const stepMin = steps[0] || 1
        return {
          nextDue: now + stepMin * 60 * 1000,
          nextInterval: 0,
          nextEase: card.easeFactor,
          nextState: 'learning',
          nextStepIndex: 0,
          label: formatIntervalLabel({ unit: 'm', val: stepMin }),
        }
      }
      case 2: { // Hard
        const stepMin = steps[card.stepIndex] || steps[0] || 1
        return {
          nextDue: now + stepMin * 60 * 1000,
          nextInterval: 0,
          nextEase: card.easeFactor,
          nextState: 'learning',
          nextStepIndex: card.stepIndex,
          label: formatIntervalLabel({ unit: 'm', val: stepMin }),
        }
      }
      case 3: { // Good
        const nextStep = card.stepIndex + 1
        if (nextStep < steps.length) {
          const stepMin = steps[nextStep]
          return {
            nextDue: now + stepMin * 60 * 1000,
            nextInterval: 0,
            nextEase: card.easeFactor,
            nextState: 'learning',
            nextStepIndex: nextStep,
            label: formatIntervalLabel({ unit: 'm', val: stepMin }),
          }
        } else {
          // Gradúa a Review
          const days = settings.graduatingIntervalDays
          return {
            nextDue: now + days * 24 * 60 * 60 * 1000,
            nextInterval: days,
            nextEase: card.easeFactor,
            nextState: 'review',
            nextStepIndex: 0,
            label: formatIntervalLabel({ unit: 'd', val: days }),
          }
        }
      }
      case 4: { // Easy
        const days = settings.easyIntervalDays
        return {
          nextDue: now + days * 24 * 60 * 60 * 1000,
          nextInterval: days,
          nextEase: card.easeFactor + 0.15,
          nextState: 'review',
          nextStepIndex: 0,
          label: formatIntervalLabel({ unit: 'd', val: days }),
        }
      }
    }
  }

  // Estado: Review
  let ease = card.easeFactor
  let interval = card.interval

  switch (rating) {
    case 1: { // Again (Lapse / Olvidada)
      ease = Math.max(settings.minimumEase, ease - 0.2)
      const relearnMin = steps[0] || 10
      return {
        nextDue: now + relearnMin * 60 * 1000,
        nextInterval: 1, // Vuelve a empezar con intervalo de 1 día tras reaprender
        nextEase: ease,
        nextState: 'relearning',
        nextStepIndex: 0,
        label: formatIntervalLabel({ unit: 'm', val: relearnMin }),
      }
    }
    case 2: { // Hard
      ease = Math.max(settings.minimumEase, ease - 0.15)
      const nextDays = Math.max(interval + 1, Math.round(interval * 1.2 * settings.intervalModifier))
      return {
        nextDue: now + nextDays * 24 * 60 * 60 * 1000,
        nextInterval: nextDays,
        nextEase: ease,
        nextState: 'review',
        nextStepIndex: 0,
        label: formatIntervalLabel({ unit: 'd', val: nextDays }),
      }
    }
    case 3: { // Good
      const nextDays = Math.max(interval + 1, Math.round(interval * ease * settings.intervalModifier))
      return {
        nextDue: now + nextDays * 24 * 60 * 60 * 1000,
        nextInterval: nextDays,
        nextEase: ease,
        nextState: 'review',
        nextStepIndex: 0,
        label: formatIntervalLabel({ unit: 'd', val: nextDays }),
      }
    }
    case 4: { // Easy
      ease += 0.15
      const nextDays = Math.max(
        interval + 2,
        Math.round(interval * ease * settings.easyBonus * settings.intervalModifier),
      )
      return {
        nextDue: now + nextDays * 24 * 60 * 60 * 1000,
        nextInterval: nextDays,
        nextEase: ease,
        nextState: 'review',
        nextStepIndex: 0,
        label: formatIntervalLabel({ unit: 'd', val: nextDays }),
      }
    }
  }
}
