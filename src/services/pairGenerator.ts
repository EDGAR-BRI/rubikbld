// Generador de pares válidos según física del cubo y esquema de letras (Unificados con etiquetas)

import {
  allStickerIds,
  type LetterSchemeConfig,
  pieceKey,
  pieceTypeOf,
  splitPair,
} from '@/models/cube'
import type { PairItem, PairUsage } from '@/models/pair'

export interface GeneratedUnifiedPairInfo {
  pair: string
  usage: PairUsage
  firstLetter: string
  secondLetter: string
}

function getValidPairsForPiece(
  scheme: LetterSchemeConfig,
  pieceType: 'corner' | 'edge',
): Set<string> {
  const gridSize = scheme.gridSize || 3
  const bufferId = pieceType === 'corner' ? scheme.buffers.corner : scheme.buffers.edge
  const bufferPieceKey = bufferId ? pieceKey(bufferId, gridSize) : null

  // Identificar stickers del tipo correspondiente
  const candidateStickers = allStickerIds(gridSize).filter(id => {
    const t = pieceTypeOf(id, gridSize)
    if (t !== pieceType) return false

    // No incluir stickers de la pieza física buffer
    if (bufferPieceKey && pieceKey(id, gridSize) === bufferPieceKey) {
      return false
    }

    const letter = scheme.stickers[id]?.trim().toUpperCase()
    return !!letter
  })

  const stickerData = candidateStickers.map(id => ({
    id,
    letter: scheme.stickers[id].trim().toUpperCase(),
    pKey: pieceKey(id, gridSize),
  }))

  const lettersSet = new Set<string>()
  stickerData.forEach(s => lettersSet.add(s.letter))
  const letters = Array.from(lettersSet)

  const validSet = new Set<string>()

  for (const letA of letters) {
    for (const letB of letters) {
      if (letA === letB) continue

      const stickersA = stickerData.filter(s => s.letter === letA)
      const stickersB = stickerData.filter(s => s.letter === letB)

      let physicallyPossible = false
      for (const sA of stickersA) {
        for (const sB of stickersB) {
          if (sA.pKey !== sB.pKey) {
            physicallyPossible = true
            break
          }
        }
        if (physicallyPossible) break
      }

      if (physicallyPossible) {
        validSet.add(`${letA}${letB}`)
      }
    }
  }

  return validSet
}

/**
 * Genera todos los pares unificados sin duplicar.
 * Asigna la etiqueta de uso:
 * - 'both': si se usa tanto en esquinas como en aristas.
 * - 'corner': si es exclusivo de esquinas.
 * - 'edge': si es exclusivo de aristas.
 */
export function generateUnifiedPairs(
  scheme: LetterSchemeConfig,
): GeneratedUnifiedPairInfo[] {
  const cornerPairs = getValidPairsForPiece(scheme, 'corner')
  const edgePairs = getValidPairsForPiece(scheme, 'edge')

  const allPairsSet = new Set<string>([...cornerPairs, ...edgePairs])
  const sortedPairs = Array.from(allPairsSet).sort((a, b) => a.localeCompare(b))

  return sortedPairs.map(pair => {
    const inCorners = cornerPairs.has(pair)
    const inEdges = edgePairs.has(pair)

    let usage: PairUsage = 'both'
    if (inCorners && inEdges) usage = 'both'
    else if (inCorners) usage = 'corner'
    else usage = 'edge'

    const [firstLetter = '', secondLetter = ''] = splitPair(pair)
    return {
      pair,
      usage,
      firstLetter,
      secondLetter,
    }
  })
}

/**
 * Fusiona los pares unificados con los existentes en la base de datos,
 * migrando automáticamente palabras e imágenes de registros anteriores (ej. "corner:PJ").
 */
export function mergeWithExistingPairs(
  generated: GeneratedUnifiedPairInfo[],
  existing: Map<string, PairItem>,
): PairItem[] {
  const now = Date.now()
  return generated.map(gen => {
    // Buscar por ID unificado ("PJ") o por IDs anteriores ("corner:PJ" o "edge:PJ")
    const prev =
      existing.get(gen.pair) ||
      existing.get(`corner:${gen.pair}`) ||
      existing.get(`edge:${gen.pair}`)

    if (prev) {
      return {
        ...prev,
        id: gen.pair,
        pair: gen.pair,
        usage: gen.usage,
        firstLetter: gen.firstLetter,
        secondLetter: gen.secondLetter,
      }
    }

    return {
      id: gen.pair,
      pair: gen.pair,
      usage: gen.usage,
      firstLetter: gen.firstLetter,
      secondLetter: gen.secondLetter,
      word: '',
      image: undefined,
      notes: '',
      createdAt: now,
      updatedAt: now,
    }
  })
}
