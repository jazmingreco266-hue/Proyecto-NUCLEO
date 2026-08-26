import { Link } from 'react-router-dom'
import { LegalShell } from './LegalShell'

const FAQS = [
  {
    q: '¿Mis datos se sincronizan entre mi celular y mi computadora?',
    a: 'Todavía no: en esta versión, tus datos viven en el dispositivo donde los cargaste. Para pasarlos a otro dispositivo, andá a Privacidad → Descargar mis datos, y guardalos donde quieras.',
  },
  {
    q: '¿Cómo invito a un familiar?',
    a: 'Desde Círculo familiar vas a encontrar un código de acceso. Compartíselo: al crear su cuenta, tu familiar elige "Familiar o acompañante" e ingresa ese código.',
  },
  {
    q: 'Me olvidé mi contraseña, ¿qué hago?',
    a: 'En la pantalla de ingreso tocá "¿Olvidaste tu contraseña?" e ingresá tu email para crear una nueva. Como esta versión no tiene servidor propio, no enviamos un email de verificación: cualquiera con acceso a este dispositivo podría hacer lo mismo, así que te recomendamos activar el PIN de la app para protegerlo mejor.',
  },
  {
    q: '¿Puedo borrar mi cuenta?',
    a: 'Sí, desde Privacidad → Eliminar cuenta. Es permanente: si querés conservar algo, descargalo antes.',
  },
  {
    q: '¿Núcleo reemplaza a mi equipo médico?',
    a: 'No. Núcleo organiza información y te acompaña, pero cualquier duda de salud, síntoma nuevo o decisión de tratamiento siempre debe consultarse con tu equipo médico.',
  },
]

export default function Support() {
  return (
    <LegalShell title="Soporte" subtitle="Preguntas frecuentes y cómo contactarnos">
      <p>
        Si tenés un problema técnico, una sugerencia o simplemente querés contarnos algo, escribinos a{' '}
        <a href="mailto:soporte@nucleoapp.com.ar" className="font-semibold text-lavender-600 hover:underline">
          soporte@nucleoapp.com.ar
        </a>
        . Intentamos responder en un plazo de 48 a 72 horas hábiles.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink-900">Preguntas frecuentes</h2>
      <div className="flex flex-col gap-4">
        {FAQS.map((f) => (
          <div key={f.q}>
            <p className="font-semibold text-ink-900">{f.q}</p>
            <p className="mt-1 text-ink-700">{f.a}</p>
          </div>
        ))}
      </div>

      <p className="mt-4">
        También podés revisar nuestra{' '}
        <Link to="/privacidad" className="font-semibold text-lavender-600 hover:underline">
          política de privacidad
        </Link>
        .
      </p>
    </LegalShell>
  )
}
