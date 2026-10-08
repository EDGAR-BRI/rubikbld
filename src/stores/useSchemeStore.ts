import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db'
import {
  DEFAULT_SCHEME_3X3,
  cleanSchemeBufferLetters,
  getBufferStickerInfo,
  type LetterSchemeConfig,
} from '@/models/cube'

export const useSchemeStore = defineStore('scheme', () => {
  const currentScheme = ref<LetterSchemeConfig>({ ...DEFAULT_SCHEME_3X3 })
  const loading = ref(false)

  async function loadScheme() {
    loading.value = true
    try {
      const activeIdSetting = await db.settings.get('active_scheme_id')
      const schemeId = activeIdSetting?.value || DEFAULT_SCHEME_3X3.id
      const found = await db.schemes.get(schemeId)
      let schemeToUse: LetterSchemeConfig
      if (found) {
        schemeToUse = found
      } else {
        schemeToUse = { ...DEFAULT_SCHEME_3X3 }
        await db.schemes.put(schemeToUse)
      }

      // Asegurar que las piezas del buffer queden sin letra (buffer y contrapartes)
      const cleaned = cleanSchemeBufferLetters(schemeToUse)
      const hasDifferences = JSON.stringify(cleaned.stickers) !== JSON.stringify(schemeToUse.stickers)
      currentScheme.value = cleaned

      if (hasDifferences) {
        await db.schemes.put(cleaned)
        await db.syncPairsWithScheme(cleaned)
      }
    } finally {
      loading.value = false
    }
  }

  async function updateSticker(id: string, letter: string) {
    const info = getBufferStickerInfo(currentScheme.value, id)
    // En BLD, la pieza del buffer y sus caras asociadas no llevan letra
    if (info.isBuffer) {
      return
    }

    const nextStickers = {
      ...currentScheme.value.stickers,
      [id]: letter.trim().toUpperCase(),
    }
    currentScheme.value = {
      ...currentScheme.value,
      stickers: nextStickers,
    }
    await db.schemes.put(currentScheme.value)
    // Sincronizar pares en segundo plano
    await db.syncPairsWithScheme(currentScheme.value)
  }

  async function updateBuffer(type: 'corner' | 'edge', stickerId: string) {
    const updated: LetterSchemeConfig = {
      ...currentScheme.value,
      buffers: {
        ...currentScheme.value.buffers,
        [type]: stickerId,
      },
    }
    // Al asignar nuevo buffer, el buffer, su contraparte en aristas
    // y sus otras dos caras en esquinas quedan limpias sin letra
    const cleaned = cleanSchemeBufferLetters(updated)
    currentScheme.value = cleaned

    await db.schemes.put(cleaned)
    await db.syncPairsWithScheme(cleaned)
  }

  async function resetToSpeffz() {
    currentScheme.value = cleanSchemeBufferLetters({ ...DEFAULT_SCHEME_3X3 })
    await db.schemes.put(currentScheme.value)
    await db.syncPairsWithScheme(currentScheme.value)
  }

  return {
    currentScheme,
    loading,
    loadScheme,
    updateSticker,
    updateBuffer,
    resetToSpeffz,
  }
})
