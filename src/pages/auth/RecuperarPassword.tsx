import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Button, Disclaimer } from '@/components/ui'
import { AuthShell } from './AuthShell'

export default function RecuperarPassword() {
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPassword(email, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthShell title="Contraseña actualizada" subtitle="Ya podés ingresar con tu nueva contraseña.">
        <Button onClick={() => navigate('/ingresar')} className="w-full">
          Ir a ingresar
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Recuperar contraseña" subtitle="Restablecé el acceso a tu cuenta en este dispositivo.">
      <Disclaimer tone="warning">
        Núcleo todavía no tiene servidor propio, así que no podemos enviarte un email de
        verificación: cualquiera con acceso a este dispositivo y tu email podría restablecer tu
        contraseña. Te recomendamos activar un PIN adicional desde Privacidad una vez que
        ingreses.
      </Disclaimer>
      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Tu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-black/10 px-4 py-3 focus:border-lavender-300 focus:outline-none"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Nueva contraseña (mínimo 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-black/10 px-4 py-3 focus:border-lavender-300 focus:outline-none"
        />
        {error && <p className="text-sm font-semibold text-coral-600">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-2 w-full">
          {loading ? 'Actualizando…' : 'Restablecer contraseña'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">
        <Link to="/ingresar" className="font-semibold text-lavender-600 hover:underline">
          Volver a ingresar
        </Link>
      </p>
    </AuthShell>
  )
}
