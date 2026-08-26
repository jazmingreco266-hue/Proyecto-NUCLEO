import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button } from './ui'

export function PinLockScreen() {
  const { unlock, currentUser } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await unlock(pin)
    if (!ok) {
      setError('PIN incorrecto. Probá de nuevo.')
      setPin('')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <form onSubmit={submit} className="card-soft w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lavender-100 text-lavender-600">
          <Lock size={26} />
        </div>
        <h1 className="font-display text-xl font-bold text-ink-900">Hola de nuevo, {currentUser?.name?.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-ink-500">Ingresá tu PIN para ver tu información.</p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value)
            setError('')
          }}
          className="mt-6 w-full rounded-2xl border border-black/10 px-4 py-3 text-center text-2xl tracking-[0.5em] focus:border-lavender-300 focus:outline-none"
          placeholder="····"
        />
        {error && <p className="mt-2 text-sm font-semibold text-coral-600">{error}</p>}
        <Button type="submit" className="mt-6 w-full">
          Entrar
        </Button>
      </form>
    </div>
  )
}
