## 📌 Descripción del Cambio
<!--
Explica de manera concisa qué cambios introduce este Pull Request, qué problema resuelve o qué funcionalidad agrega.
-->

## 🔗 Issue Relacionada
<!--
Vincula la Issue asociada usando palabras clave como:
Closes #123 / Fixes #123 / Refs #123
-->
Closes #

---

## 🏷️ Tipo de Cambio
<!-- Marca con una [x] la opción que corresponda: -->
- [ ] 🚀 `feat`: Nueva funcionalidad
- [ ] 🐛 `fix`: Corrección de un error o bug
- [ ] ♻️ `refactor`: Refactorización de código sin alteración de comportamiento
- [ ] 💄 `style` / `ui`: Mejoras de diseño, temas o estilos CSS
- [ ] ⚡ `perf`: Optimización de rendimiento o almacenamiento
- [ ] 📝 `docs`: Modificaciones o adiciones en documentación
- [ ] 🔧 `chore`: Tareas de mantenimiento, dependencias o configuración

---

## 📱 Capturas de Pantalla / Demostración Visual (si aplica)
<!--
Si modificaste la interfaz de usuario (UI/UX), adjunta capturas de pantalla o un GIF/video comparando el antes y el después, especialmente en vista móvil.
-->
| Antes | Después |
| :---: | :---: |
| *(Captura previa)* | *(Captura con el cambio)* |

---

## 🧪 Pasos para Probar Manualmente
<!--
Indica los pasos exactos para que los revisores prueben tu cambio en su entorno local:
1. Ir a la vista '...'
2. Ejecutar la acción '...'
3. Verificar que '...'
-->
1. 
2. 
3. 

---

## ✅ Lista de Verificación (Checklist de Calidad Rubik BLD)
<!-- Marca con una [x] todas las verificaciones que hayas completado: -->

### Calidad de Código y Tipado
- [ ] **TypeScript Estricto**: Se ejecutó `npm run build` localmente y terminó sin errores (`vue-tsc -b` y Vite).
- [ ] No se utilizaron tipos `any` injustificados; se usaron o definieron interfaces en `src/models/`.
- [ ] Se reutilizaron los componentes base de `src/components/ui/` (`AppButton`, `AppBadge`, `AppModal`, etc.).

### Experiencia Mobile-First
- [ ] La interfaz se probó en resolución móvil emulada (360px - 412px de ancho).
- [ ] Las zonas táctiles interactivas cumplen con el tamaño mínimo accesible (al menos 44x44 px).
- [ ] La pantalla es operable cómodamente con una sola mano (acciones críticas en la parte inferior).

### Offline-First & Almacenamiento
- [ ] La aplicación sigue siendo **100% funcional sin conexión a Internet**.
- [ ] **Dexie.js (IndexedDB)**: Si se modificaron o agregaron tablas/índices en `src/db/index.ts`, **no se modificaron versiones anteriores** y se añadió un nuevo bloque `this.version(N)`.
- [ ] **Imágenes**: Todas las imágenes persistidas se procesan y comprimen en formato **WebP** antes de almacenarse en IndexedDB.

### Reglas de Negocio Rubik BLD
- [ ] No se rompen los filtros de piezas físicamente imposibles (piezas de la misma arista/esquina).
- [ ] Se respetan las exclusiones de pegatinas de buffer (`cleanSchemeBufferLetters()`).

### Git & Commits
- [ ] Los mensajes de los commits cumplen con la convención **Conventional Commits** (`feat:`, `fix:`, etc.).
- [ ] No se introducen archivos accidentales, dependencias no utilizadas ni credenciales/secretos expuestos.
