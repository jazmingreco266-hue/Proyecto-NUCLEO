import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2, CalendarHeart } from 'lucide-react'
import { useData } from '@/lib/data'
import { APPOINTMENT_LABELS } from '@/lib/labels'
import type { Appointment, AppointmentType } from '@/lib/types'
import { Badge, Button, Card, EmptyState, Modal, PageHeader } from '@/components/ui'

const TYPE_DOT: Record<AppointmentType, string> = {
  quimio: 'bg-lavender-500',
  radio: 'bg-teal-500',
  consulta: 'bg-peach-500',
  estudio: 'bg-lavender-300',
  analisis: 'bg-teal-300',
  cirugia: 'bg-coral-500',
  otro: 'bg-ink-500',
}

const emptyForm = {
  type: 'consulta' as AppointmentType,
  title: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '09:00',
  location: '',
  professional: '',
  notes: '',
  reminder: true,
}

export default function Agenda() {
  const { data, addAppointment, updateAppointment, removeAppointment } = useData()
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [month])

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const a of data.appointments) {
      const list = map.get(a.date) ?? []
      list.push(a)
      map.set(a.date, list)
    }
    return map
  }, [data.appointments])

  const upcoming = [...data.appointments]
    .filter((a) => !a.done)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  function openNew(dateStr?: string) {
    setForm({ ...emptyForm, date: dateStr ?? format(new Date(), 'yyyy-MM-dd') })
    setFormOpen(true)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    addAppointment(form)
    setFormOpen(false)
  }

  const selectedList = selectedDay ? byDate.get(selectedDay) ?? [] : []

  return (
    <div>
      <PageHeader
        title="Agenda oncológica"
        subtitle="Quimio, radio, consultas, estudios y cirugías, todo en un solo calendario."
        icon={<CalendarHeart size={22} />}
        action={
          <Button onClick={() => openNew()} className="hidden sm:inline-flex">
            <Plus size={18} /> Nuevo
          </Button>
        }
      />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => setMonth((m) => subMonths(m, 1))} className="rounded-full p-2 hover:bg-black/5">
            <ChevronLeft size={20} />
          </button>
          <p className="font-display text-lg font-bold capitalize text-ink-900">
            {format(month, 'MMMM yyyy', { locale: es })}
          </p>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} className="rounded-full p-2 hover:bg-black/5">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-ink-500">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const items = byDate.get(key) ?? []
            const inMonth = isSameMonth(day, month)
            return (
              <button
                key={key}
                onClick={() => setSelectedDay(key)}
                className={`flex h-14 flex-col items-center justify-center rounded-xl text-sm transition sm:h-16 ${
                  isToday(day) ? 'bg-lavender-100 font-bold text-lavender-600' : 'hover:bg-black/5'
                } ${!inMonth ? 'opacity-30' : ''} ${selectedDay === key ? 'ring-2 ring-lavender-400' : ''}`}
              >
                {format(day, 'd')}
                <div className="mt-1 flex gap-0.5">
                  {items.slice(0, 3).map((it) => (
                    <span key={it.id} className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[it.type]}`} />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      <Button onClick={() => openNew()} className="mt-4 w-full sm:hidden">
        <Plus size={18} /> Nuevo evento
      </Button>

      {selectedDay && (
        <Card className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-bold capitalize text-ink-900">
              {format(parseISO(selectedDay), "EEEE d 'de' MMMM", { locale: es })}
            </h3>
            <Button variant="secondary" className="text-xs" onClick={() => openNew(selectedDay)}>
              <Plus size={14} /> Agregar
            </Button>
          </div>
          {selectedList.length === 0 ? (
            <p className="text-sm text-ink-500">No hay eventos este día.</p>
          ) : (
            <ul className="space-y-2">
              {selectedList.map((a) => (
                <AppointmentRow
                  key={a.id}
                  a={a}
                  onDone={() => updateAppointment(a.id, { done: !a.done })}
                  onDelete={() => removeAppointment(a.id)}
                />
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Próximos</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            title="Todavía no tenés turnos cargados"
            description="Agregá tu próxima sesión, consulta o estudio."
            action={
              <Button onClick={() => openNew()} className="mt-2">
                <Plus size={16} /> Agregar primer turno
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {upcoming.slice(0, 8).map((a) => (
              <AppointmentRow
                key={a.id}
                a={a}
                showDate
                onDone={() => updateAppointment(a.id, { done: !a.done })}
                onDelete={() => removeAppointment(a.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nuevo evento">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as AppointmentType })}
            className="rounded-2xl border border-black/10 px-4 py-3"
          >
            {Object.entries(APPOINTMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Título (ej: Quimio ciclo 4)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-2xl border border-black/10 px-4 py-3"
          />
          <div className="flex gap-3">
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="flex-1 rounded-2xl border border-black/10 px-4 py-3"
            />
            <input
              required
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="flex-1 rounded-2xl border border-black/10 px-4 py-3"
            />
          </div>
          <input
            placeholder="Lugar / centro"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="rounded-2xl border border-black/10 px-4 py-3"
          />
          <input
            placeholder="Profesional"
            value={form.professional}
            onChange={(e) => setForm({ ...form, professional: e.target.value })}
            className="rounded-2xl border border-black/10 px-4 py-3"
          />
          <textarea
            placeholder="Notas"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="rounded-2xl border border-black/10 px-4 py-3"
            rows={2}
          />
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={form.reminder}
              onChange={(e) => setForm({ ...form, reminder: e.target.checked })}
            />
            Avisarme antes
          </label>
          <Button type="submit" className="mt-2 w-full">
            Guardar
          </Button>
        </form>
      </Modal>
    </div>
  )
}

function AppointmentRow({
  a,
  showDate,
  onDone,
  onDelete,
}: {
  a: Appointment
  showDate?: boolean
  onDone: () => void
  onDelete: () => void
}) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl border border-black/5 p-3 ${a.done ? 'opacity-50' : ''}`}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_DOT[a.type]}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-bold text-ink-900">{a.title}</p>
          <Badge tone="gray">{APPOINTMENT_LABELS[a.type]}</Badge>
        </div>
        <p className="text-xs text-ink-500">
          {showDate && `${format(parseISO(a.date), 'd MMM', { locale: es })} · `}
          {a.time}
          {a.location ? ` · ${a.location}` : ''}
        </p>
      </div>
      <button onClick={onDone} className="rounded-full p-2 text-teal-600 hover:bg-teal-50" title="Marcar hecho">
        <CheckCircle2 size={18} />
      </button>
      <button onClick={onDelete} className="rounded-full p-2 text-coral-600 hover:bg-red-50" title="Eliminar">
        <Trash2 size={18} />
      </button>
    </li>
  )
}
