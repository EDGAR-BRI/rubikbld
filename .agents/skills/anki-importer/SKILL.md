---
name: anki-importer
description: >-
  Use this skill when the user asks to import, extract, inspect, or synchronize Anki decks
  (.apkg, .colpkg, or exported formats) into the Rubik BLD letter pairs database and Dexie storage.
---

# Anki Deck Importer para Rubik BLD

Esta habilidad permite inspeccionar, extraer y transformar mazos de tarjetas de Anki (`.apkg` o `.colpkg`) para sincronizarlos con la base de datos Dexie de la aplicación Rubik BLD, mapeando pares de letras, palabras mnemotécnicas e imágenes comprimidas a WebP.

---

## 1. Características y Retos de los Archivos `.apkg`

1. **Compresión zstd**: Los archivos generados por versiones recientes de Anki (2.1.50+) comprimen la base de datos interna `collection.anki21b` y la tabla `media` utilizando **zstandard (zstd)** en lugar de deflate simple.
2. **Normalización de Pares**:
   - En BLD en español se utilizan letras simples (`A-X`), dígrafos como `CH` y la letra `Ñ`.
   - Las tarjetas de Anki a menudo vienen con etiquetas HTML (`<h1>A - B</h1>`), espacios o guiones.
3. **Optimización de Imágenes**:
   - Anki guarda imágenes originales (JPEG, PNG). Para el almacenamiento local de Rubik BLD en IndexedDB, las imágenes deben convertirse a **WebP** antes de persistirse.

---

## 2. Flujo de Extracción

Se incluye un script ejecutable en [extract_apkg.py](./scripts/extract_apkg.py):

### Paso 1: Ejecutar la extracción del mazo
```bash
python3 .agents/skills/anki-importer/scripts/extract_apkg.py <archivo.apkg> <salida.json> <dir_imagenes>
```

Ejemplo con el mazo del proyecto:
```bash
python3 .agents/skills/anki-importer/scripts/extract_apkg.py "Notas seleccionadas-20261008000433.apkg" pairs_seed.json public/extracted_media
```

### Paso 2: Estructura del JSON resultante
```json
[
  {
    "id": "AB",
    "pair": "AB",
    "firstLetter": "A",
    "secondLetter": "B",
    "word": "Ábaco",
    "imageFilename": "abaco_7169.jpg",
    "updatedAt": 0
  }
]
```

### Paso 3: Integración en la Base de Datos Dexie
Para inyectar estos pares directamente en Dexie o sincronizarlos:
1. Usar la función `db.pairs.bulkPut(pairsList)`.
2. Para cada imagen, leer el archivo o blob y pasarlo por `compressImageToWebP(blob, 400, 0.8)` de `src/services/imageStorage.ts`.
3. Almacenar el dataUrl resultante en el campo `image` del par (`PairItem`).
4. Si las tarjetas SRS no existen para esos pares, llamar a `syncPairsWithScheme(currentScheme)` para que se generen las entradas en `db.cards`.

---

## 3. Comprobaciones y Validación

- Asegurarse de que no se agreguen pares con letras iguales si representan una imposibilidad física en la misma pieza.
- Verificar que el conteo de pares resultante coincida con el total esperado en `src/stores/usePairsStore.ts`.
