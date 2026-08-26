export interface GoogleJwtPayload {
  email: string
  name: string
  picture?: string
}

let scriptPromise: Promise<void> | null = null

export function loadGoogleScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (document.getElementById('google-identity-script')) return resolve()
    const script = document.createElement('script')
    script.id = 'google-identity-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar Google Sign-In.'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Decodifica el JWT (id_token) que devuelve Google Identity Services.
 * NOTA: en una app con backend, este token debe verificarse en el servidor
 * (firma + audiencia + expiración) antes de confiar en sus datos. Como esta
 * primera versión es 100% cliente, solo lo usamos para leer nombre/email/foto.
 */
export function decodeGoogleJwt(token: string): GoogleJwtPayload {
  const payload = token.split('.')[1]
  const json = decodeURIComponent(
    atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(''),
  )
  const parsed = JSON.parse(json)
  return { email: parsed.email, name: parsed.name, picture: parsed.picture }
}

export function getGoogleClientId(): string | undefined {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
}
