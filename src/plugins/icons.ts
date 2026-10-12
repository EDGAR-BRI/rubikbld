import { addCollection } from '@iconify/vue'
import offlineIcons from './offlineIcons.json'

/**
 * Registra todos los iconos Lucide usados en la aplicación
 * en la memoria local de @iconify/vue para que funcionen 100% offline
 * sin realizar ninguna petición de red a api.iconify.design.
 */
export function setupOfflineIcons(): void {
  try {
    addCollection(offlineIcons as any)
  } catch (err) {
    console.error('Error al inicializar iconos offline:', err)
  }
}
