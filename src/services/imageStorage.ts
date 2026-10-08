// Utilidad para comprimir y convertir imágenes a WebP ligero para IndexedDB y Google Drive

export async function processAndCompressImage(
  fileOrBlob: File | Blob,
  maxWidth: number = 600,
  maxHeight: number = 600,
  quality: number = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto 2D de canvas'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        // Convertir a WebP
        const dataUrl = canvas.toDataURL('image/webp', quality)
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error('Error al cargar la imagen'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsDataURL(fileOrBlob)
  })
}
