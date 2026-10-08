# Guía de Contribución a Rubik BLD Flashcards 🧩

¡Gracias por tu interés en colaborar con **Rubik BLD Flashcards**! Este proyecto es de código abierto y está creado por y para la comunidad de competidores de **3x3 a Ciegas (3BLD)**.

Para mantener la calidad, robustez offline y consistencia del proyecto, todos los colaboradores y revisores seguimos los estándares descritos en esta guía.

---

## 🧭 1. Principios Fundamentales del Proyecto

Cualquier cambio propuesto debe alinearse con estos tres pilares arquitectónicos:

1. **Mobile-First con Uso a Una Sola Mano**:
   - Diseñado ergonómicamente para que el competidor pueda sostener el cubo de Rubik con una mano y operar la aplicación con el pulgar de la otra.
   - Zonas táctiles mínimas de **44px × 44px**.
   - Acciones principales accesibles en la parte inferior de la pantalla.
2. **100% Offline-First**:
   - La aplicación debe funcionar sin internet desde el primer milisegundo.
   - Todo el estado, progreso SRS y tarjetas residen en **IndexedDB** a través de **Dexie.js**.
   - Sincronización serverless opcional vía Google Drive (`rubikbld_backup.json`), sin backend ni costos de servidor.
3. **Optimización Extrema de Almacenamiento**:
   - Las imágenes mnemotécnicas deben comprimirse obligatoriamente a **WebP** antes de persistirse localmente. Nunca almacenar cadenas Base64 masivas de imágenes PNG o JPEG sin comprimir.

---

## 🛠️ 2. Configuración del Entorno Local

### Requisitos Previos
- **Node.js**: Versión 18 o superior (recomendado Node 20 LTS o 22 LTS).
- **npm**: Versión 9 o superior.
- **Git** instalado en tu sistema.

### Pasos de Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/EDGAR-BRI/rubikbld.git
cd rubikbld

# 2. Instalar dependencias
npm install

# 3. Configurar los Git Hooks del repositorio (auto-versionamiento y bloqueo de secretos)
npm run prepare

# 4. Iniciar el servidor local de desarrollo con Vite
npm run dev
```

El servidor estará disponible usualmente en `http://localhost:5173`.

---

## 🌿 3. Flujo de Trabajo en Git

1. **Crear una rama de trabajo**:
   - Para nuevas funciones: `feat/nombre-de-la-mejora`
   - Para corrección de errores: `fix/nombre-del-bug`
   - Para refactorizaciones: `refactor/nombre-del-modulo`
   - Para documentación: `docs/tema-actualizado`

2. **Convención de Commits (Conventional Commits)**:
   El proyecto utiliza un hook automatizado (`scripts/auto-version-hook.mjs`) que gestiona el versionado semántico y genera el registro de cambios. **Todos los commits deben seguir Conventional Commits**:

   ```text
   <tipo>(<alcance opcional>): <descripción concisa en minúsculas>
   ```

   ### Tipos Válidos:
   - `feat:` Nueva funcionalidad para el usuario (incrementa versión *Minor*).
   - `fix:` Corrección de un error o bug (incrementa versión *Patch*).
   - `refactor:` Reestructuración de código sin cambiar la funcionalidad externa (incrementa *Patch*).
   - `style:` o `ui:` Cambios en la interfaz visual, estilos CSS o espaciado (incrementa *Patch*).
   - `perf:` Optimización de rendimiento o consumo de recursos (incrementa *Patch*).
   - `docs:` Cambios o mejoras exclusivas en la documentación (incrementa *Patch*).
   - `chore:` Tareas de mantenimiento, dependencias o configuración de build.
   - `breaking:` o sufijo `!:` Cambio mayor que rompe compatibilidad hacia atrás (incrementa *Major*).

   ### Ejemplos Válidos:
   ```bash
   git commit -m "feat(study): agregar atajo de teclado para marcar tarjeta difícil"
   git commit -m "fix(scheme): evitar selección de pegatinas pertenecientes a la misma arista"
   git commit -m "refactor(dexie): centralizar consultas de tarjetas vencidas"
   git commit -m "docs: actualizar instrucciones de sincronización con drive"
   ```

3. **Bloqueo de Secretos y Credenciales**:
   El hook de pre-commit analiza los cambios y **bloqueará cualquier commit** que contenga tokens privados, claves de API (Google, AWS, GitHub, Stripe) o claves criptográficas. Nunca agregues credenciales al código fuente.

---

## 📐 4. Estándares de Código y Arquitectura

### 4.1 Vue 3 & TypeScript
- Usar siempre la sintaxis `<script setup lang="ts">`.
- Tipado estricto: **prohibido el uso de `any`**.
- Define las interfaces y tipos compartidos en [`src/models/`](file:///home/edgar/dev/projets/rubikbld/src/models/).
- Emplea `defineProps<{ ... }>()` y `defineEmits<{ ... }>()` con tipado TypeScript en lugar de objetos en tiempo de ejecución.

### 4.2 Componentes UI Reutilizables
Antes de crear nuevos botones, modales, etiquetas o campos de texto, utiliza los componentes existentes en [`src/components/ui/`](file:///home/edgar/dev/projets/rubikbld/src/components/ui/):
- [`AppButton.vue`](file:///home/edgar/dev/projets/rubikbld/src/components/ui/AppButton.vue): Botón principal con variantes de estilo, tamaños y soporte para iconos.
- [`AppBadge.vue`](file:///home/edgar/dev/projets/rubikbld/src/components/ui/AppBadge.vue): Indicadores de estado con la paleta de colores del cubo.
- [`AppModal.vue`](file:///home/edgar/dev/projets/rubikbld/src/components/ui/AppModal.vue): Modales accesibles y adaptados a pantallas móviles.
- [`AppInput.vue`](file:///home/edgar/dev/projets/rubikbld/src/components/ui/AppInput.vue): Campos de formulario estilizados.
- [`BottomNav.vue`](file:///home/edgar/dev/projets/rubikbld/src/components/ui/BottomNav.vue): Barra fija de navegación ergonómica.

### 4.3 Base de Datos Dexie.js (IndexedDB)
- Toda persistencia local se gestiona en [`src/db/index.ts`](file:///home/edgar/dev/projets/rubikbld/src/db/index.ts).
- **Regla de Oro de Migraciones**: **NUNCA alteres una versión previa de Dexie**.
  Si requieres agregar una nueva tabla o cambiar los índices de una existente:
  ```ts
  // Correcto: Añadir un nuevo bloque de versión incremental
  this.version(2).stores({
    pairs: 'id, pair, letter1, letter2, category, isConfigured',
    cards: 'id, pairId, state, nextReview, interval, reps',
    reviews: 'id, cardId, timestamp',
    nuevaTabla: 'id, timestamp'
  });
  ```

### 4.4 Reglas del Dominio 3BLD (Blindfolded)
- **Esquema de Caras**: `U` (Blanco), `L` (Naranja), `F` (Verde), `R` (Rojo), `B` (Azul), `D` (Amarillo).
- **Stickers por Cara**: 9 stickers (0 a 8 en orden de lectura).
- **Dígrafos en Español**: Soporte nativo para dígrafos como `'CH'` y letras especiales como `'Ñ'`. Utiliza siempre [`splitPair()`](file:///home/edgar/dev/projets/rubikbld/src/models/cube.ts) y [`isLetterToken()`](file:///home/edgar/dev/projets/rubikbld/src/models/cube.ts) para descomponer pares.
- **Filtro de Imposibilidad Física**: Dos pegatinas que pertenezcan a la misma pieza física (ej. arista con 2 pegatinas o esquina con 3 pegatinas) **nunca** pueden formar un par de letras.
- **Buffers**: El buffer de aristas por defecto es `UF` y el de esquinas es `UFR`. Al modificar un buffer, todas sus pegatinas físicas quedan excluidas de los pares (`cleanSchemeBufferLetters()`).

---

## 📋 5. Estándares para Crear Issues

Antes de abrir una Issue en GitHub:
1. Revisa las Issues existentes (tanto abiertas como cerradas) para verificar que el tema no se haya tratado antes.
2. Utiliza las plantillas interactivas disponibles:
   - **🐛 Reporte de Error (Bug)**: Incluye pasos detallados para reproducir, dispositivo, navegador y si ocurre offline u online.
   - **💡 Propuesta de Mejora (Feature Request)**: Explica el caso de uso en 3BLD, la solución propuesta y cómo se adapta a la experiencia mobile-first.
   - **❓ Pregunta o Consulta**: Dudas sobre esquemas Speffz, configuración de buffers o importación de mazos Anki.

---

## 🚀 6. Estándares para Crear Pull Requests (PRs)

1. **Verificación Local Obligatoria**:
   Antes de hacer push y abrir tu PR, ejecuta en tu terminal:
   ```bash
   npm run build
   ```
   Este comando ejecuta `vue-tsc -b` (verificación de tipos de TypeScript) y `vite build` (empaquetado y generación del Service Worker PWA). Si hay algún error de tipos o advertencia bloqueante, corrígelo antes de enviar el PR.

2. **Título del Pull Request**:
   El título del PR debe comenzar con el prefijo Conventional Commit correspondiente:
   - Ejemplo: `feat(study): añadir animación de rebote al acertar una tarjeta`
   - Ejemplo: `fix(anki): soportar caracteres especiales en la descompresión de notas`

3. **Completar la Plantilla de PR**:
   GitHub cargará automáticamente la plantilla [`.github/PULL_REQUEST_TEMPLATE.md`](file:///home/edgar/dev/projets/rubikbld/.github/PULL_REQUEST_TEMPLATE.md).
   - Describe con claridad el problema y la solución.
   - Vincula la Issue que resuelve (`Closes #123`).
   - Adjunta capturas o video de antes y después si modificaste la interfaz.
   - Marca todas las casillas de la lista de verificación (checklist).

---

## 🤝 7. Proceso de Revisión

- Los mantenedores revisarán tu Pull Request prestando atención a la robustez offline, la ergonomía móvil y la limpieza del código TypeScript.
- Si se solicitan cambios, responde amablemente a los comentarios y sube nuevos commits a la misma rama; el PR se actualizará automáticamente.
- Una vez aprobado, tu cambio será integrado en la rama principal (`main`) y formará parte de la próxima versión de Rubik BLD.

¡Gracias por ayudar a que la comunidad de cuberos 3BLD entrene de forma más eficiente! 🧠⚡
