import { Capacitor } from '@capacitor/core'

export const isNative = Capacitor.isNativePlatform()

/**
 * Ajusta la barra de estado nativa al color de marca. Solo hace algo en
 * iOS/Android empaquetados con Capacitor; en la web no importa nada.
 */
export async function initNativeStatusBar() {
  if (!isNative) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setBackgroundColor({ color: '#8b3fe8' })
    await StatusBar.setStyle({ style: Style.Dark })
  } catch {
    // no-op: no todas las plataformas soportan cada método
  }
}

/**
 * En Android, el botón físico/gesto de "atrás" por defecto cierra la app.
 * Acá lo redirigimos a la navegación del browser (history.back) y solo
 * dejamos que la app se minimice cuando ya no hay más historial.
 */
export async function registerAndroidBackButton() {
  if (!isNative) return
  const { App } = await import('@capacitor/app')
  App.addListener('backButton', () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      App.minimizeApp()
    }
  })
}

/**
 * Comparte texto usando la hoja de compartir nativa del sistema operativo
 * cuando está empaquetada con Capacitor; si no, cae al Web Share API o,
 * como último recurso, copia al portapapeles.
 */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (isNative) {
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share({ title, text })
      return 'shared'
    } catch {
      return 'failed'
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch {
      return 'failed'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
