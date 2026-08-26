import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import type { Role } from '@/lib/types'
import { Button } from '@/components/ui'
import { AuthShell } from './AuthShell'

interface PendingProfile {
  email: string
  name: string
  picture?: string
}

export default function GoogleOnboarding() {
  const { completeGoogleSignup } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PendingProfile | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [relationship, setRelationship] = useState('')
  const [circleCode, setCircleCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('nucleo:pendingGoogleProfile')
    if (!raw) {
      navigate('/crear-cuenta')
      return
    }
    setProfile(JSON.parse(raw))
  }, [navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !role) return
    setError('')
    setLoading(true)
    try {
      await completeGoogleSignup({ profile, role, relationship, circleCode })
      sessionStorage.removeItem('nucleo:pendingGoogleProfile')
      navigate('/app/hoy')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal.')
    } finally {
      setLoading(false)
    }
  }

  if (!profile) return null

  return (
    <AuthShell
      title={`¡Hola, ${profile.name.split(' ')[0]}!`}
      subtitle="Un último paso para armar tu espacio en Núcleo."
    >
      {!role ? (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setRole('paciente')}
            className="flex items-center gap-4 rounded-lg border-2 border-lavender-100 p-4 text-left transition hover:border-lavender-300 hover:bg-lavender-50"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lavender-100 text-lavender-600">
              <User size={20} />
            </div>
            <div>
              <p className="font-display font-semibold text-ink-900">Soy la paciente / el paciente</p>
              <p className="text-xs text-ink-500">Voy a organizar mi propio tratamiento.</p>
            </div>
          </button>
          <button
            onClick={() => setRole('familiar')}
            className="flex items-center gap-4 rounded-lg border-2 border-teal-100 p-4 text-left transition hover:border-teal-300 hover:bg-teal-50"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600">
              <Users size={20} />
            </div>
            <div>
              <p className="font-display font-semibold text-ink-900">Soy familiar o acompañante</p>
              <p className="text-xs text-ink-500">Tengo un código de acceso para unirme al círculo.</p>
            </div>
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {role === 'familiar' && (
            <>
              <input
                required
                placeholder="Tu vínculo (ej: Hija, Esposo, Amiga)"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="rounded-lg border border-black/10 px-4 py-3 focus:border-lavender-300 focus:outline-none"
              />
              <input
                required
                placeholder="Código de acceso (ej: NUC-4X8Q2P)"
                value={circleCode}
                onChange={(e) => setCircleCode(e.target.value.toUpperCase())}
                className="rounded-lg border border-black/10 px-4 py-3 uppercase focus:border-lavender-300 focus:outline-none"
              />
            </>
          )}
          {error && <p className="text-sm font-semibold text-coral-600">{error}</p>}
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setRole(null)}>
              Volver
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creando…' : 'Entrar a Núcleo'}
            </Button>
          </div>
        </form>
      )}
    </AuthShell>
  )
}
