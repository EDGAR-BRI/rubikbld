// Modelo para los pares de letras mnemotécnicos unificados

export type PairUsage = 'both' | 'corner' | 'edge'

export interface PairItem {
  id: string // Identificador único por par, ej: "PJ"
  pair: string // Letras del par, ej: "PJ"
  usage: PairUsage // 'both' (ambas), 'corner' (solo esquinas), 'edge' (solo aristas)
  firstLetter: string
  secondLetter: string
  word: string // Palabra mnemotécnica propia del usuario (ej: "Pijama")
  image?: string // Base64 DataURL comprimido o URL de imagen
  notes?: string // Descripción mnemotécnica o historia
  createdAt: number
  updatedAt: number
}

export interface PairStats {
  total: number
  completed: number
  withImage: number
  percentage: number
  bothCount: number
  cornerOnlyCount: number
  edgeOnlyCount: number
}
