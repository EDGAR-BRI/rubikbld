# Rubik BLD Flashcards (PWA) 🧩

Aplicación de entrenamiento y práctica de pares de letras para **Blindfolded (BLD)** con **Repetición Espaciada (SRS estilo AnkiDroid)**, diseñada como una **PWA móvil primero** (100% offline-first).

---

## 🚀 Características Principales

1. **Enfoque Móvil Primero (Mobile-First)**:
   - Diseñada para usarse con una sola mano al lado del cubo de Rubik.
   - Barra de navegación inferior (*Bottom Bar*) fija con indicadores de tarjetas pendientes.
   - Interfaz oscura premium con acentos de color de caras de Rubik.

2. **Pares de Letras Mnemotécnicos Individuales**:
   - Cada par de letras (`PJ`, `AB`, `CD`...) es una entidad propia donde el usuario define su **palabra clave** (ej. *Pijama*) e **imagen mnemotécnica**.
   - Compresor integrado a **WebP** para mantener las imágenes ultraligeras en el almacenamiento local.
   - Soporte para subir fotos, tomar con cámara, pegar desde el portapapeles o usar enlaces URL.

3. **Generación Automática de Tarjetas a partir del Esquema**:
   - Genera automáticamente los pares válidos para **Esquinas (Corners)** y **Aristas (Edges)** según el esquema Speffz o personalizado.
   - **Filtro físico del cubo**: Excluye automáticamente combinaciones físicamente imposibles (dos stickers pertenecientes a la misma pieza física) y los stickers del Buffer.

4. **Motor SRS Estilo Anki / SM-2**:
   - Colas de estudio: **Nuevas (Azul)**, **Aprendiendo (Naranja)** y **Vencidas (Verde)**.
   - Tarjetas interactivas 3D con animación de volteo (*Flip*).
   - Calificación de 4 botones:
     - **Otra vez (Again) [1]**
     - **Difícil (Hard) [2]**
     - **Bien (Good) [3]**
     - **Fácil (Easy) [4]**
   - Atajos de teclado: `Espacio` para voltear, `1-4` para calificar.
   - Filtro para estudiar solo pares que ya tienen palabra configurada o toda la baraja.

5. **100% Offline (PWA con Dexie.js / IndexedDB)**:
   - No depende de conexión para estudiar ni guardar progresos.
   - Instalable como app nativa en Android, iOS y escritorio.

6. **Sincronización Serverless con Google Drive**:
   - Guarda tu base de datos e imágenes en tu propio Google Drive (`rubikbld_backup.json`) usando Google Identity Services (GIS).
   - **$0 costo de servidores y total privacidad**: Sin necesidad de backend.

---

## 🛠️ Stack Tecnológico

- **Framework**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`, TypeScript)
- **Bundler**: [Vite](https://vitejs.dev/)
- **Estilos**: [Tailwind CSS v3](https://tailwindcss.com/)
- **Iconos**: [Iconify](https://iconify.design/) (`@iconify/vue`)
- **Base de Datos Local**: [Dexie.js](https://dexie.org/) (IndexedDB)
- **PWA**: [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) (Workbox)
- **Estado**: [Pinia](https://pinia.vuejs.org/) + [@vueuse/core](https://vueuse.org/)

---

## 💻 Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción (con Service Worker PWA)
npm run build
```

---

## 📁 Estructura del Proyecto

```
src/
├── components/
│   ├── card/          # FlashCard 3D, RatingButtons, ImagePicker
│   ├── matrix/        # PairGrid (matriz interactiva), PairEditModal
│   └── ui/            # AppButton, AppBadge, AppInput, AppModal, BottomNav, AppHeader
├── db/                # Instancia de Dexie.js y migración inicial
├── models/            # Tipos de Cubo (física 3D), Pares, Tarjetas SRS y Revisiones
├── router/            # Rutas de la app (Repasar, Pares, Esquema, Ajustes)
├── services/          # pairGenerator, googleDrive, imageStorage
├── srs/               # Algoritmo SM-2 / Anki de cálculo de intervalos
├── stores/            # useReviewStore, usePairsStore, useSchemeStore, useSettingsStore
└── views/             # StudyView, PairsView, SchemeView, SettingsView
```

---

## 🤝 Contribuciones y Estándares

¡Las contribuciones son bienvenidas! Para mantener la consistencia y estabilidad del proyecto:

- Consulta nuestra **[Guía de Contribución (CONTRIBUTING.md)](CONTRIBUTING.md)** para conocer los lineamientos de código, arquitectura offline-first y flujo de trabajo.
- Cumplimiento de **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `style:`, etc.) auditado mediante hooks automáticos de versionado.
- Plantillas estandarizadas para [Reportar un Bug](.github/ISSUE_TEMPLATE/bug_report.yml) y [Proponer una Mejora](.github/ISSUE_TEMPLATE/feature_request.yml).
- Revisa la [Plantilla de Pull Request](.github/PULL_REQUEST_TEMPLATE.md) con la lista de verificación antes de someter cambios.

