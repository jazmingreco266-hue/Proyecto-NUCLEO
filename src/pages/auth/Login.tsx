import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HeartHandshake } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui'
import { GoogleButton } from '@/components/GoogleButton'
import { AuthShell } from './AuthShell'

export default function Login() {
  const { login, findGoogleUser, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loadingSubmit, setLoadingSubmit] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoadingSubmit(true)
    try {
      await login(email, password)
      navigate('/app/hoy')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal.')
    } finally {
      setLoadingSubmit(false)
    }
  }

  async function onGoogleProfile(profile: { email: string; name: string; picture?: string }) {
    const existing = findGoogleUser(profile.email)
    if (existing) {
      await loginWithGoogle(profile.email)
      navigate('/app/hoy')
    } else {
      sessionStorage.setItem('nucleo:pendingGoogleProfile', JSON.stringify(profile))
      navigate('/completar-perfil')
    }
  }

  return (
    <AuthShell
      icon={<HeartHandshake size={26} />}
      title="Bienvenida de nuevo"
      subtitle="Tu equipo te está esperando."
    >
      <GoogleButton onProfile={onGoogleProfile} />
      <div className="my-5 flex items-center gap-3 text-xs font-semibold text-ink-500">
        <div className="h-px flex-1 bg-black/10" /> O CON TU EMAIL <div className="h-px flex-1 bg-black/10" />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-black/10 px-4 py-3 focus:border-lavender-300 focus:outline-none"
        />
        <input
          type="password"
          required
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-black/10 px-4 py-3 focus:border-lavender-300 focus:outline-none"
        />
        {error && <p className="text-sm font-semibold text-coral-600">{error}</p>}
        <Button type="submit" disabled={loadingSubmit} className="mt-2 w-full">
          {loadingSubmit ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">
        ¿Todavía no tenés cuenta?{' '}
        <Link to="/crear-cuenta" className="font-semibold text-lavender-600 hover:underline">
          Creála acá
        </Link>
      </p>
    </AuthShell>
  )
}
