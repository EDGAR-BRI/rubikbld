import type { Cube } from '@memodungeon/cube'
import type { CubeFace, LetterSchemeConfig } from '@/models/cube'

// Helpers de conversión de índice global Kociemba (0..53)
const _U = (x: number) => x - 1
const _R = (x: number) => 8 + x
const _F = (x: number) => 17 + x
const _D = (x: number) => 26 + x
const _L = (x: number) => 35 + x
const _B = (x: number) => 44 + x

// Facelets de esquinas según Kociemba / @memodungeon/cube
// URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB
const cornerFacelet: number[][] = [
  [_U(9), _R(1), _F(3)], // URF: 8, 9, 20 (U8, R0, F2)
  [_U(7), _F(1), _L(3)], // UFL: 6, 18, 38 (U6, F0, L2)
  [_U(1), _L(1), _B(3)], // ULB: 0, 36, 47 (U0, L0, B2)
  [_U(3), _B(1), _R(3)], // UBR: 2, 45, 11 (U2, B0, R2)
  [_D(3), _F(9), _R(7)], // DFR: 29, 26, 15 (D2, F8, R6)
  [_D(1), _L(9), _F(7)], // DLF: 27, 44, 24 (D0, L8, F6)
  [_D(7), _B(9), _L(7)], // DBL: 33, 53, 42 (D6, B8, L6)
  [_D(9), _R(9), _B(7)], // DRB: 35, 17, 51 (D8, R8, B6)
]

// Facelets de aristas según Kociemba / @memodungeon/cube
// UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR
const edgeFacelet: number[][] = [
  [_U(6), _R(2)], // UR: 5, 10 (U5, R1)
  [_U(8), _F(2)], // UF: 7, 19 (U7, F1)
  [_U(4), _L(2)], // UL: 3, 37 (U3, L1)
  [_U(2), _B(2)], // UB: 1, 46 (U1, B1)
  [_D(6), _R(8)], // DR: 32, 16 (D5, R7)
  [_D(2), _F(8)], // DF: 28, 25 (D1, F7)
  [_D(4), _L(8)], // DL: 30, 43 (D3, L7)
  [_D(8), _B(8)], // DB: 34, 52 (D7, B7)
  [_F(6), _R(4)], // FR: 23, 12 (F5, R3)
  [_F(4), _L(6)], // FL: 21, 41 (F3, L5)
  [_B(6), _L(4)], // BL: 50, 39 (B5, L3)
  [_B(4), _R(6)], // BR: 48, 14 (B3, R5)
]

const FACES: CubeFace[] = ['U', 'R', 'F', 'D', 'L', 'B']

export function faceletToStickerId(facelet: number): string {
  const faceIdx = Math.floor(facelet / 9)
  const stickerIdx = facelet % 9
  return `${FACES[faceIdx]}${stickerIdx}`
}

/**
 * Retorna un mapa `positionId -> originalStickerId`
 * que describe qué pegatina física se encuentra actualmente en cada posición del cubo escramblerado.
 */
export function getStickerPermutation(cube: Cube): Record<string, string> {
  const perm: Record<string, string> = {}

  // Centros
  for (let i = 0; i <= 5; i++) {
    const destFacelet = 9 * i + 4
    const origFacelet = 9 * cube.center[i] + 4
    perm[faceletToStickerId(destFacelet)] = faceletToStickerId(origFacelet)
  }

  // Esquinas
  for (let i = 0; i <= 7; i++) {
    const cp = cube.cp[i]
    const co = cube.co[i]
    for (let n = 0; n <= 2; n++) {
      const destFacelet = cornerFacelet[i][(n + co) % 3]
      const origFacelet = cornerFacelet[cp][n]
      perm[faceletToStickerId(destFacelet)] = faceletToStickerId(origFacelet)
    }
  }

  // Aristas
  for (let i = 0; i <= 11; i++) {
    const ep = cube.ep[i]
    const eo = cube.eo[i]
    for (let n = 0; n <= 1; n++) {
      const destFacelet = edgeFacelet[i][(n + eo) % 2]
      const origFacelet = edgeFacelet[ep][n]
      perm[faceletToStickerId(destFacelet)] = faceletToStickerId(origFacelet)
    }
  }

  return perm
}

/**
 * Calcula la letra efectiva de cada posición física en el cubo revuelto,
 * consultando la letra asignada en el esquema al sticker físico original que viajó allí.
 */
export function getScrambledLettersAtPosition(
  cube: Cube,
  scheme: LetterSchemeConfig,
): Record<string, string> {
  const perm = getStickerPermutation(cube)
  const letterMap: Record<string, string> = {}

  for (const [position, originalSticker] of Object.entries(perm)) {
    const letter = (scheme.stickers[originalSticker] || '').trim()
    if (letter) {
      letterMap[position] = letter
    }
  }

  return letterMap
}
