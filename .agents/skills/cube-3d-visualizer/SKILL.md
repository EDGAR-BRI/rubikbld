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

El orden de lectura visual debe coincidir exactamente con el orden Speffz del modelo 2D (`0..8`):
- En la cara **Back (`B`)**: se invierten las columnas (`c = 2 - col`) para mantener la coherencia espacial con `Left` y `Right`.
- En la cara **Down (`D`)**: se ajusta la orientación vertical al mirar desde abajo para que coincida con la vista desplegada del cubo.

---

## 3. Controles e Interacción

- **Rotación orbital**: Puntero táctil o ratón modifica `rotX` y `rotY` con sensibilidad calibrada.
- **Detección de click vs arrastre**: Umbral de distancia (`totalDragDistance < 6px`) para distinguir si el usuario rotó la cámara o hizo tap para seleccionar y editar una pegatina.
- **Presets de vista**:
  - Vista Isométrica Estándar: `rotX: -22°`, `rotY: -32°` (muestra caras U, F, R).
  - Vistas directas: Frontal, Superior, Posterior, etc.
- **Giro automático**: `requestAnimationFrame` que incrementa suavemente `rotY`.

---

## 4. Reglas al Modificar el Componente

1. Mantener el rendimiento a 60 FPS evitando cálculos complejos dentro de `requestAnimationFrame`.
2. Conservar el soporte táctil `touch-action: none` y prevención de gestos por defecto del navegador.
3. Asegurar que las pegatinas del buffer continúen mostrando el indicador visual correspondiente (`isBuffer`) obtenido de `getBufferStickerInfo()`.
