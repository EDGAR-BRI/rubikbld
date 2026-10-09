import { splitPair } from '../models/cube'
import type { PairItem } from '../models/pair'

/**
 * Normaliza texto eliminando acentos en vocales (á, é, í, ó, ú, ü)
 * pero preservando la letra Ñ / ñ tan crítica en esquemas de BLD en español.
 */
export function normalizeSearchText(text: string): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u0302\u0304-\u036f]/g, '') // Elimina todo diacrítico excepto \u0303 (virgulilla de la ñ)
    .normalize('NFC')
    .toLowerCase()
    .trim()
}

/**
 * Normalización relajada que también convierte ñ en n para usuarios que
 * busquen desde teclados sin la letra Ñ física.
 */
export function normalizeRelaxedText(text: string): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina todos los diacríticos incluyendo la virgulilla
    .normalize('NFC')
    .toLowerCase()
    .trim()
}

/**
 * Limpia un query para extraer el posible código del par de letras:
 * Remueve espacios, guiones, barras, comas, puntos y pasa a mayúsculas.
 * Ejemplos:
 *   "p j"   -> "PJ"
 *   "p-j"   -> "PJ"
 *   "ch a"  -> "CHA"
 *   "a, ch" -> "ACH"
 */
export function cleanPairLetters(query: string): string {
  if (!query) return ''
  return query
    .normalize('NFD')
    .replace(/[\u0300-\u0302\u0304-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[\s\-_,./\\:;+]+/g, '')
    .toUpperCase()
    .trim()
}

export interface PairSearchResult {
  item: PairItem
  score: number
}

/**
 * Evalúa la relevancia de un par respecto a un query de búsqueda.
 * Retorna un puntaje >= 0. Si el puntaje es 0, el par no coincide con el query.
 */
export function scorePairMatch(item: PairItem, query: string): number {
  const trimmed = query.trim()
  if (!trimmed) return 1 // Si no hay query, todos son relevantes por igual

  const cleanQuery = cleanPairLetters(trimmed)
  const normQuery = normalizeSearchText(trimmed)
  const relaxedQuery = normalizeRelaxedText(trimmed)

  const pairUpper = item.pair.toUpperCase()
  const normWord = normalizeSearchText(item.word || '')
  const relaxedWord = normalizeRelaxedText(item.word || '')
  const normNotes = normalizeSearchText(item.notes || '')
  const relaxedNotes = normalizeRelaxedText(item.notes || '')

  let score = 0

  // 1. PRIORIDAD MÁXIMA: COINCIDENCIA CON EL CÓDIGO DEL PAR DE LETRAS
  // Cuando el usuario teclea 1 o 2 letras, el par en sí mismo debe priorizarse contundentemente.
  if (cleanQuery.length > 0) {
    // 1.1 Coincidencia EXACTA con el par (ej: busca "PJ" o "p j", el par es "PJ")
    if (pairUpper === cleanQuery) {
      score += 150000
    }

    // 1.2 El par empieza con la búsqueda (ej: busca "P", encuentra "PA", "PB"...)
    else if (pairUpper.startsWith(cleanQuery)) {
      score += 60000
    }

    // 1.3 El par contiene la búsqueda (ej: busca "J", encuentra "AJ", "BJ"...)
    else if (pairUpper.includes(cleanQuery)) {
      score += 25000
    }

    // 1.4 Si el query son 2 tokens de letras, verificar par inverso o misma fila
    const queryTokens = splitPair(cleanQuery)
    if (queryTokens.length === 2) {
      const [qFirst, qSecond] = queryTokens
      // Par inverso (ej: buscó "JP" y existe "PJ")
      if (item.firstLetter === qSecond && item.secondLetter === qFirst) {
        score += 15000
      }
      // Coincidencia con la primera letra del par (ej: buscó "CA" y el par es "CB")
      if (item.firstLetter === qFirst) {
        score += 3500
      }
    }
  }

  // 2. COINCIDENCIA CON LA PALABRA MNEMOTÉCNICA
  if (normWord.length > 0 && normQuery.length > 0) {
    // 2.1 Coincidencia EXACTA de la palabra completa (ej: buscó "pijama", palabra es "Pijama")
    if (normWord === normQuery) {
      score += 50000
    } else if (relaxedWord === relaxedQuery) {
      score += 45000
    }

    // 2.2 La palabra empieza con el query (ej: buscó "pij", palabra es "Pijama")
    else if (normWord.startsWith(normQuery)) {
      score += 20000
    } else if (relaxedWord.startsWith(relaxedQuery)) {
      score += 18000
    }

    // 2.3 Alguna palabra interna empieza con el query (ej: "Hombre Pijama" y busca "pijama")
    else if (new RegExp(`(?:^|\\s)${escapeRegExp(normQuery)}`, 'i').test(normWord)) {
      score += 10000
    } else if (new RegExp(`(?:^|\\s)${escapeRegExp(relaxedQuery)}`, 'i').test(relaxedWord)) {
      score += 9000
    }

    // 2.4 La palabra contiene el query en cualquier parte (ej: "espejo" contiene "pj")
    else if (normWord.includes(normQuery)) {
      score += 3000
    } else if (relaxedWord.includes(relaxedQuery)) {
      score += 2500
    }

    // 2.5 Coincidencia por iniciales de palabras compuestas (ej: "Papa Juan" con "PJ")
    const words = normWord.split(/\s+/).filter(Boolean)
    if (words.length >= 2 && cleanQuery.length >= 2) {
      const initials = words.map(w => w[0]).join('').toUpperCase()
      if (initials === cleanQuery) {
        score += 8000
      } else if (initials.startsWith(cleanQuery)) {
        score += 4000
      }
    }
  }

  // 3. COINCIDENCIA CON LAS NOTAS / HISTORIA
  if (normNotes.length > 0 && normQuery.length > 0) {
    if (normNotes.startsWith(normQuery)) {
      score += 1500
    } else if (new RegExp(`(?:^|\\s)${escapeRegExp(normQuery)}`, 'i').test(normNotes)) {
      score += 1000
    } else if (normNotes.includes(normQuery) || relaxedNotes.includes(relaxedQuery)) {
      score += 400
    }
  }

  // 4. BÚSQUEDA MULTI-PALABRA (ej: "batman auto" o "pijama roja")
  const queryWords = normQuery.split(/\s+/).filter(w => w.length > 1)
  if (queryWords.length > 1) {
    const combinedText = `${normWord} ${normNotes}`
    const allWordsMatch = queryWords.every(w => combinedText.includes(w))
    if (allWordsMatch) {
      score += 6000
    }
  }

  return score
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Filtra y ordena los pares según el query de búsqueda proporcionado.
 * Prioriza de forma contundente el par de letras cuando se buscan 1 o 2 letras,
 * y ordena alfabéticamente dentro del mismo nivel de relevancia.
 */
export function searchAndRankPairs(pairs: PairItem[], query: string): PairItem[] {
  const trimmed = query.trim()
  if (!trimmed) {
    return [...pairs].sort((a, b) => a.pair.localeCompare(b.pair))
  }

  const scored: PairSearchResult[] = []

  for (const item of pairs) {
    const score = scorePairMatch(item, trimmed)
    if (score > 0) {
      scored.push({ item, score })
    }
  }

  // Ordenar primero por puntaje descendente (más relevante primero).
  // A igual puntaje, ordenar alfabéticamente por código del par para orden predecible.
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return a.item.pair.localeCompare(b.item.pair)
  })

  return scored.map(s => s.item)
}
