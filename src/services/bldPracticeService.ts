import { Cube, generateScramble, type BldMemoResult } from '@memodungeon/cube'
import type { LetterSchemeConfig } from '@/models/cube'
import { db } from '@/db'
import type { PairItem } from '@/models/pair'
import { getScrambledLettersAtPosition } from '@/services/cubePermutation'

export interface PracticePairItem {
  pair: string // ej: "PJ" o "CHJ"
  letters: string[] // ej: ["P", "J"] o ["CH", "J"]
  pieceType: 'edge' | 'corner'
  word?: string // Palabra mnemotécnica registrada por el usuario
  image?: string // Imagen mnemotécnica en base64/dataURL
}

export interface PracticeSolve {
  scramble: string
  cubeString: string
  letterAtPosition: Record<string, string>
  hasParity: boolean
  edgePairs: PracticePairItem[]
  cornerPairs: PracticePairItem[]
  allPairs: PracticePairItem[]
  rawResult: BldMemoResult
}

const FACE_ORDER = ['U', 'L', 'F', 'R', 'B', 'D'] as const

/**
 * Convierte el esquema de stickers de rubikbld a una lista de 54 tokens para @memodungeon/cube,
 * configurando los tokens específicos de los buffers para lanzar los ciclos.
 */
export function buildSchemeTokens(scheme: LetterSchemeConfig): {
  tokens: string[]
  edgeBuffer: string
  cornerBuffer: string
} {
  const edgeBufferSticker = scheme.buffers?.edge || 'U7'
  const cornerBufferSticker = scheme.buffers?.corner || 'U8'

  const edgeBufferToken = '__BUF_E__'
  const cornerBufferToken = '__BUF_C__'

  const tokens: string[] = []

  for (const face of FACE_ORDER) {
    for (let i = 0; i < 9; i++) {
      const sid = `${face}${i}`
      if (sid === edgeBufferSticker) {
        tokens.push(edgeBufferToken)
      } else if (sid === cornerBufferSticker) {
        tokens.push(cornerBufferToken)
      } else {
        const letter = (scheme.stickers[sid] || '').trim()
        tokens.push(letter)
      }
    }
  }

  return {
    tokens,
    edgeBuffer: edgeBufferToken,
    cornerBuffer: cornerBufferToken,
  }
}

/**
 * Genera un scramble aleatorio (o usa uno personalizado), aplica los movimientos
 * a un cubo virtual 3x3, traza los ciclos BLD de aristas y esquinas según el esquema
 * y adjunta las palabras mnemotécnicas guardadas en Dexie.
 */
export async function generatePracticeSolve(
  scheme: LetterSchemeConfig,
  customScramble?: string,
): Promise<PracticeSolve> {
  const scramble = (customScramble || '').trim() || generateScramble(20)
  const cube = Cube.fromScramble(scramble)
  const cubeString = cube.toString()

  const { tokens, edgeBuffer, cornerBuffer } = buildSchemeTokens(scheme)
  const letterAtPosition = getScrambledLettersAtPosition(cube, scheme)

  const rawResult = cube.to3bldMemo({
    edgeBuffer,
    cornerBuffer,
    letterScheme: tokens,
  })

  const edgePairs = await enrichPairs(rawResult.edges, 'edge')
  const cornerPairs = await enrichPairs(rawResult.corners, 'corner')

  return {
    scramble,
    cubeString,
    letterAtPosition,
    hasParity: rawResult.hasParity,
    edgePairs,
    cornerPairs,
    allPairs: [...edgePairs, ...cornerPairs],
    rawResult,
  }
}

async function enrichPairs(
  pairs: string[][],
  pieceType: 'edge' | 'corner',
): Promise<PracticePairItem[]> {
  const result: PracticePairItem[] = []

  for (const letters of pairs) {
    const pairStr = letters.join('')
    let pairData: PairItem | undefined

    if (pairStr.length > 0) {
      pairData = await db.pairs.get(pairStr)
    }

    result.push({
      pair: pairStr,
      letters,
      pieceType,
      word: pairData?.word || '',
      image: pairData?.image || '',
    })
  }

  return result
}
