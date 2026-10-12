---
name: cube-3d-visualizer
description: >-
  Use this skill when modifying, maintaining, or extending the interactive 3D Rubik's cube visualizer
  (Cube3D.vue), CSS 3D transforms, sticker projection coordinates, orbit controls, or face animation.
---

# Visualizador 3D Interactivo del Cubo de Rubik

Esta habilidad documenta la arquitectura del componente [Cube3D.vue](file:///home/edgar/dev/projets/rubikbld/src/components/scheme/Cube3D.vue), construido puramente con CSS 3D y Vue 3 Composition API sin dependencias pesadas de WebGL.

---

## 1. Geometría y Sistema de Coordenadas CSS 3D

El cubo se compone de 6 caras HTML situadas en un espacio `transform-style: preserve-3d`.

- Dimensión total de cara: `204px` (`3 * 60px` stickers + `2 * 6px` gaps + márgenes).
- `HALF_SIZE`: `102px` (la distancia del centro a cada cara en el eje Z).

### Transformaciones de las 6 Caras (`FACES_CONFIG`):
- **Front (F)**: `translateZ(102px)`
- **Back (B)**: `rotateY(180deg) translateZ(102px)`
- **Right (R)**: `rotateY(90deg) translateZ(102px)`
- **Left (L)**: `rotateY(-90deg) translateZ(102px)`
- **Up (U)**: `rotateX(90deg) translateZ(102px)`
- **Down (D)**: `rotateX(-90deg) translateZ(102px)`

---

## 2. Mapeo Matemático de Pegatinas (`getStickerIndex`)

El orden de lectura visual coincide en todas las 6 caras (`U`, `L`, `F`, `R`, `B`, `D`) empezando siempre con el índice `0` arriba a la izquierda:
- Cuadrícula 3x3: `row * 3 + col` (0..8).
- `row 0`: `0` (top-left), `1` (top), `2` (top-right).
- `row 1`: `3` (mid-left), `4` (center), `5` (mid-right).
- `row 2`: `6` (bottom-left), `7` (bottom), `8` (bottom-right).
- Se preserva la coherencia física 1:1 con los facelets de Kociemba y el algoritmo BLD.

---

## 3. Controles e Interacción

- **Rotación orbital**: Puntero táctil o ratón modifica `rotX` y `rotY` con sensibilidad calibrada.
- **Detección de click vs arrastre**: Umbral de distancia (`totalDragDistance < 6px`) para distinguir si el usuario rotó la cámara o hizo tap para seleccionar y editar una pegatina.
- **Presets de vista**:
  - Vista Isométrica Estándar: `rotX: -22°`, `rotY: -32°` (muestra caras U, F, R).
  - Vistas directas: Frontal, Superior, Posterior, etc.
- **Giro automático**: `requestAnimationFrame` que incrementa suavemente `rotY`.

---

## 4. Reglas de Rendimiento y Buenas Prácticas (60/120 FPS)

1. **Manipulación Directa del DOM vía RAF**:
   - Durante el arrastre orbital con puntero o dedo, **no mutar refs reactivos en cada evento `pointermove`**.
   - Acumular deltas y aplicar la transformación CSS directamente al elemento (`cubeRef.value.style.transform`) dentro de un único tick de `requestAnimationFrame` (`pendingMoveRaf`).
   - Sincronizar el estado reactivo (`rotX.value`, `rotY.value`) únicamente al soltar (`pointerup`).

2. **Memoización de Stickers (`computedFaces`)**:
   - Los datos de los 54 stickers (`colorBg`, `label`, `isBuffer`, `classes`, etc.) están precalculados en la computed `computedFaces`.
   - Durante la rotación o arrastre, `computedFaces` NO se re-ejecuta, evitando miles de llamadas a funciones y reduciendo la carga del Virtual DOM en un 90%.

3. **Aceleración por Hardware y Prevención de Recorte (Clipping)**:
   - **NUNCA usar `contain: paint` ni `contain: strict`** en `.scene-wrap`, `.cube-3d` ni `.cube-face`. En CSS 3D Transforms, `contain: paint` impone una máscara de recorte rectangular 2D (`overflow: clip`) que corta las esquinas y caras del cubo cuando gira o se proyecta en perspectiva.
   - Prefijos de WebKit: `-webkit-backface-visibility: hidden` y `-webkit-transform-style: preserve-3d`.
   - Limitar `:hover` a dispositivos con puntero preciso (`@media (hover: hover) and (pointer: fine)`) para prevenir parpadeos o saltos de layout durante el tacto móvil.
   - Detener el loop de `requestAnimationFrame` cuando `autoSpin` esté desactivado.

---

## 5. Pistas Perimetrales de Capas Adyacentes (Estilo csTimer)

Para facilitar la memorización en BLD sin necesidad de rotar constantemente el cubo al estar de frente a una cara:
- Cada cara proyecta 12 pestañas perimetrales (`adjacent-tabs-top`, `adjacent-tabs-bottom`, `adjacent-tabs-left`, `adjacent-tabs-right`) cuando es la cara frontal (`isFaceFrontal`).
- Las pestañas se precalculan de forma memoizada en `computedFaces` usando `FACE_NEIGHBORS` y `STATIC_ADJACENT_MAPPING`.
- Reflejan con precisión física el color de la pegatina contigua de cada arista y las dos pegatinas contiguas de cada esquina.
- **Navegación Táctil**: Al pulsar sobre cualquier pestaña adyacente (`onTabClick`), el cubo gira suavemente (`snapToFace`) hacia la cara correspondiente.
- **Control de Visibilidad**: Toggleable desde la barra superior de herramientas con el botón de capas (`lucide:layers`).


