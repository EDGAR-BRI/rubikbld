# Rubik BLD Flashcards (PWA) — Guía para Agentes de IA (AGENTS.md)

Este repositorio contiene **Rubik BLD Flashcards**, una Progressive Web App (PWA) móvil primero diseñada para que competidores de Cubo de Rubik en la categoría **3x3 a Ciegas (Blindfolded / 3BLD)** memoricen y entrenen sus pares de letras (esquema Speffz o personalizado) mediante **Repetición Espaciada (SRS estilo Anki / SM-2)** y visualización 3D interactiva.

---

## 1. Misión y Principios de Diseño

1. **Mobile-First con Uso a Una Mano**:
   - Diseñado para usarse con el smartphone en una mano mientras la otra sostiene o manipula el cubo de Rubik.
   - Navegación fija inferior (`BottomNav.vue`), zonas táctiles amplias (mínimo 44px), botones de calificación accesibles con el pulgar.
   - Interfaz con temática oscura premium inspirada en los colores de las caras del cubo (`FACE_COLORS`).

2. **100% Offline-First**:
   - La aplicación debe funcionar sin conexión a internet desde el primer segundo.
   - Todo el estado, progreso SRS, imágenes e historial residen en **IndexedDB** a través de **Dexie.js**.
   - Sincronización serverless opcional con Google Drive (`rubikbld_backup.json`) usando Google Identity Services (GIS), sin backend ni costos de servidor.

3. **Optimización Extrema de Almacenamiento**:
   - Las imágenes mnemotécnicas asociadas a cada par de letras deben comprimirse a **WebP** antes de persistirse en IndexedDB. Nunca almacenar Base64 de PNG/JPEG de alta resolución sin comprimir.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Notas / Configuración |
| :--- | :--- | :--- |
| **Framework** | Vue 3 (`<script setup lang="ts">`) | Composition API estricta, TypeScript |
| **Bundler** | Vite 6+ | Plugin `@vitejs/plugin-vue` |
| **Estilos** | Tailwind CSS v3 | Configurado en `tailwind.config.js` y `src/style.css` |
| **Iconografía** | Iconify (`@iconify/vue`) | Carga de iconos SVG bajo demanda |
| **Base de Datos** | Dexie.js (IndexedDB) | Singleton en `src/db/index.ts` con migraciones versionadas |
| **PWA** | `vite-plugin-pwa` | Service Worker Workbox, precaching offline |
| **Gestión de Estado**| Pinia + `@vueuse/core` | Stores modulares en `src/stores/` |
| **Visualización 3D**| CSS 3D Transforms / Vue | `Cube3D.vue` en `src/components/scheme/` |

---

## 3. Dominio Rubik BLD (Reglas de Negocio Críticas)

### 3.1 Esquema de Letras (Speffz y Variantes)
- **Caras**: `U` (Up/Blanco), `L` (Left/Naranja), `F` (Front/Verde), `R` (Right/Rojo), `B` (Back/Azul), `D` (Down/Amarillo).
- **Stickers por cara**: 9 stickers (0 a 8 en orden de lectura: fila superior 0-2, media 3-5, inferior 6-8).
- **Dígrafos y Español**: Soporte nativo para dígrafos como `'CH'` y letras como `'Ñ'`. Utilizar siempre `splitPair()` y `isLetterToken()` de `src/models/cube.ts` para descomponer pares en tokens de letras.

### 3.2 Buffers y Piezas
- **Buffer de Aristas por defecto**: `UF` (sticker `U7` o `F1`).
- **Buffer de Esquinas por defecto**: `UFR` (sticker `U8`, `F2` o `R0`).
- **Regla de Oro de Buffers**: La pieza del buffer y **todas** sus pegatinas asociadas en el cubo físico NO llevan letra y quedan excluidas de los pares de estudio. Al cambiar un buffer, se debe invocar `cleanSchemeBufferLetters()`.

### 3.3 Filtro de Imposibilidad Física
- Dos pegatinas que pertenezcan a la **misma pieza física** (por ejemplo, las 2 pegatinas de una misma arista o las 3 pegatinas de una misma esquina) **NUNCA** pueden formar un par de letras.
- `pairGenerator.ts` excluye automáticamente pares con stickers en la misma pieza y pares con la misma letra repetida (salvo casos de configuración específica).

---

## 4. Estructura de Directorios

```text
src/
├── assets/             # Recursos estáticos (logos, imágenes demo)
├── components/
│   ├── card/           # FlashCard.vue, RatingButtons.vue, ImagePicker.vue
│   ├── matrix/         # PairGrid.vue (matriz de pares), PairEditModal.vue
│   ├── scheme/         # Cube3D.vue (render interactivo 3D del cubo)
│   └── ui/             # AppButton, AppBadge, AppModal, AppInput, BottomNav, AppHeader
├── db/                 # Dexie.js (RubikBldDatabase) y syncPairsWithScheme
├── models/             # Tipado: cube.ts, pair.ts, card.ts
├── router/             # Vue Router (/study, /pairs, /scheme, /settings)
├── services/           # pairGenerator.ts, imageStorage.ts, googleDrive.ts
├── srs/                # algorithm.ts (cálculo de intervalos SM-2 / Anki)
├── stores/             # usePairsStore, useReviewStore, useSchemeStore, useSettingsStore
├── style.css           # Estilos globales y utilidades personalizadas
└── views/              # StudyView, PairsView, SchemeView, SettingsView
```

---

## 5. Directrices de Código y Buenas Prácticas

1. **TypeScript Estricto**:
   - Evitar el uso de `any`. Definir interfaces claras en `src/models/`.
   - Ejecutar `npm run build` (que corre `vue-tsc -b`) para verificar que no existan errores de tipos antes de dar una tarea por terminada.

2. **Componentes Vue**:
   - Usar `<script setup lang="ts">`.
   - Props declaradas con `defineProps<{ ... }>()` y eventos con `defineEmits<{ ... }>()`.
   - Reutilizar componentes base de `src/components/ui/` (`AppButton`, `AppModal`, `AppBadge`, etc.) en lugar de recrear botones o modales desde cero.

3. **Modificaciones en Dexie (IndexedDB)**:
   - Al alterar estructuras de datos de tablas, **nunca modificar versiones previas de Dexie**. Añadir un nuevo bloque `this.version(N).stores(...)` en `src/db/index.ts`.

4. **Flujo Git y Control de Versiones**:
   - El proyecto cuenta con un hook de auto-versionamiento (`scripts/auto-version-hook.mjs`).
   - Los mensajes de commit deben seguir la convención **Conventional Commits** (`feat: ...`, `fix: ...`, `refactor: ...`, `chore: ...`).
   - El hook bloquea commits que contengan secretos o tokens expuestos.

---

## 6. Habilidades Disponibles en `.agents/skills/`

- [anki-importer](file:///home/edgar/dev/projets/rubikbld/.agents/skills/anki-importer/SKILL.md): Extracción, descompresión zstd y mapeo de mazos de Anki (`.apkg`) a la base de datos de pares de la app.
- [rubik-bld-logic](file:///home/edgar/dev/projets/rubikbld/.agents/skills/rubik-bld-logic/SKILL.md): Reglas de negocio del cubo 3BLD, numeración Speffz, buffers y exclusión física.
- [pwa-dexie-workflow](file:///home/edgar/dev/projets/rubikbld/.agents/skills/pwa-dexie-workflow/SKILL.md): Persistencia offline, versiones Dexie, compresión WebP y sincronización serverless con Google Drive.
- [cube-3d-visualizer](file:///home/edgar/dev/projets/rubikbld/.agents/skills/cube-3d-visualizer/SKILL.md): Mantenimiento y extensión del visualizador 3D interactivo en CSS 3D (`Cube3D.vue`).

