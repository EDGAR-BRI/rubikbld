// Base de datos local IndexedDB con Dexie.js (100% Offline-First)

import Dexie, { type Table } from 'dexie'
import { DEFAULT_SCHEME_3X3, type LetterSchemeConfig } from '@/models/cube'
import type { PairItem } from '@/models/pair'
import type { ReviewLog, SRSCard } from '@/models/card'
import { DEFAULT_SRS_SETTINGS } from '@/models/card'
import { generateUnifiedPairs, mergeWithExistingPairs } from '@/services/pairGenerator'

export class RubikBldDatabase extends Dexie {
  schemes!: Table<LetterSchemeConfig, string>
  pairs!: Table<PairItem, string>
  cards!: Table<SRSCard, string>
  reviews!: Table<ReviewLog, number>
  settings!: Table<{ key: string; value: any }, string>

  constructor() {
    super('RubikBldDB')

    this.version(1).stores({
      schemes: '&id, name, gridSize',
      pairs: '&id, pair, pieceType, firstLetter, secondLetter, word, updatedAt',
      cards: '&id, pair, pieceType, state, due, interval',
      reviews: '++id, cardId, pair, pieceType, rating, timestamp',
      settings: '&key',
    })

    // Versión 2: Pares unificados (id es el par directo "PJ", uso "usage": both | corner | edge)
    this.version(2).stores({
      schemes: '&id, name, gridSize',
      pairs: '&id, pair, usage, firstLetter, secondLetter, word, updatedAt',
      cards: '&id, pair, usage, state, due, interval',
      reviews: '++id, cardId, pair, rating, timestamp',
      settings: '&key',
    })

    // Versión 3: Soporte para archivar pares y tarjetas (isArchived indexado)
    this.version(3).stores({
      schemes: '&id, name, gridSize',
      pairs: '&id, pair, usage, firstLetter, secondLetter, word, isArchived, updatedAt',
      cards: '&id, pair, usage, state, due, interval, isArchived',
      reviews: '++id, cardId, pair, rating, timestamp',
      settings: '&key',
    })
  }

  /**
   * Inicializa la base de datos con el esquema Speffz y genera las tarjetas si no existen.
   */
  async initializeDefaults(): Promise<void> {
    const existingScheme = await this.schemes.get(DEFAULT_SCHEME_3X3.id)
    if (!existingScheme) {
      await this.schemes.put(DEFAULT_SCHEME_3X3)
    }

    const savedSettings = await this.settings.get('srs_settings')
    if (!savedSettings) {
      await this.settings.put({ key: 'srs_settings', value: DEFAULT_SRS_SETTINGS })
    }

    const activeSchemeId = await this.settings.get('active_scheme_id')
    if (!activeSchemeId) {
      await this.settings.put({ key: 'active_scheme_id', value: DEFAULT_SCHEME_3X3.id })
    }

    // Comprobar si ya existen pares o si necesitan migración a unificados (sin dos puntos ':')
    const samplePair = await this.pairs.toCollection().first()
    const needsMigration = samplePair && samplePair.id.includes(':')
    const pairsCount = await this.pairs.count()

    if (pairsCount === 0 || needsMigration) {
      const active = (await this.schemes.get(activeSchemeId?.value || DEFAULT_SCHEME_3X3.id)) || DEFAULT_SCHEME_3X3
      await this.syncPairsWithScheme(active)
    }
  }

  /**
   * Sincroniza y crea los pares unificados con etiquetas (Ambas, Esquinas, Aristas)
   */
  async syncPairsWithScheme(scheme: LetterSchemeConfig): Promise<void> {
    const rawScheme = JSON.parse(JSON.stringify(scheme))
    const existingPairsList = await this.pairs.toArray()
    const existingMap = new Map(existingPairsList.map(p => [p.id, p]))

    const unifiedGenerated = generateUnifiedPairs(rawScheme)
    const allMerged = mergeWithExistingPairs(unifiedGenerated, existingMap)

    await this.pairs.bulkPut(allMerged)

    // Eliminar pares obsoletos solo si no tienen contenido mnemotécnico personalizado (palabra, imagen o notas)
    // o si son identificadores antiguos con prefijo legacy ('corner:' o 'edge:')
    const validIds = new Set(allMerged.map(p => p.id))
    const obsoletePairIds = existingPairsList
      .filter(p => !validIds.has(p.id) && !p.word && !p.image && !p.notes)
      .map(p => p.id)
    if (obsoletePairIds.length > 0) {
      await this.pairs.bulkDelete(obsoletePairIds)
    }

    // Sincronizar tarjetas SRS para los pares
    const existingCardsList = await this.cards.toArray()
    const existingCardMap = new Map(existingCardsList.map(c => [c.id, c]))

    const obsoleteCardIds = existingCardsList
      .filter(c => obsoletePairIds.includes(c.id))
      .map(c => c.id)
    if (obsoleteCardIds.length > 0) {
      await this.cards.bulkDelete(obsoleteCardIds)
    }

    const cardsToSave: SRSCard[] = []
    const now = Date.now()

    for (const pair of allMerged) {
      const prevCard =
        existingCardMap.get(pair.id) ||
        existingCardMap.get(`corner:${pair.id}`) ||
        existingCardMap.get(`edge:${pair.id}`)

      if (prevCard) {
        cardsToSave.push({
          ...prevCard,
          id: pair.id,
          pair: pair.pair,
          usage: pair.usage,
          isArchived: pair.isArchived ?? prevCard.isArchived ?? false,
        })
      } else {
        cardsToSave.push({
          id: pair.id,
          pair: pair.pair,
          usage: pair.usage,
          state: 'new',
          due: now,
          interval: 0,
          easeFactor: 2.5,
          stepIndex: 0,
          repetitions: 0,
          lapses: 0,
          isArchived: pair.isArchived ?? false,
          createdAt: now,
        })
      }
    }

    if (cardsToSave.length > 0) {
      await this.cards.bulkPut(cardsToSave)
    }
  }

  /**
   * Elimina un par y su tarjeta SRS asociada de la base de datos
   */
  async deletePair(pairId: string): Promise<void> {
    await this.transaction('rw', this.pairs, this.cards, this.reviews, async () => {
      await this.pairs.delete(pairId)
      await this.cards.delete(pairId)
      await this.reviews.where('cardId').equals(pairId).delete()
    })
  }

  /**
   * Elimina un conjunto de pares y sus tarjetas SRS asociadas en lote
   */
  async deletePairs(pairIds: string[]): Promise<void> {
    if (!pairIds.length) return
    await this.transaction('rw', this.pairs, this.cards, this.reviews, async () => {
      await this.pairs.bulkDelete(pairIds)
      await this.cards.bulkDelete(pairIds)
      for (const id of pairIds) {
        await this.reviews.where('cardId').equals(id).delete()
      }
    })
  }

  /**
   * Archiva o desarchiva un conjunto de pares y sus tarjetas SRS correspondientes
   */
  async setPairsArchived(pairIds: string[], isArchived: boolean): Promise<void> {
    if (!pairIds.length) return
    const now = Date.now()
    await this.transaction('rw', this.pairs, this.cards, async () => {
      const pairsList = await this.pairs.bulkGet(pairIds)
      const updatedPairs: PairItem[] = []
      for (const p of pairsList) {
        if (p) {
          updatedPairs.push({
            ...p,
            isArchived,
            updatedAt: now,
          })
        }
      }
      if (updatedPairs.length > 0) {
        await this.pairs.bulkPut(updatedPairs)
      }

      const cardsList = await this.cards.bulkGet(pairIds)
      const updatedCards: SRSCard[] = []
      for (const c of cardsList) {
        if (c) {
          updatedCards.push({
            ...c,
            isArchived,
          })
        }
      }
      if (updatedCards.length > 0) {
        await this.cards.bulkPut(updatedCards)
      }
    })
  }

  /**
   * Reinicia el progreso de memorización (SRS) de todas las tarjetas.
   * Deja intactos los pares mnemotécnicos (palabras, imágenes, notas).
   */
  async resetAllCardsProgress(startingEase: number = 2.5): Promise<number> {
    const now = Date.now()
    let count = 0
    await this.transaction('rw', this.cards, this.reviews, async () => {
      const allCards = await this.cards.toArray()
      count = allCards.length
      const resetCards: SRSCard[] = allCards.map(c => ({
        ...c,
        state: 'new',
        due: now,
        interval: 0,
        easeFactor: startingEase,
        stepIndex: 0,
        repetitions: 0,
        lapses: 0,
        lastReviewed: undefined,
      }))
      if (resetCards.length > 0) {
        await this.cards.bulkPut(resetCards)
      }
      await this.reviews.clear()
    })
    return count
  }
}

export const db = new RubikBldDatabase()
