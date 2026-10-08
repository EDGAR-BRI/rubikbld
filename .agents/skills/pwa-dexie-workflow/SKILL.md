---
name: pwa-dexie-workflow
description: >-
  Use this skill when managing offline-first persistence, updating Dexie.js (IndexedDB) database schemas,
  handling migrations, compressing mnemotechnic images to WebP, or configuring Google Drive serverless backups.
---

# Flujo Offline-First: Dexie.js, WebP y Google Drive

Esta habilidad guía el manejo del almacenamiento persistente local en IndexedDB y la sincronización serverless de Rubik BLD.

---

## 1. Reglas de Versionado en Dexie.js

Toda la persistencia se gestiona en [src/db/index.ts](file:///home/edgar/dev/projets/rubikbld/src/db/index.ts).

### ⚠️ Regla Crítica de Migración
- **NUNCA modificar un bloque `.version(N)` existente**, ya que corrompería las bases de datos de clientes existentes en producción.
- Para agregar o modificar índices y tablas, declarar un nuevo número de versión:

```typescript
// Ejemplo de incremento de versión
this.version(3).stores({
  schemes: '&id, name, gridSize',
  pairs: '&id, pair, usage, firstLetter, secondLetter, word, updatedAt',
  cards: '&id, pair, usage, state, due, interval',
  reviews: '++id, cardId, pair, rating, timestamp',
  settings: '&key',
  // Nueva tabla o nuevos índices aquí
}).upgrade(tx => {
  // Opcional: Lógica de transformación de datos existente
})
```

---

## 2. Pipeline de Compresión de Imágenes a WebP

Para evitar el agotamiento de memoria en IndexedDB y mantener los backups ligeros:
- Utilizar `compressImageToWebP(blobOrFile, maxWidth = 400, quality = 0.8)` de [src/services/imageStorage.ts](file:///home/edgar/dev/projets/rubikbld/src/services/imageStorage.ts).
- Las imágenes nunca deben almacenarse como PNG o JPEG crudos.
- El formato almacenado en `PairItem.image` es un DataURL `data:image/webp;base64,...`.

---

## 3. Respaldo Serverless con Google Drive

Ubicado en [src/services/googleDrive.ts](file:///home/edgar/dev/projets/rubikbld/src/services/googleDrive.ts):
- Archivo de respaldo: `rubikbld_backup.json` en la carpeta `drive.file` del usuario.
- Formato del payload:
```json
{
  "version": 2,
  "timestamp": 1728360000000,
  "data": {
    "schemes": [...],
    "pairs": [...],
    "cards": [...],
    "reviews": [...],
    "settings": [...]
  }
}
```
- Antes de restaurar un respaldo, se realiza un backup preventivo en memoria y se limpian las tablas locales para evitar colisiones de IDs obsoletos.

---

## 4. Service Worker y PWA

Configurado en [vite.config.ts](file:///home/edgar/dev/projets/rubikbld/vite.config.ts) mediante `vite-plugin-pwa`:
- Cacheo de fuentes de Google Fonts (`Inter`, `Outfit`).
- Cacheo de iconos SVG y recursos estáticos con estrategia `CacheFirst` y `StaleWhileRevalidate`.
- Al realizar cambios críticos en assets o modelos, verificar el build de producción con:
```bash
npm run build
```
