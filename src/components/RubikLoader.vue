<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  label?: string
  size?: number
  variant?: '3d' | 'logo'
  blindfold?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  size: 84,
  variant: '3d',
  blindfold: true,
})

const S = 28
const POS = [-S, 0, S]
const DARK = '#18181b'

// Paleta alegre inspirada en cubo.png para la cara frontal
const LOGO_FRONT_COLORS: Record<string, string> = {
  '0,0': '#38bdf8', // Azul cielo
  '1,0': '#facc15', // Amarillo cálido
  '2,0': '#f43f5e', // Rosa / Rose
  '0,1': '#22c55e', // Verde esmeralda
  '1,1': '#ffffff', // Blanco central (lleva la sonrisa)
  '2,1': '#f97316', // Naranja vivo
  '0,2': '#f43f5e', // Rosa / Rose
  '1,2': '#facc15', // Amarillo cálido
  '2,2': '#38bdf8', // Azul cielo
}

const FACES = [
  {
    key: 'front',
    transform: `translateZ(${S / 2}px)`,
    color: (x: number, y: number, z: number) => {
      if (z === 2) {
        return props.blindfold ? (LOGO_FRONT_COLORS[`${x},${y}`] || '#22c55e') : '#2ea043'
      }
      return DARK
    },
  },
  {
    key: 'back',
    transform: `rotateY(180deg) translateZ(${S / 2}px)`,
    color: (_x: number, _y: number, z: number) => (z === 0 ? '#38bdf8' : DARK),
  },
  {
    key: 'right',
    transform: `rotateY(90deg) translateZ(${S / 2}px)`,
    color: (x: number) => (x === 2 ? '#f43f5e' : DARK),
  },
  {
    key: 'left',
    transform: `rotateY(-90deg) translateZ(${S / 2}px)`,
    color: (x: number) => (x === 0 ? '#f97316' : DARK),
  },
  {
    key: 'top',
    transform: `rotateX(90deg) translateZ(${S / 2}px)`,
    color: (_x: number, y: number) => (y === 0 ? '#ffffff' : DARK),
  },
  {
    key: 'bottom',
    transform: `rotateX(-90deg) translateZ(${S / 2}px)`,
    color: (_x: number, y: number) => (y === 2 ? '#facc15' : DARK),
  },
] as const

const ROWS = [0, 1, 2]

function miniStyle(x: number, y: number, z: number) {
  return {
    transform: `translate3d(${POS[x]}px, ${POS[y]}px, ${POS[z]}px)`,
  }
}

function faceStyle(_x: number, _y: number, _z: number, transform: string, color: string) {
  return { transform, background: color }
}

function faceColor(x: number, y: number, z: number, faceIndex: number): string {
  const f = FACES[faceIndex]
  return f.color(x, y, z)
}

const scaleRatio = computed(() => props.size / 84)
</script>

<template>
  <div class="flex flex-col items-center gap-4 select-none" :style="{ '--cube-size': size + 'px' }">
    <!-- MODO 1: CUBO 3D CON ANTIFAZ Y CORREAS 3D (POR DEFECTO) -->
    <div v-if="variant === '3d'" class="cube-wrap">
      <div
        class="cube-scale"
        :style="{ transform: size !== 84 ? `scale(${scaleRatio})` : undefined }"
      >
        <div class="cube">
          <div v-for="y in ROWS" :key="y" class="row" :class="`row-${y + 1}`">
            <!-- Piezas del cubo (Mini cubos) -->
            <div
              v-for="x in ROWS"
              :key="`x${x}z0`"
              class="mini"
              :style="miniStyle(x, y, 0)"
            >
              <span
                v-for="(f, i) in FACES"
                :key="f.key"
                class="face"
                :style="faceStyle(x, y, 0, f.transform, faceColor(x, y, 0, i))"
              ></span>
            </div>

            <div
              v-for="x in ROWS"
              :key="`x${x}z1`"
              class="mini"
              :style="miniStyle(x, y, 1)"
            >
              <span
                v-for="(f, i) in FACES"
                :key="f.key"
                class="face"
                :style="faceStyle(x, y, 1, f.transform, faceColor(x, y, 1, i))"
              ></span>
            </div>

            <div
              v-for="x in ROWS"
              :key="`x${x}z2`"
              class="mini"
              :style="miniStyle(x, y, 2)"
            >
              <span
                v-for="(f, i) in FACES"
                :key="f.key"
                class="face"
                :style="faceStyle(x, y, 2, f.transform, faceColor(x, y, 2, i))"
              >
                <!-- Sonrisa adorable del sticker frontal blanco (x:1, y:1, z:2) -->
                <span
                  v-if="blindfold && f.key === 'front' && x === 1 && y === 1"
                  class="smile-container"
                >
                  <svg viewBox="0 0 16 10" width="12" height="7" class="smile-svg">
                    <path
                      d="M 2 2 Q 8 9 14 2"
                      stroke="#111827"
                      stroke-width="2.6"
                      stroke-linecap="round"
                      fill="none"
                    />
                  </svg>
                </span>
              </span>
            </div>

            <!-- ANTIFAZ 3D & CORREAS ENVOLVENTES EN LA CAPA MEDIA (y === 1) -->
            <template v-if="blindfold && y === 1">
              <!-- Antifaz frontal -->
              <div class="blindfold-front">
                <svg
                  viewBox="0 0 96 38"
                  width="96"
                  height="38"
                  class="blindfold-svg"
                >
                  <defs>
                    <linearGradient id="maskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#3f3f46" />
                      <stop offset="35%" stop-color="#27272a" />
                      <stop offset="100%" stop-color="#09090b" />
                    </linearGradient>
                  </defs>

                  <!-- Hebilla / pasador lateral izquierdo -->
                  <rect
                    x="1"
                    y="14"
                    width="7"
                    height="10"
                    rx="2.5"
                    fill="#18181b"
                    stroke="#52525b"
                    stroke-width="1.2"
                  />
                  <line
                    x1="4.5"
                    y1="16"
                    x2="4.5"
                    y2="22"
                    stroke="#71717a"
                    stroke-width="1.2"
                  />

                  <!-- Hebilla / pasador lateral derecho -->
                  <rect
                    x="88"
                    y="14"
                    width="7"
                    height="10"
                    rx="2.5"
                    fill="#18181b"
                    stroke="#52525b"
                    stroke-width="1.2"
                  />
                  <line
                    x1="91.5"
                    y1="16"
                    x2="91.5"
                    y2="22"
                    stroke="#71717a"
                    stroke-width="1.2"
                  />

                  <!-- Silueta orgánica del antifaz (con escote para la nariz y sonrisa) -->
                  <path
                    d="M 12 19
                       C 8 13, 14 3, 29 3
                       C 40 3, 44 9, 48 15
                       C 52 9, 56 3, 67 3
                       C 82 3, 88 13, 84 19
                       C 88 27, 78 35, 65 35
                       C 55 35, 52 27, 48 24
                       C 44 27, 41 35, 31 35
                       C 18 35, 8 27, 12 19 Z"
                    fill="url(#maskGrad)"
                    stroke="#09090b"
                    stroke-width="2"
                    stroke-linejoin="round"
                  />

                  <!-- Brillo superior satinado (curvatura 3D) -->
                  <path
                    d="M 17 15
                       C 18 9, 22 6, 29 6
                       C 37 6, 41 10, 45 15
                       M 51 15
                       C 55 10, 59 6, 67 6
                       C 74 6, 78 9, 79 15"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.22)"
                    stroke-width="1.2"
                    stroke-linecap="round"
                  />
                </svg>
              </div>

              <!-- Correas laterales y trasera en 3D -->
              <div class="blindfold-strap strap-right"></div>
              <div class="blindfold-strap strap-left"></div>
              <div class="blindfold-strap strap-back">
                <div class="strap-buckle"></div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- MODO 2: LOGO OFICIAL CON ANIMACIÓN FLOTANTE Y AURA -->
    <div
      v-else-if="variant === 'logo'"
      class="logo-loader-wrap"
      :style="{ width: size + 'px', height: size + 'px' }"
    >
      <div class="logo-pulse-ring"></div>
      <img
        src="/cubo_transparente.png"
        alt="Memo Cube"
        class="logo-img"
        :style="{ width: size + 'px', height: size + 'px' }"
      />
    </div>

    <!-- Etiqueta de texto descriptivo -->
    <p v-if="label" class="text-sm text-slate-400 font-medium text-center tracking-wide">
      {{ label }}
    </p>
  </div>
</template>

<style scoped>
/* ==========================================================================
   ESTRUCTURA 3D DEL CUBO DE RUBIK
   ========================================================================== */
.cube-wrap {
  width: var(--cube-size);
  height: var(--cube-size);
  perspective: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cube-scale {
  width: 84px;
  height: 84px;
  position: relative;
  transform-style: preserve-3d;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: 50% 50% 50%;
}

.cube {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  animation: rubik-spin 7s linear infinite;
  transform-origin: 50% 50% 50%;
}

@keyframes rubik-spin {
  0% {
    transform: rotateX(-35deg) rotateY(0deg);
  }
  25% {
    transform: rotateX(-15deg) rotateY(90deg);
  }
  50% {
    transform: rotateX(-35deg) rotateY(180deg);
  }
  75% {
    transform: rotateX(-15deg) rotateY(270deg);
  }
  100% {
    transform: rotateX(-35deg) rotateY(360deg);
  }
}

.row {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transform-origin: 50% 50% 50%;
}

.row-1 {
  animation: layer-y 3.5s linear infinite;
}
.row-3 {
  animation: layer-y-rev 3.5s linear infinite -1.75s;
}

@keyframes layer-y {
  0% {
    transform: rotateY(0deg);
  }
  100% {
    transform: rotateY(360deg);
  }
}

@keyframes layer-y-rev {
  0% {
    transform: rotateY(0deg);
  }
  100% {
    transform: rotateY(-360deg);
  }
}

.mini {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 28px;
  height: 28px;
  margin: -14px 0 0 -14px;
  transform-style: preserve-3d;
}

.face {
  position: absolute;
  inset: 1px;
  border-radius: 4px;
  border: 1.2px solid #111827;
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 0.4),
    inset 0 -1px 2px rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Sonrisa en la pieza central */
.smile-container {
  position: absolute;
  bottom: 2px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}

/* ==========================================================================
   ANTIFAZ Y CORREAS 3D (ESTILO CUBO.PNG)
   ========================================================================== */
.blindfold-front {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 96px;
  height: 38px;
  margin-left: -48px;
  margin-top: -24px;
  transform: translateZ(43.5px);
  transform-style: preserve-3d;
  pointer-events: none;
  filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.5));
}

.blindfold-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.blindfold-strap {
  background: linear-gradient(180deg, #27272a 0%, #18181b 50%, #09090b 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  border-bottom: 1px solid rgba(0, 0, 0, 0.6);
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.strap-right {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 84px;
  height: 12px;
  margin-left: -42px;
  margin-top: -6px;
  transform: rotateY(90deg) translateZ(42.5px);
}

.strap-left {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 84px;
  height: 12px;
  margin-left: -42px;
  margin-top: -6px;
  transform: rotateY(-90deg) translateZ(42.5px);
}

.strap-back {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 84px;
  height: 12px;
  margin-left: -42px;
  margin-top: -6px;
  transform: rotateY(180deg) translateZ(42.5px);
}

.strap-buckle {
  width: 13px;
  height: 13px;
  background: #27272a;
  border: 1.5px solid #52525b;
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  position: relative;
}
.strap-buckle::after {
  content: '';
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 4px;
  right: 4px;
  background: #18181b;
  border-radius: 1px;
}

/* ==========================================================================
   MODO LOGO ILUSTRADO
   ========================================================================== */
.logo-loader-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-img {
  position: relative;
  z-index: 2;
  object-fit: contain;
  animation: logoBounce 2.4s ease-in-out infinite;
  filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.45));
}

.logo-pulse-ring {
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, rgba(244, 63, 94, 0.15) 50%, transparent 70%);
  animation: auraPulse 2.4s ease-in-out infinite;
  z-index: 1;
}

@keyframes logoBounce {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-8px) scale(1.03);
  }
}

@keyframes auraPulse {
  0%, 100% {
    transform: scale(0.9);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.85;
  }
}
</style>
