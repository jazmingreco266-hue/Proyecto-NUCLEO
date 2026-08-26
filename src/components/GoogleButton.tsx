import { useEffect, useRef, useState } from 'react'
import { decodeGoogleJwt, getGoogleClientId, loadGoogleScript } from '@/lib/googleAuth'

export function GoogleButton({ onProfile }: { onProfile: (p: ReturnType<typeof decodeGoogleJwt>) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [unavailable, setUnavailable] = useState(false)
  const clientId = getGoogleClientId()

  useEffect(() => {
    if (!clientId) {
      setUnavailable(true)
      return
    }
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => onProfile(decodeGoogleJwt(response.credential)),
        })
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          width: 320,
          text: 'continue_with',
        })
      })
      .catch(() => setUnavailable(true))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  if (unavailable) {
    return (
      <div className="rounded-full border border-dashed border-black/15 px-4 py-3 text-center text-xs text-ink-500">
        Continuar con Google no está configurado en este entorno todavía. Definí{' '}
        <code className="rounded bg-black/5 px-1">VITE_GOOGLE_CLIENT_ID</code> para activarlo (ver README).
      </div>
    )
  }

  return <div ref={ref} className="flex justify-center" />
}
