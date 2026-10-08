<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppHeader from '@/components/ui/AppHeader.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'

const router = useRouter()

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/settings')
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-dark-950">
    <AppHeader title="Condiciones del Servicio" :show-back="true" @back="goBack" />

    <div class="flex-1 overflow-y-auto p-4 pb-28 max-w-2xl mx-auto w-full flex flex-col gap-6 text-sm leading-relaxed text-slate-300">
      <!-- Encabezado / Banner -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
            <AppIcon name="lucide:file-text" :size="20" />
          </div>
          <div>
            <h1 class="text-lg font-bold text-white">Condiciones del Servicio</h1>
            <p class="text-xs text-slate-400">Aplicación: Memo Cube</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 pt-2">
          <AppBadge variant="neutral" size="sm">Licencia MIT Código Abierto</AppBadge>
          <AppBadge variant="neutral" size="sm">Vigente: Octubre 2026</AppBadge>
        </div>
      </div>

      <!-- Sección 1: Aceptación de las Condiciones -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <AppIcon name="lucide:check" :size="18" class-name="text-green-400" />
          1. Aceptación de las Condiciones
        </h2>
        <p>
          Al acceder, instalar o utilizar <strong>Memo Cube</strong> (en adelante, "la Aplicación"), aceptas cumplir y quedar vinculado por las presentes Condiciones del Servicio. Si no estás de acuerdo con alguna de estas condiciones, no debes utilizar la Aplicación.
        </p>
      </div>

      <!-- Sección 2: Descripción del Servicio -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <AppIcon name="lucide:layers" :size="18" class-name="text-green-400" />
          2. Descripción del Servicio
        </h2>
        <p>
          <strong>Memo Cube</strong> es una Aplicación Web Progresiva (PWA) diseñada para competidores y aficionados al Cubo de Rubik en la categoría 3x3 a Ciegas (3BLD). Proporciona herramientas de:
        </p>
        <ul class="list-disc list-inside space-y-1 pl-2 text-slate-300">
          <li>Gestión y personalización de esquemas de letras de caras y pegatinas (Speffz o variantes).</li>
          <li>Asociación mnemotécnica de pares de letras con palabras e imágenes.</li>
          <li>Entrenamiento interactivo mediante tarjetas con algoritmo de repetición espaciada (SRS).</li>
          <li>Visualizador interactivo 3D del cubo.</li>
          <li>Sincronización y respaldo opcional y directo en la cuenta de Google Drive del usuario.</li>
        </ul>
      </div>

      <!-- Sección 3: Contenido del Usuario y Propiedad Intelectual -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <AppIcon name="lucide:sparkles" :size="18" class-name="text-green-400" />
          3. Contenido del Usuario y Propiedad
        </h2>
        <p>
          Eres el único propietario de las imágenes, historias y palabras clave mnemotécnicas que crees o importes en la Aplicación. <strong>Memo Cube</strong> no reclama ninguna propiedad intelectual sobre tu contenido mnemotécnico.
        </p>
        <p>
          Es tu responsabilidad asegurarte de que las imágenes o contenidos que importes respeten los derechos de autor aplicables y no violen ninguna normativa legal.
        </p>
      </div>

      <!-- Sección 4: Integración con Servicios de Terceros (Google Drive) -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <AppIcon name="lucide:cloud" :size="18" class-name="text-green-400" />
          4. Integración con Google Drive
        </h2>
        <p>
          La función de respaldo en Google Drive se proporciona como una comodidad sin servidor. Al conectar tu cuenta de Google:
        </p>
        <ul class="list-disc list-inside space-y-1 pl-2 text-slate-300">
          <li>Reconoces que los servicios de Google se rigen por las <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" class="text-green-400 underline">Condiciones del Servicio de Google</a>.</li>
          <li>La Aplicación interactúa con tu Google Drive utilizando exclusivamente el permiso <code class="font-mono text-xs bg-dark-950 px-1 py-0.5 rounded text-green-200">drive.file</code>, limitando cualquier operación a los archivos creados por la propia Aplicación.</li>
          <li>Puedes revocar este acceso en cualquier momento desde los ajustes de la Aplicación o desde tu cuenta de Google.</li>
        </ul>
      </div>

      <!-- Sección 5: Exclusión de Garantías y Limitación de Responsabilidad -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <AppIcon name="lucide:alert-triangle" :size="18" class-name="text-amber-400" />
          5. Exclusión de Garantías (Software Libre)
        </h2>
        <p>
          La Aplicación se proporciona <strong>"TAL CUAL" ("AS IS")</strong> y <strong>"SEGÚN DISPONIBILIDAD"</strong>, sin garantías de ningún tipo, ya sean expresas o implícitas, según los términos de la Licencia MIT.
        </p>
        <p>
          Aunque la Aplicación está diseñada para maximizar la integridad de los datos mediante almacenamiento persistente IndexedDB y respaldos exportables, los desarrolladores no asumen responsabilidad por la pérdida eventual de datos debida a limpieza de caché del navegador, fallos del dispositivo o interrupciones de servicios de terceros. Te recomendamos realizar respaldos periódicos con la función de exportación JSON o sincronización con Google Drive.
        </p>
      </div>

      <!-- Sección 6: Licencia de Código Abierto -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <AppIcon name="lucide:code" :size="18" class-name="text-green-400" />
          6. Licencia de Código Abierto
        </h2>
        <p>
          El código fuente de la Aplicación se distribuye bajo la Licencia MIT de código abierto. Eres libre de inspeccionar, bifurcar (fork) o contribuir al desarrollo a través de nuestro repositorio público:
        </p>
        <a
          href="https://github.com/EDGAR-BRI/rubikbld"
          target="_blank"
          rel="noopener noreferrer"
          class="text-green-400 hover:underline flex items-center gap-1.5 font-medium"
        >
          <AppIcon name="lucide:github" :size="16" />
          <span>https://github.com/EDGAR-BRI/rubikbld</span>
        </a>
      </div>

      <!-- Sección 7: Modificaciones de las Condiciones -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <AppIcon name="lucide:history" :size="18" class-name="text-green-400" />
          7. Modificaciones
        </h2>
        <p>
          Nos reservamos el derecho de actualizar o modificar estas Condiciones del Servicio en cualquier momento. Cualquier cambio significativo se reflejará con la actualización de la fecha en la parte superior de esta página y en el registro de cambios (CHANGELOG) del repositorio.
        </p>
      </div>

      <!-- Botón Volver -->
      <div class="flex justify-center pt-2">
        <AppButton variant="secondary" size="md" icon="lucide:arrow-left" @click="goBack">
          Volver a Ajustes
        </AppButton>
      </div>
    </div>
  </div>
</template>
