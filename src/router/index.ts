import { createRouter, createWebHistory } from 'vue-router'
import StudyView from '@/views/StudyView.vue'
import PairsView from '@/views/PairsView.vue'
import SchemeView from '@/views/SchemeView.vue'
import SettingsView from '@/views/SettingsView.vue'

const routes = [
  {
    path: '/',
    name: 'study',
    component: StudyView,
    meta: {
      title: 'Repaso SRS y Memorización',
      description: 'Entrena y memoriza tus pares de letras para 3x3 a Ciegas (3BLD) con Repetición Espaciada (SRS estilo Anki) y tarjetas interactivas.',
    },
  },
  {
    path: '/practice',
    name: 'practice',
    component: () => import('@/views/PracticeView.vue'),
    meta: {
      title: 'Práctica y Cronómetro 3BLD',
      description: 'Genera mezclas oficiales (scrambles), memoriza y cronometra tus resoluciones de Cubo de Rubik 3x3 a Ciegas con análisis de tiempos.',
    },
  },
  {
    path: '/pairs',
    name: 'pairs',
    component: PairsView,
    meta: {
      title: 'Catálogo de Pares de Letras',
      description: 'Explora y personaliza tu lista completa de pares de letras para esquinas y aristas. Asigna palabras clave e imágenes mnemotécnicas.',
    },
  },
  {
    path: '/scheme',
    name: 'scheme',
    component: SchemeView,
    meta: {
      title: 'Esquema de Letras 3D y Buffers',
      description: 'Configura tu esquema de letras (Speffz o personalizado) y stickers de buffer con un visualizador interactivo 3D del cubo de Rubik.',
    },
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
    meta: {
      title: 'Ajustes y Respaldo Cloud',
      description: 'Personaliza los parámetros del algoritmo SRS, velocidad de giroscopio, temas y realiza copias de seguridad en Google Drive.',
    },
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('@/views/PrivacyView.vue'),
    meta: {
      title: 'Política de Privacidad',
      description: 'Política de privacidad de Memo Cube. Almacenamiento 100% local en tu dispositivo y privacidad estricta con Google Drive.',
    },
  },
  {
    path: '/terms',
    name: 'terms',
    component: () => import('@/views/TermsView.vue'),
    meta: {
      title: 'Condiciones del Servicio',
      description: 'Términos y condiciones de uso de la aplicación Memo Cube para entrenamiento de Cubo de Rubik a Ciegas.',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Actualizar dinámicamente el título y descripción SEO en cada navegación
router.afterEach((to) => {
  const baseTitle = 'Memo Cube'
  if (to.meta.title) {
    document.title = `${to.meta.title} • ${baseTitle}`
  } else {
    document.title = `${baseTitle} — Entrenamiento 3x3 a Ciegas (3BLD) y Repetición Espaciada (SRS)`
  }

  if (to.meta.description) {
    const descMeta = document.querySelector('meta[name="description"]')
    if (descMeta) {
      descMeta.setAttribute('content', to.meta.description as string)
    }
    const ogDescMeta = document.querySelector('meta[property="og:description"]')
    if (ogDescMeta) {
      ogDescMeta.setAttribute('content', to.meta.description as string)
    }
  }
})
