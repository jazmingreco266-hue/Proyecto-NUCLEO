import { Link } from 'react-router-dom'
import { format, isToday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ClipboardList, CalendarHeart, Phone, Sparkles, Pill, Images, Plus } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useData } from '@/lib/data'
import { funFactOfTheDay } from '@/lib/funFacts'
import { APPOINTMENT_LABELS } from '@/lib/labels'
import { Badge, Card } from '@/components/ui'
import { Mascot } from '@/components/Mascot'

export default function Today() {
  const { currentUser } = useAuth()
  const { data } = useData()

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const upcoming = [...data.appointments]
    .filter((a) => !a.done && a.date >= todayStr)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0]

  const todaySymptom = data.symptoms.find((s) => s.date === todayStr)
  const todayMeds = data.medications.filter((m) => m.active)
  const takenIds = new Set(
    data.medicationLogs.filter((l) => l.date === todayStr && l.status === 'tomada').map((l) => l.medicationId),
  )

  const firstName = currentUser?.name.split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Mascot pose="wave" className="h-14 w-14 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-lavender-600">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <h1 className="font-display text-3xl font-semibold text-ink-900">
            {greeting}, {firstName}
          </h1>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/app/registro" className="card-soft group p-5 transition hover:-translate-y-0.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-lavender-100 text-lavender-600">
            <ClipboardList size={20} />
          </div>
          <p className="mt-3 font-display font-semibold text-ink-900">Registrar cómo me siento</p>
          <p className="mt-1 text-xs text-ink-500">
            {todaySymptom ? 'Ya registraste hoy ✓' : 'Todavía no registraste hoy'}
          </p>
        </Link>
        <Link to="/app/agenda" className="card-soft group p-5 transition hover:-translate-y-0.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
            <CalendarHeart size={20} />
          </div>
          <p className="mt-3 font-display font-semibold text-ink-900">Ver lo que tengo que hacer</p>
          <p className="mt-1 text-xs text-ink-500">Agenda, medicación y preguntas pendientes</p>
        </Link>
        <Link to="/app/contactos" className="card-soft group p-5 transition hover:-translate-y-0.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-peach-100 text-peach-500">
            <Phone size={20} />
          </div>
          <p className="mt-3 font-display font-semibold text-ink-900">Contactar a mi equipo</p>
          <p className="mt-1 text-xs text-ink-500">Oncólogo, guardia, farmacia y más</p>
        </Link>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-900">Próximo evento</h2>
          {upcoming ? (
            <div className="mt-3 flex items-start gap-3">
              <Badge tone="lavender">{APPOINTMENT_LABELS[upcoming.type]}</Badge>
              <div>
                <p className="font-semibold text-ink-900">{upcoming.title}</p>
                <p className="text-sm text-ink-500">
                  {format(parseISO(upcoming.date), "EEEE d 'de' MMMM", { locale: es })} · {upcoming.time}
                  {upcoming.location ? ` · ${upcoming.location}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-500">No tenés turnos cargados todavía.</p>
          )}
          <Link to="/app/agenda" className="mt-4 inline-block text-sm font-semibold text-lavender-600 hover:underline">
            Ver toda la agenda →
          </Link>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
            <Pill size={18} className="text-teal-600" /> Medicación de hoy
          </h2>
          {todayMeds.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">No cargaste medicación todavía.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {todayMeds.slice(0, 4).map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">
                    {m.name} <span className="text-ink-500">· {m.schedule.join(', ')}</span>
                  </span>
                  {takenIds.has(m.id) ? (
                    <Badge tone="teal">Tomada</Badge>
                  ) : (
                    <Badge tone="gray">Pendiente</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link to="/app/tratamiento" className="mt-4 inline-block text-sm font-semibold text-lavender-600 hover:underline">
            Ir a medicación →
          </Link>
        </Card>
      </div>

      <Card className="mt-5 border-l-2 border-l-peach-500 bg-peach-50">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-peach-500">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="font-display font-semibold text-ink-900">Dato del día</p>
            <p className="mt-1 text-sm text-ink-700">{funFactOfTheDay()}</p>
          </div>
        </div>
      </Card>

      <Card className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
            <Images size={18} className="text-lavender-600" /> Por lo que lucho
          </h2>
          <Link to="/app/galeria" className="text-sm font-semibold text-lavender-600 hover:underline">
            {data.gallery.length > 0 ? 'Ver galería →' : 'Subir foto →'}
          </Link>
        </div>
        {data.gallery.length === 0 ? (
          <Link
            to="/app/galeria"
            className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-ink-500/25 p-4 text-sm text-ink-500 hover:border-lavender-300 hover:text-lavender-600"
          >
            <Plus size={18} /> Subí una foto que te recuerde por qué vale la pena cada día.
          </Link>
        ) : (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {data.gallery.slice(0, 6).map((p) => (
              <img
                key={p.id}
                src={p.dataUrl}
                alt={p.caption}
                className="h-20 w-20 shrink-0 rounded-lg object-cover"
              />
            ))}
          </div>
        )}
      </Card>

      {data.appointments.some((a) => isToday(parseISO(a.date)) && !a.done) && (
        <Card className="mt-5 border border-teal-100 bg-teal-50/60">
          <p className="text-sm font-semibold text-teal-600">Hoy tenés actividad en tu agenda.</p>
        </Card>
      )}
    </div>
  )
}
