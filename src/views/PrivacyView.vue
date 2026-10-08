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
    <AppHeader title="Política de Privacidad" :show-back="true" @back="goBack" />

    <div class="flex-1 overflow-y-auto p-4 pb-28 max-w-2xl mx-auto w-full flex flex-col gap-6 text-sm leading-relaxed text-slate-300">
      <!-- Encabezado / Banner -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <AppIcon name="lucide:shield-check" :size="20" />
          </div>
          <div>
            <h1 class="text-lg font-bold text-white">Política de Privacidad</h1>
            <p class="text-xs text-slate-400">Aplicación: Memo Cube</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 pt-2">
          <AppBadge variant="success" size="sm">100% Sin Servidores Propios</AppBadge>
          <AppBadge variant="neutral" size="sm">Última actualización: Octubre 2026</AppBadge>
        </div>
      </div>

      <!-- Sección 1: Introducción y Filosofía -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <AppIcon name="lucide:info" :size="18" class-name="text-indigo-400" />
          1. Introducción y Filosofía de Privacidad
        </h2>
        <p>
          Bienvenido a <strong>Memo Cube</strong>. Esta aplicación web progresiva (PWA) está diseñada para ayudar a competidores de Cubo de Rubik en la categoría 3x3 a Ciegas (3BLD) a memorizar pares de letras mediante repetición espaciada (SRS).
        </p>
        <p>
          Nuestra filosofía fundamental es <strong>100% Offline-First y Cero Rastreo</strong>: creemos que tus métodos de memorización, imágenes y progreso te pertenecen exclusivamente a ti.
        </p>
      </div>

      <!-- Sección 2: Datos que recopilamos y dónde residen -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <AppIcon name="lucide:database" :size="18" class-name="text-indigo-400" />
          2. Datos Almacenados y Almacenamiento Local
        </h2>
        <p>
          Todos los datos de la aplicación se guardan únicamente de forma local en la memoria de tu dispositivo mediante <strong>IndexedDB</strong>:
        </p>
        <ul class="list-disc list-inside space-y-1 pl-2 text-slate-300">
          <li><strong>Esquemas de letras:</strong> Asignación de letras a piezas y stickers del cubo.</li>
          <li><strong>Pares de letras y mnemotecnias:</strong> Palabras clave, historias y notas asociadas a cada par.</li>
          <li><strong>Imágenes mnemotécnicas:</strong> Imágenes comprimidas en formato WebP en tu almacenamiento local.</li>
          <li><strong>Historial de estudio SRS:</strong> Intervalos de repaso, fechas de vencimiento y calificaciones de práctica.</li>
          <li><strong>Configuración:</strong> Preferencias de estudio e identificador de cliente OAuth si fue configurado.</li>
        </ul>
        <p class="text-xs text-slate-400 bg-dark-950/60 p-3 rounded-2xl border border-dark-800">
          🔒 <strong>Nota importante:</strong> Ninguno de estos datos se envía a ningún servidor central, base de datos externa o intermediario. No operamos servidores propios donde se almacene tu información.
        </p>
      </div>

      <!-- Sección 3: Uso de la API de Google Drive -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <AppIcon name="lucide:cloud" :size="18" class-name="text-indigo-400" />
          3. Uso de la API de Google Drive y Permisos OAuth
        </h2>
        <p>
          La aplicación ofrece una funcionalidad opcional de sincronización y respaldo con tu cuenta personal de Google Drive. Cuando decides conectar tu cuenta de Google:
        </p>
        
        <div class="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl flex flex-col gap-2">
          <p class="font-semibold text-indigo-300">Permiso solicitado (Scope):</p>
          <code class="text-xs font-mono bg-dark-950 px-2 py-1 rounded text-indigo-200 break-all">
            https://www.googleapis.com/auth/drive.file
          </code>
          <p class="text-xs text-slate-300 mt-1">
            Este permiso es de <strong>acceso restringido a archivos propios</strong>: la aplicación solo puede ver, editar y crear archivos que hayan sido creados específicamente por ella misma. <strong>Memo Cube NUNCA puede leer, ver ni modificar tus fotos, documentos personales u otros archivos existentes en tu Google Drive</strong>.
          </p>
        </div>

        <h3 class="text-sm font-semibold text-white mt-2">¿Cómo usamos este permiso?</h3>
        <ul class="list-disc list-inside space-y-1 pl-2 text-slate-300">
          <li><strong>Subir respaldo:</strong> Guardar o actualizar un único archivo denominado <code class="font-mono text-xs bg-dark-950 px-1 py-0.5 rounded text-slate-200">rubikbld_backup.json</code> en tu propia cuenta de Google Drive con la copia de tus pares e imágenes.</li>
          <li><strong>Restaurar respaldo:</strong> Descargar dicho archivo desde tu Google Drive para restaurar tus pares de letras en caso de que cambies de dispositivo.</li>
          <li><strong>Identidad básica:</strong> Mostrar tu nombre y foto de perfil en la pantalla de ajustes para confirmar visualmente qué cuenta está conectada.</li>
        </ul>
      </div>

      <!-- Sección 4: Cumplimiento de la Política de Datos de Google (Limited Use) -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <AppIcon name="lucide:check-circle-2" :size="18" class-name="text-emerald-400" />
          4. Cumplimiento de la Política de Datos de Google (Uso Limitado)
        </h2>
        <p>
          El uso que <strong>Memo Cube</strong> hace de la información recibida a través de las APIs de Google se adhiere a la 
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            class="text-indigo-400 underline hover:text-indigo-300"
          >
            Política de Datos del Usuario de los Servicios de API de Google
          </a>, incluidos los requisitos de <strong>Uso Limitado (Limited Use)</strong>:
        </p>
        <ul class="list-disc list-inside space-y-1 pl-2 text-slate-300">
          <li>No compartimos, transferimos ni vendemos datos de usuario de Google a terceros.</li>
          <li>No usamos datos de Google para publicidad, marketing ni creación de perfiles comerciales.</li>
          <li>No usamos datos de Google para entrenar modelos de Inteligencia Artificial ni aprendizaje automático general.</li>
          <li>La transferencia de datos se realiza exclusivamente entre tu navegador web y los servidores oficiales de Google (Google Drive API v3) bajo cifrado HTTPS.</li>
        </ul>
      </div>

      <!-- Sección 5: Control del Usuario y Revocación -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <AppIcon name="lucide:user-x" :size="18" class-name="text-indigo-400" />
          5. Control, Eliminación de Datos y Desconexión
        </h2>
        <p>
          Tienes control total sobre tus datos en todo momento:
        </p>
        <ul class="list-disc list-inside space-y-1 pl-2 text-slate-300">
          <li><strong>Cerrar sesión / Desconectar:</strong> Puedes pulsar el botón "Desconectar" en los Ajustes de la aplicación en cualquier momento para revocar el token de acceso.</li>
          <li><strong>Eliminar permisos en Google:</strong> Puedes revocar el acceso de la aplicación en cualquier momento desde tu panel de seguridad de Google: <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" class="text-indigo-400 underline">myaccount.google.com/permissions</a>.</li>
          <li><strong>Eliminar el respaldo:</strong> Puedes eliminar el archivo <code class="font-mono text-xs bg-dark-950 px-1 py-0.5 rounded text-slate-200">rubikbld_backup.json</code> directamente desde tu Google Drive.</li>
          <li><strong>Borrar datos locales:</strong> Puedes limpiar el almacenamiento del navegador en cualquier momento para borrar IndexedDB por completo.</li>
        </ul>
      </div>

      <!-- Sección 6: Contacto y Código Abierto -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <AppIcon name="lucide:mail" :size="18" class-name="text-indigo-400" />
          6. Contacto y Código Abierto
        </h2>
        <p>
          Esta aplicación es software de código abierto. Si tienes dudas, sugerencias o inquietudes sobre esta Política de Privacidad o el manejo de datos, puedes abrir un reporte o ponerte en contacto a través de nuestro repositorio oficial de GitHub:
        </p>
        <a
          href="https://github.com/EDGAR-BRI/rubikbld"
          target="_blank"
          rel="noopener noreferrer"
          class="text-indigo-400 hover:underline flex items-center gap-1.5 font-medium"
        >
          <AppIcon name="lucide:github" :size="16" />
          <span>https://github.com/EDGAR-BRI/rubikbld</span>
        </a>
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
