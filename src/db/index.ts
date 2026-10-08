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
    const existingPairsList = await this.pairs.toArray()
    const existingMap = new Map(existingPairsList.map(p => [p.id, p]))

    const unifiedGenerated = generateUnifiedPairs(scheme)
    const allMerged = mergeWithExistingPairs(unifiedGenerated, existingMap)

    await this.pairs.bulkPut(allMerged)

    // Eliminar pares y tarjetas obsoletos (o duplicados antiguos con prefijo corner: / edge:)
    const validIds = new Set(allMerged.map(p => p.id))
    const obsoletePairIds = existingPairsList.filter(p => !validIds.has(p.id)).map(p => p.id)
    if (obsoletePairIds.length > 0) {
      await this.pairs.bulkDelete(obsoletePairIds)
    }

    // Sincronizar tarjetas SRS para los pares
    const existingCardsList = await this.cards.toArray()
    const existingCardMap = new Map(existingCardsList.map(c => [c.id, c]))

    const obsoleteCardIds = existingCardsList.filter(c => !validIds.has(c.id)).map(c => c.id)
    if (obsoleteCardIds.length > 0) {
      await this.cards.bulkDelete(obsoleteCardIds)
    }

    const cardsToSave: SRSCard[] = []
    const now = Date.now()

    for (const pair of allMerged) {
      const prevCard = existingCardMap.get(pair.id)
      if (prevCard) {
        cardsToSave.push({
          ...prevCard,
          usage: pair.usage,
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
          createdAt: now,
        })
      }
    }

    if (cardsToSave.length > 0) {
      await this.cards.bulkPut(cardsToSave)
    }
  }
}

export const db = new RubikBldDatabase()
