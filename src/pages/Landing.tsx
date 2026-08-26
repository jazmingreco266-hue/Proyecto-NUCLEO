import { Link } from 'react-router-dom'
import {
  CalendarHeart,
  ClipboardList,
  Users,
  Sparkles,
  ShieldCheck,
  HeartHandshake,
  ArrowRight,
} from 'lucide-react'
import { BlobDecoration, Button } from '@/components/ui'

const FEATURES = [
  {
    icon: CalendarHeart,
    title: 'Agenda oncológica',
    text: 'Quimio, radio, estudios y consultas en un calendario simple, con recordatorios.',
    tone: 'lavender',
  },
  {
    icon: ClipboardList,
    title: 'Registro en 2 minutos',
    text: 'Síntomas, ánimo, apetito y sueño. La app arma la evolución sola.',
    tone: 'teal',
  },
  {
    icon: Users,
    title: 'Círculo familiar',
    text: 'Invitá a tu familia con un código de acceso. Cada uno ve lo que vos decidas.',
    tone: 'peach',
  },
  {
    icon: Sparkles,
    title: 'Contención de verdad',
    text: 'Un fun fact positivo por día, testimonios y consejos, sin promesas vacías.',
    tone: 'lavender',
  },
  {
    icon: ShieldCheck,
    title: 'Privado y tuyo',
    text: 'PIN, datos cifrados en tu dispositivo y control total: exportá o borrá cuando quieras.',
    tone: 'teal',
  },
  {
    icon: HeartHandshake,
    title: 'No reemplaza a tu médico',
    text: 'Organiza y acompaña. Nunca diagnostica ni sugiere cambiar un tratamiento.',
    tone: 'peach',
  },
]

const toneClasses: Record<string, string> = {
  lavender: 'bg-lavender-100 text-lavender-600',
  teal: 'bg-teal-100 text-teal-600',
  peach: 'bg-peach-100 text-peach-500',
}

export default function Landing() {
  return (
    <div className="overflow-x-hidden bg-cream">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" className="h-9 w-9" alt="Núcleo" />
          <span className="font-display text-xl font-extrabold text-ink-900">Núcleo</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/ingresar" className="rounded-full px-4 py-2 text-sm font-bold text-ink-700 hover:bg-black/5">
            Ingresar
          </Link>
          <Link to="/crear-cuenta">
            <Button className="text-sm">Crear cuenta</Button>
          </Link>
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-5 pb-20 pt-10 sm:pt-16">
        <BlobDecoration className="animate-float pointer-events-none absolute -right-24 -top-16 h-72 w-72 text-lavender-100/80 sm:h-96 sm:w-96" />
        <BlobDecoration className="pointer-events-none absolute -left-20 top-40 h-56 w-56 text-teal-100/70" />
        <div className="relative grid items-center gap-10 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-lavender-100 px-4 py-1.5 text-xs font-bold text-lavender-600">
              💜 Hecha por una hija, para todas las familias
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight text-ink-900 sm:text-5xl">
              Tu equipo, tu tratamiento y tu familia, en un solo lugar.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-ink-700">
              Núcleo organiza turnos, medicación y síntomas del proceso oncológico, y arma un
              puente simple entre el paciente, su familia y el equipo médico. Nada de diagnósticos
              automáticos: solo orden, memoria y compañía.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/crear-cuenta">
                <Button className="text-base">
                  Empezar ahora <ArrowRight size={18} />
                </Button>
              </Link>
              <Link to="/ingresar">
                <Button variant="secondary" className="text-base">
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="card-soft animate-pop mx-auto max-w-sm rotate-1 p-6">
              <p className="font-display text-sm font-bold text-lavender-600">Hoy · lunes</p>
              <h3 className="mt-1 font-display text-xl font-bold text-ink-900">¿Cómo te sentís hoy?</h3>
              <div className="mt-4 flex justify-between text-3xl">
                <span>😞</span>
                <span>😕</span>
                <span className="rounded-full bg-teal-100 p-1">🙂</span>
                <span>😄</span>
                <span>🤩</span>
              </div>
              <div className="mt-5 rounded-2xl bg-teal-50 p-3 text-sm text-ink-700">
                <p className="font-bold text-teal-600">Próximo turno</p>
                <p>Quimio · ciclo 4 · miércoles 10:30</p>
              </div>
              <div className="mt-3 rounded-2xl bg-peach-50 p-3 text-sm text-ink-700">
                <p className="font-bold text-peach-500">✨ Fun fact del día</p>
                <p>Reír 10 minutos puede bajar la percepción del dolor. Hoy, una excusa más.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white/60 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-center font-display text-3xl font-extrabold text-ink-900">
            Todo lo que necesitan, sin vueltas
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-ink-500">
            Diseñada para usarse cansados, apurados o angustiados. Simple, cálida y clara.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-soft p-6">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses[f.tone]}`}>
                  <f.icon size={20} />
                </div>
                <h3 className="font-display text-lg font-bold text-ink-900">{f.title}</h3>
                <p className="mt-1 text-sm text-ink-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="card-soft bg-gradient-to-br from-lavender-500 to-teal-500 p-8 text-white">
            <p className="font-display text-sm font-bold uppercase tracking-wide text-white/80">Misión</p>
            <p className="mt-3 font-display text-2xl font-bold leading-snug">
              Reducir la carga mental de atravesar un cáncer, dando orden al tratamiento y
              cercanía a la familia.
            </p>
          </div>
          <div className="card-soft p-8">
            <p className="font-display text-sm font-bold uppercase tracking-wide text-lavender-600">Visión</p>
            <p className="mt-3 font-display text-2xl font-bold leading-snug text-ink-900">
              Que ninguna familia enfrente un proceso oncológico sola ni desorganizada.
            </p>
          </div>
        </div>
        <div className="mt-8 text-center">
          <Link to="/app/nosotros" className="text-sm font-bold text-lavender-600 hover:underline">
            Conocé la historia detrás de Núcleo →
          </Link>
        </div>
      </section>

      <footer className="border-t border-black/5 px-5 py-8 text-center text-xs text-ink-500">
        Núcleo no diagnostica ni reemplaza la indicación médica. Es una herramienta de
        organización y acompañamiento. Ante cualquier duda de salud, contactá siempre a tu equipo
        médico.
      </footer>
    </div>
  )
}
