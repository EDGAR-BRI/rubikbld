// Modelado físico del cubo y asignación Speffz para BLD

export type CubeFace = 'U' | 'L' | 'F' | 'R' | 'B' | 'D'
export type PieceType = 'corner' | 'edge' | 'center' | 'center_x' | 'center_plus'

export const CUBE_FACES: CubeFace[] = ['U', 'L', 'F', 'R', 'B', 'D']

export const FACE_COLORS: Record<CubeFace, { bg: string; text: string; name: string }> = {
  U: { bg: '#f8fafc', text: '#0f172a', name: 'Up (Blanco)' },
  L: { bg: '#ea580c', text: '#ffffff', name: 'Left (Naranja)' },
  F: { bg: '#16a34a', text: '#ffffff', name: 'Front (Verde)' },
  R: { bg: '#dc2626', text: '#ffffff', name: 'Right (Rojo)' },
  B: { bg: '#2563eb', text: '#ffffff', name: 'Back (Azul)' },
  D: { bg: '#eab308', text: '#0f172a', name: 'Down (Amarillo)' },
}

export const DIGRAPH_LETTERS = ['CH']

export function isLetterToken(token: string): boolean {
  const t = token.trim().toUpperCase()
  if (t.length === 1) {
    const code = t.charCodeAt(0)
    return (code >= 65 && code <= 90) || t === 'Ñ'
  }
  return DIGRAPH_LETTERS.includes(t)
}

export function splitPair(pair: string): [string, string] | string[] {
  const s = pair.trim().toUpperCase()
  const result: string[] = []
  let i = 0
  while (i < s.length) {
    let matched: string | null = null
    for (const d of DIGRAPH_LETTERS) {
      if (s.startsWith(d, i)) {
        matched = d
        break
      }
    }
    if (matched) {
      result.push(matched)
      i += matched.length
    } else {
      result.push(s[i])
      i += 1
    }
  }
  return result
}

export function stickerId(face: CubeFace, index: number): string {
  return `${face}${index}`
}

export function allStickerIds(gridSize: number = 3): string[] {
  const ids: string[] = []
  for (const f of CUBE_FACES) {
    for (let i = 0; i < gridSize * gridSize; i++) {
      ids.push(stickerId(f, i))
    }
  }
  return ids
}

export function pieceTypeOf(id: string, gridSize: number = 3): PieceType {
  const idx = parseInt(id.slice(1), 10)
  const n = gridSize
  const row = Math.floor(idx / n)
  const col = idx % n
  const onBorder = row === 0 || row === n - 1 || col === 0 || col === n - 1

  if (!onBorder) {
    if (n >= 5) {
      const cr = row - 1
      const cc = col - 1
      if (cr === 1 && cc === 1) return 'center'
      if ((cr === 0 || cr === 2) && (cc === 0 || cc === 2)) return 'center_x'
      return 'center_plus'
    }
    return 'center'
  }

  const onCorner = (row === 0 || row === n - 1) && (col === 0 || col === n - 1)
  return onCorner ? 'corner' : 'edge'
}

export function stickerCoord(id: string, gridSize: number = 3): [number, number, number] {
  const face = id[0] as CubeFace
  const idx = parseInt(id.slice(1), 10)
  const n = gridSize
  const row = Math.floor(idx / n)
  const col = idx % n
  const c = (n - 1) / 2

  switch (face) {
    case 'U': return [col - c, n / 2, row - c]
    case 'D': return [col - c, -n / 2, row - c]
    case 'F': return [col - c, c - row, n / 2]
    case 'B': return [col - c, c - row, -n / 2]
    case 'R': return [n / 2, c - row, c - col]
    case 'L': return [-n / 2, c - row, col - c]
    default: return [0, 0, 0]
  }
}

export function pieceKey(id: string, gridSize: number = 3): string {
  const type = pieceTypeOf(id, gridSize)
  if (type === 'center') return `center:${id}`

  const coord = stickerCoord(id, gridSize)
  const half = gridSize / 2
  const c = (gridSize - 1) / 2
  const snapped = coord.map(v => (Math.abs(v) === half ? (v < 0 ? -c : c) : v))
  return `${type}:${snapped.map(v => v.toFixed(2)).join(',')}`
}

export function defaultSpeffz3x3(): Record<string, string> {
  // Orden Speffz clásico por cara (U: A-D, L: E-H, F: I-L, R: M-P, B: Q-T, D: U-X)
  // Corner indices:
  // U: 0=A, 2=B, 8=C, 6=D
  // L: 0=E, 2=F, 8=G, 6=H
  // F: 0=I, 2=J, 8=K, 6=L
  // R: 0=M, 2=N, 8=O, 6=P
  // B: 0=Q, 2=R, 8=S, 6=T
  // D: 0=U, 2=V, 8=W, 6=X
  //
  // Edge indices:
  // U: 1=A, 5=B, 7=C, 3=D
  // L: 1=E, 5=F, 7=G, 3=H
  // F: 1=I, 5=J, 7=K, 3=L
  // R: 1=M, 5=N, 7=O, 3=P
  // B: 1=Q, 5=R, 7=S, 3=T
  // D: 1=U, 5=V, 7=W, 3=X

  const scheme: Record<string, string> = {}
  const faceOrder: CubeFace[] = ['U', 'L', 'F', 'R', 'B', 'D']
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWX'

  faceOrder.forEach((face, fIdx) => {
    const chunk = letters.slice(fIdx * 4, fIdx * 4 + 4)
    // Esquinas: top-left, top-right, bottom-right, bottom-left
    const cornerIndices = [0, 2, 8, 6]
    cornerIndices.forEach((pos, i) => {
      scheme[`${face}${pos}`] = chunk[i]
    })

    // Aristas: top, right, bottom, left
    const edgeIndices = [1, 5, 7, 3]
    edgeIndices.forEach((pos, i) => {
      scheme[`${face}${pos}`] = chunk[i]
    })
  })

  return scheme
}

export interface LetterSchemeConfig {
  id: string
  name: string
  gridSize: number
  stickers: Record<string, string> // id -> letter
  buffers: {
    corner: string // default: U8 (UFR)
    edge: string   // default: U7 (UF)
    center?: string
  }
}

export function getPieceStickers(id: string, gridSize: number = 3): string[] {
  const k = pieceKey(id, gridSize)
  return allStickerIds(gridSize).filter(s => pieceKey(s, gridSize) === k)
}

export function getPieceName(id: string, gridSize: number = 3): string {
  const stickers = getPieceStickers(id, gridSize)
  const order: Record<string, number> = { U: 0, D: 1, F: 2, B: 3, L: 4, R: 5 }
  return stickers
    .map(s => s[0])
    .sort((a, b) => (order[a] ?? 99) - (order[b] ?? 99))
    .join('')
}

export interface BufferStickerInfo {
  isBuffer: boolean
  isPrimary: boolean
  pieceType: 'corner' | 'edge' | null
  pieceStickers: string[]
  pieceName: string
}

export function getBufferStickerInfo(scheme: LetterSchemeConfig, id: string): BufferStickerInfo {
  const gridSize = scheme.gridSize || 3
  const pType = pieceTypeOf(id, gridSize)

  if (pType !== 'corner' && pType !== 'edge') {
    return {
      isBuffer: false,
      isPrimary: false,
      pieceType: null,
      pieceStickers: [id],
      pieceName: '',
    }
  }

  const bufferId = pType === 'corner' ? scheme.buffers.corner : scheme.buffers.edge
  const pieceStickers = getPieceStickers(id, gridSize)
  const pieceName = getPieceName(id, gridSize)

  if (!bufferId) {
    return {
      isBuffer: false,
      isPrimary: false,
      pieceType: null,
      pieceStickers,
      pieceName,
    }
  }

  const targetKey = pieceKey(bufferId, gridSize)
  const thisKey = pieceKey(id, gridSize)
  const isBuffer = targetKey === thisKey
  const isPrimary = id === bufferId

  return {
    isBuffer,
    isPrimary,
    pieceType: isBuffer ? pType : null,
    pieceStickers,
    pieceName,
  }
}

/**
 * En BLD, el buffer queda sin letra y también su contraparte en aristas
 * y sus otras dos caras en esquinas.
 * Esta función limpia las letras de todas las caras de las piezas buffer.
 */
export function cleanSchemeBufferLetters(scheme: LetterSchemeConfig): LetterSchemeConfig {
  const nextStickers = { ...scheme.stickers }
  const gridSize = scheme.gridSize || 3

  if (scheme.buffers.corner) {
    const cornerStickers = getPieceStickers(scheme.buffers.corner, gridSize)
    for (const sid of cornerStickers) {
      nextStickers[sid] = ''
    }
  }

  if (scheme.buffers.edge) {
    const edgeStickers = getPieceStickers(scheme.buffers.edge, gridSize)
    for (const sid of edgeStickers) {
      nextStickers[sid] = ''
    }
  }

  return {
    ...scheme,
    stickers: nextStickers,
  }
}

export const DEFAULT_SCHEME_3X3: LetterSchemeConfig = cleanSchemeBufferLetters({
  id: 'speffz-3x3',
  name: 'Speffz Estándar 3x3',
  gridSize: 3,
  stickers: defaultSpeffz3x3(),
  buffers: {
    corner: 'U8', // UFR
    edge: 'U7',   // UF
  },
})

/**
 * Detecta letras repetidas dentro del mismo tipo de pieza (esquinas con esquinas, aristas con aristas).
 * En 3BLD, esquinas y aristas son piscinas de objetivos independientes que comparten abecedario.
 * Retorna un Map de stickerId -> lista de otros stickerIds que tienen la misma letra.
 */
export function getSchemeDuplicateStickers(scheme: LetterSchemeConfig): Map<string, string[]> {
  const result = new Map<string, string[]>()
  if (!scheme || !scheme.stickers) return result

  const gridSize = scheme.gridSize || 3
  const groupMap = new Map<string, string[]>()

  for (const [id, rawLetter] of Object.entries(scheme.stickers)) {
    const letter = (rawLetter || '').trim().toUpperCase()
    if (!letter) continue

    const bufferInfo = getBufferStickerInfo(scheme, id)
    if (bufferInfo.isBuffer) continue

    const pType = pieceTypeOf(id, gridSize)
    if (pType !== 'corner' && pType !== 'edge') continue

    const key = `${pType}:${letter}`
    const list = groupMap.get(key) || []
    list.push(id)
    groupMap.set(key, list)
  }

  for (const [, ids] of groupMap) {
    if (ids.length > 1) {
      for (const id of ids) {
        result.set(id, ids.filter(other => other !== id))
      }
    }
  }

  return result
}

/**
 * Busca si la letra que se quiere asignar a un sticker ya está en uso por otro sticker
 * del mismo tipo de pieza (esquina o arista). Retorna la lista de stickers conflictivos.
 */
export function findStickerLetterConflicts(
  scheme: LetterSchemeConfig,
  stickerId: string,
  letter: string,
): string[] {
  const norm = (letter || '').trim().toUpperCase()
  if (!norm) return []

  const gridSize = scheme.gridSize || 3
  const pType = pieceTypeOf(stickerId, gridSize)
  if (pType !== 'corner' && pType !== 'edge') return []

  const conflicts: string[] = []
  for (const [id, rawLetter] of Object.entries(scheme.stickers)) {
    if (id === stickerId) continue
    if ((rawLetter || '').trim().toUpperCase() !== norm) continue

    const bufferInfo = getBufferStickerInfo(scheme, id)
    if (bufferInfo.isBuffer) continue

    if (pieceTypeOf(id, gridSize) === pType) {
      conflicts.push(id)
    }
  }

  return conflicts
}

