import Swal, { type SweetAlertOptions } from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

const swalDark: SweetAlertOptions = {
  background: '#0c111d',
  color: '#f8fafc',
  confirmButtonColor: '#6366f1',
  cancelButtonColor: '#1e293b',
  showCloseButton: true,
  customClass: {
    popup: 'swal2-dark-popup',
    confirmButton: 'swal2-dark-confirm',
    cancelButton: 'swal2-dark-cancel',
    closeButton: 'swal2-dark-close',
  },
}

/**
 * Agrega gesto de deslizar (swipe-to-dismiss) a alertas y toasts de SweetAlert2.
 * Optimizado para pantallas táctiles en móviles y ratón en escritorio.
 */
export function enableSwipeToDismiss(popup: HTMLElement, _isToast: boolean = true) {
  if (!popup || (popup as any)._swipeInitialized) return
  ;(popup as any)._swipeInitialized = true

  let startX = 0
  let startY = 0
  let currentX = 0
  let currentY = 0
  let startTime = 0
  let isDragging = false
  let isLocked = false
  let isHorizontal = false

  const shouldIgnoreTarget = (target: HTMLElement | null): boolean => {
    if (!target) return false
    return !!target.closest('button, a, input, textarea, select, .swal2-close, .swal2-actions')
  }

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    if (shouldIgnoreTarget(e.target as HTMLElement)) return

    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    currentX = startX
    currentY = startY
    startTime = Date.now()
    isDragging = true
    isLocked = false
    isHorizontal = false
    Swal.stopTimer()
  }

  const onTouchMove = (e: TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return

    currentX = e.touches[0].clientX
    currentY = e.touches[0].clientY
    const deltaX = currentX - startX
    const deltaY = currentY - startY

    if (!isLocked) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        isLocked = true
        isHorizontal = Math.abs(deltaX) > Math.abs(deltaY)
      }
    }

    if (isHorizontal) {
      if (e.cancelable) e.preventDefault()
      popup.classList.add('swal2-swiping')
      const rotation = deltaX * 0.04
      const width = popup.offsetWidth || 300
      const opacity = Math.max(0.05, 1 - Math.abs(deltaX) / (width * 0.85))

      popup.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`
      popup.style.opacity = `${opacity}`
    }
  }

  const onTouchEnd = () => {
    if (!isDragging) return
    isDragging = false

    if (!isHorizontal) {
      Swal.resumeTimer()
      return
    }

    const deltaX = currentX - startX
    const deltaTime = Math.max(Date.now() - startTime, 1)
    const velocity = Math.abs(deltaX) / deltaTime
    const width = popup.offsetWidth || 300
    const threshold = Math.min(width * 0.3, 80)

    popup.classList.remove('swal2-swiping')

    if (Math.abs(deltaX) > threshold || (velocity > 0.35 && Math.abs(deltaX) > 20)) {
      const direction = deltaX > 0 ? 1 : -1
      popup.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
      popup.style.transform = `translateX(${direction * 125}%) rotate(${direction * 8}deg)`
      popup.style.opacity = '0'

      setTimeout(() => {
        Swal.close()
      }, 180)
    } else {
      popup.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.2s ease'
      popup.style.transform = 'translateX(0) rotate(0deg)'
      popup.style.opacity = '1'
      Swal.resumeTimer()

      setTimeout(() => {
        if (popup) {
          popup.style.transition = ''
          popup.style.transform = ''
          popup.style.opacity = ''
        }
      }, 240)
    }
  }

  popup.addEventListener('touchstart', onTouchStart, { passive: false })
  popup.addEventListener('touchmove', onTouchMove, { passive: false })
  popup.addEventListener('touchend', onTouchEnd)
  popup.addEventListener('touchcancel', onTouchEnd)
}

/**
 * Toast de éxito compacto estilo cancionero con swipe-to-dismiss y progreso
 */
export const showSuccessToast = (title: string, text?: string, timer: number = 2500) => {
  return Swal.fire({
    ...swalDark,
    icon: 'success',
    title,
    text,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    showCloseButton: true,
    timer,
    timerProgressBar: true,
    didOpen: (toast) => {
      enableSwipeToDismiss(toast, true)
      toast.onmouseenter = Swal.stopTimer
      toast.onmouseleave = Swal.resumeTimer
    },
  })
}

/**
 * Toast de error compacto
 */
export const showErrorToast = (title: string, text?: string, timer: number = 3500) => {
  return Swal.fire({
    ...swalDark,
    icon: 'error',
    title,
    text,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    showCloseButton: true,
    timer,
    timerProgressBar: true,
    didOpen: (toast) => {
      enableSwipeToDismiss(toast, true)
      toast.onmouseenter = Swal.stopTimer
      toast.onmouseleave = Swal.resumeTimer
    },
  })
}

/**
 * Toast informativo compacto
 */
export const showInfoToast = (title: string, text?: string, timer: number = 2500) => {
  return Swal.fire({
    ...swalDark,
    icon: 'info',
    title,
    text,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    showCloseButton: true,
    timer,
    timerProgressBar: true,
    didOpen: (toast) => {
      enableSwipeToDismiss(toast, true)
      toast.onmouseenter = Swal.stopTimer
      toast.onmouseleave = Swal.resumeTimer
    },
  })
}

/**
 * Confirmación modal interactiva general
 */
export const showConfirm = (
  title: string,
  text: string,
  confirmText: string = 'Sí, continuar',
  cancelText: string = 'Cancelar',
) => {
  return Swal.fire({
    ...swalDark,
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    showCloseButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: false,
    focusCancel: true,
    didOpen: (popup) => {
      enableSwipeToDismiss(popup, false)
    },
  })
}

/**
 * Confirmación específica y detallada para reiniciar el esquema a Speffz
 */
export const confirmResetScheme = () => {
  return Swal.fire({
    ...swalDark,
    icon: 'warning',
    title: '¿Restablecer esquema a Speffz?',
    html: `
      <div style="text-align: left; font-size: 0.85rem; color: #94a3b8; line-height: 1.5;">
        <p style="margin-bottom: 0.75rem;">
          Esta acción reconfigurará todas las letras del cubo con el estándar <b>Speffz 3x3</b>:
        </p>
        <div style="background: #111726; border: 1px solid #1e293b; border-radius: 0.75rem; padding: 0.75rem; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 0.75rem;">
          <div>• Cara <b>U</b>: A, B, C, D</div>
          <div>• Cara <b>L</b>: E, F, G, H</div>
          <div>• Cara <b>F</b>: I, J, K, L</div>
          <div>• Cara <b>R</b>: M, N, O, P</div>
          <div>• Cara <b>B</b>: Q, R, S, T</div>
          <div>• Cara <b>D</b>: U, V, W, X</div>
          <div style="margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px solid #1e293b;">
            • Buffer Esquinas: <b>UFR (U8)</b><br/>
            • Buffer Aristas: <b>UF (U7)</b>
          </div>
        </div>
        <p style="color: #f59e0b; font-size: 0.75rem;">
          ⚠️ Tus palabras e imágenes mnemotécnicas ya guardadas se conservarán.
        </p>
      </div>
    `,
    showCancelButton: true,
    showCloseButton: true,
    confirmButtonText: 'Sí, restablecer a Speffz',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#1e293b',
    focusCancel: true,
    didOpen: (popup) => {
      enableSwipeToDismiss(popup, false)
    },
  })
}

/**
 * Alerta de éxito modal completa
 */
export const showSuccess = (title: string, text?: string) => {
  return Swal.fire({
    ...swalDark,
    icon: 'success',
    title,
    text,
    showCloseButton: true,
    confirmButtonText: 'Aceptar',
    didOpen: (popup) => {
      enableSwipeToDismiss(popup, false)
    },
  })
}

/**
 * Alerta de error modal completa
 */
export const showError = (title: string, text?: string) => {
  return Swal.fire({
    ...swalDark,
    icon: 'error',
    title,
    text,
    showCloseButton: true,
    confirmButtonText: 'Entendido',
    didOpen: (popup) => {
      enableSwipeToDismiss(popup, false)
    },
  })
}

/**
 * Alerta de carga / loading
 */
export const showLoading = (title: string) => {
  return Swal.fire({
    ...swalDark,
    title,
    showCloseButton: false,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading()
    },
  })
}

/**
 * Instrucciones detalladas para instalar la PWA si el navegador no lanza el prompt automático
 */
export const showPwaInstallInstructions = (isIOS: boolean) => {
  if (isIOS) {
    return Swal.fire({
      ...swalDark,
      icon: 'info',
      title: 'Instalar en iPhone o iPad',
      html: `
        <div style="text-align: left; font-size: 0.875rem; color: #94a3b8; line-height: 1.6;">
          <p style="margin-bottom: 0.75rem;">
            Para tener Rubik BLD como aplicación nativa en tu pantalla de inicio:
          </p>
          <div style="background: #111726; border: 1px solid #1e293b; border-radius: 0.75rem; padding: 0.85rem; font-size: 0.85rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 0.6rem;">
            <div>1. Toca el botón <b>Compartir</b> <span style="font-size: 1.1em; color: #818cf8;">⎋</span> en Safari.</div>
            <div>2. Desplázate hacia abajo y selecciona <b>«Añadir a pantalla de inicio»</b>.</div>
            <div>3. Pulsa <b>«Añadir»</b> en la esquina superior derecha.</div>
          </div>
          <p style="margin-top: 0.75rem; font-size: 0.775rem; color: #818cf8;">
            ✨ Podrás abrirla a pantalla completa y practicar 100% offline.
          </p>
        </div>
      `,
      confirmButtonText: 'Entendido',
      didOpen: (popup) => {
        enableSwipeToDismiss(popup, false)
      },
    })
  }

  return Swal.fire({
    ...swalDark,
    icon: 'info',
    title: 'Instalar Rubik BLD',
    html: `
      <div style="text-align: left; font-size: 0.875rem; color: #94a3b8; line-height: 1.6;">
        <p style="margin-bottom: 0.75rem;">
          Puedes instalar la aplicación directamente desde tu navegador:
        </p>
        <div style="background: #111726; border: 1px solid #1e293b; border-radius: 0.75rem; padding: 0.85rem; font-size: 0.85rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 0.6rem;">
          <div>• <b>En Android (Chrome / Brave / Edge):</b> Pulsa el menú (<b>⋮</b>) y selecciona <b>«Instalar aplicación»</b> o <b>«Añadir a la pantalla principal»</b>.</div>
          <div>• <b>En Ordenador:</b> Pulsa el icono de instalación <span style="color: #818cf8;">⊕</span> situado al final de la barra de direcciones.</div>
        </div>
        <p style="margin-top: 0.75rem; font-size: 0.775rem; color: #818cf8;">
          ⚡ Funciona al instante, sin descargas pesadas ni tiendas de apps.
        </p>
      </div>
    `,
    confirmButtonText: 'Entendido',
    didOpen: (popup) => {
      enableSwipeToDismiss(popup, false)
    },
  })
}

export default Swal

