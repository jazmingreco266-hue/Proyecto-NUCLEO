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
import { Button } from '@/components/ui'
import { Mascot } from '@/components/Mascot'

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
    text: 'Un dato positivo por día, testimonios y consejos, sin promesas vacías.',
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
    <div className="bg-cream">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" className="h-8 w-8" alt="Núcleo" />
          <span className="font-display text-lg font-semibold text-ink-900">Núcleo</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/ingresar" className="rounded-lg px-4 py-2 text-sm font-medium text-ink-700 hover:bg-black/5">
            Ingresar
          </Link>
          <Link to="/crear-cuenta">
            <Button className="text-sm">Crear cuenta</Button>
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-0 h-[32rem] w-[32rem] rounded-full opacity-25 blur-3xl"
          style={{ background: 'linear-gradient(135deg, var(--color-lavender-500), var(--color-peach-500))' }}
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-8 sm:pt-14">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-lavender-600">
              Creada por una hija para acompañar a su familia
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.1] text-ink-900 sm:text-5xl">
              Tu equipo, tu tratamiento y tu familia, en un solo lugar.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-700 sm:text-lg">
              Núcleo organiza turnos, medicación y síntomas del proceso oncológico, y arma un
              puente simple entre el paciente, su familia y el equipo médico. Nada de diagnósticos
              automáticos: solo orden, memoria y compañía.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/crear-cuenta">
                <Button className="text-sm">
                  Empezar ahora <ArrowRight size={16} />
                </Button>
              </Link>
              <Link to="/ingresar">
                <Button variant="secondary" className="text-sm">
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <Mascot pose="wave" className="absolute -top-10 -right-6 h-20 w-20 drop-shadow-sm" />
            <div className="card-soft p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-lavender-600">Hoy · lunes</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">¿Cómo te sentís hoy?</h3>
            <div className="mt-4 flex justify-between text-2xl">
              <span className="opacity-60">😞</span>
              <span className="opacity-60">😕</span>
              <span className="rounded-full bg-gradient-to-br from-lavender-100 to-peach-100 p-1.5">🙂</span>
              <span className="opacity-60">😄</span>
              <span className="opacity-60">🤩</span>
            </div>
            <div className="mt-5 rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm text-ink-700">
              <p className="font-semibold text-teal-600">Próximo turno</p>
              <p>Quimio · ciclo 4 · miércoles 10:30</p>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-peach-100 bg-peach-50 p-3 text-sm text-ink-700">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-peach-500" />
              <p>Reír 10 minutos puede bajar la percepción del dolor. Hoy, una excusa más.</p>
            </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      <section className="border-y border-black/5 bg-white py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-center font-display text-2xl font-semibold text-ink-900 sm:text-3xl">
            Todo lo que necesitan, sin vueltas
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-ink-500">
            Diseñada para usarse cansados, apurados o angustiados. Simple, clara y seria.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-soft p-6">
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${toneClasses[f.tone]}`}>
                  <f.icon size={18} />
                </div>
                <h3 className="font-display text-base font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-1 text-sm text-ink-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="card-soft bg-gradient-to-br from-lavender-500 to-peach-500 p-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-lavender-100">Misión</p>
            <p className="mt-3 font-display text-xl font-semibold leading-snug">
              Reducir la carga mental de atravesar un cáncer, dando orden al tratamiento y
              cercanía a la familia.
            </p>
          </div>
          <div className="card-soft p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-lavender-600">Visión</p>
            <p className="mt-3 font-display text-xl font-semibold leading-snug text-ink-900">
              Que ninguna familia enfrente un proceso oncológico sola ni desorganizada.
            </p>
          </div>
        </div>
        <div className="mt-8 text-center">
          <Link to="/app/nosotros" className="text-sm font-semibold text-lavender-600 hover:underline">
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
