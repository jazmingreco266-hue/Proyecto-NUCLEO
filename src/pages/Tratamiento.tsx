import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Pill, Plus, Trash2, Bell, Check, X, AlertTriangle } from 'lucide-react'
import { useData } from '@/lib/data'
import type { Medication, MedicationStatus } from '@/lib/types'
import { Badge, Button, Card, Disclaimer, EmptyState, Modal, PageHeader } from '@/components/ui'

const emptyMed = { name: '', dose: '', schedule: ['09:00'], reason: '', active: true }

export default function Tratamiento() {
  const [tab, setTab] = useState<'tratamiento' | 'medicacion'>('tratamiento')

  return (
    <div>
      <PageHeader title="Tratamiento y medicación" subtitle="Datos del tratamiento, ciclos y toma de medicación." icon={<Pill size={22} />} />

      <div className="mb-5 inline-flex rounded-full bg-white p-1 shadow-sm">
        {(['tratamiento', 'medicacion'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t ? 'bg-lavender-500 text-white' : 'text-ink-500'
            }`}
          >
            {t === 'tratamiento' ? 'Tratamiento' : 'Medicación'}
          </button>
        ))}
      </div>

      {tab === 'tratamiento' ? <TreatmentInfoTab /> : <MedicationTab />}
    </div>
  )
}

function TreatmentInfoTab() {
  const { data, setTreatment } = useData()
  const [form, setForm] = useState(data.treatment)
  const [saved, setSaved] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTreatment(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Card>
      <Disclaimer>
        Esta sección solo guarda información que ya te dio tu equipo médico. Núcleo no sugiere ni
        modifica tratamientos.
      </Disclaimer>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <input
          placeholder="Nombre del tratamiento"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-black/10 px-4 py-3"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Inicio</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full rounded-lg border border-black/10 px-4 py-3"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Ciclo actual</label>
              <input
                type="number"
                min={0}
                value={form.cyclesDone}
                onChange={(e) => setForm({ ...form, cyclesDone: Number(e.target.value) })}
                className="w-full rounded-lg border border-black/10 px-4 py-3"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Total</label>
              <input
                type="number"
                min={0}
                value={form.cyclesTotal}
                onChange={(e) => setForm({ ...form, cyclesTotal: Number(e.target.value) })}
                className="w-full rounded-lg border border-black/10 px-4 py-3"
              />
            </div>
          </div>
        </div>
        <input
          placeholder="Profesionales a cargo"
          value={form.professionals}
          onChange={(e) => setForm({ ...form, professionals: e.target.value })}
          className="rounded-lg border border-black/10 px-4 py-3"
        />
        <input
          placeholder="Centro médico"
          value={form.center}
          onChange={(e) => setForm({ ...form, center: e.target.value })}
          className="rounded-lg border border-black/10 px-4 py-3"
        />
        <textarea
          placeholder="Notas"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          className="rounded-lg border border-black/10 px-4 py-3"
        />
        {form.cyclesTotal > 0 && (
          <div>
            <div className="mb-1 flex justify-between text-xs font-semibold text-ink-500">
              <span>Progreso de ciclos</span>
              <span>
                {form.cyclesDone}/{form.cyclesTotal}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-lavender-50">
              <div
                className="h-full rounded-full bg-lavender-600"
                style={{ width: `${Math.min(100, (form.cyclesDone / form.cyclesTotal) * 100)}%` }}
              />
            </div>
          </div>
        )}
        <Button type="submit" className="mt-2 w-full">
          Guardar
        </Button>
        {saved && <p className="text-center text-sm font-semibold text-teal-600">Guardado ✓</p>}
      </form>
    </Card>
  )
}

function MedicationTab() {
  const { data, addMedication, removeMedication, logMedication } = useData()
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyMed)
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | 'unsupported'>(
    'Notification' in window ? Notification.permission : 'unsupported',
  )
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (notifStatus !== 'granted' || !('Notification' in window)) return
    const timers: number[] = []
    for (const med of data.medications) {
      if (!med.active) continue
      for (const time of med.schedule) {
        const [h, m] = time.split(':').map(Number)
        const target = new Date()
        target.setHours(h, m, 0, 0)
        const ms = target.getTime() - Date.now()
        if (ms > 0 && ms < 1000 * 60 * 60 * 12) {
          const id = window.setTimeout(() => {
            new Notification('Núcleo · Hora de tu medicación', {
              body: `${med.name} · ${med.dose}`,
            })
          }, ms)
          timers.push(id)
        }
      }
    }
    return () => timers.forEach((t) => clearTimeout(t))
  }, [data.medications, notifStatus])

  async function enableNotifications() {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifStatus(perm)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    addMedication(form)
    setForm(emptyMed)
    setFormOpen(false)
  }

  function logStatus(medId: string, status: MedicationStatus) {
    logMedication({ medicationId: medId, date: todayStr, time: format(new Date(), 'HH:mm'), status })
  }

  function todayStatus(medId: string): MedicationStatus | null {
    const log = data.medicationLogs.find((l) => l.date === todayStr && l.medicationId === medId)
    return log?.status ?? null
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Disclaimer tone={notifStatus === 'granted' ? 'info' : 'warning'}>
          {notifStatus === 'granted'
            ? 'Los recordatorios están activos mientras tengas Núcleo abierto en este dispositivo.'
            : 'Activá notificaciones para que Núcleo te avise a la hora de cada toma (funciona mientras la app esté abierta en este dispositivo).'}
        </Disclaimer>
      </div>
      {notifStatus !== 'granted' && notifStatus !== 'unsupported' && (
        <Button variant="secondary" onClick={enableNotifications} className="self-start">
          <Bell size={16} /> Activar recordatorios
        </Button>
      )}

      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={18} /> Nueva medicación
        </Button>
      </div>

      {data.medications.length === 0 ? (
        <EmptyState title="Sin medicación cargada" description="Agregá los medicamentos indicados por tu equipo médico." />
      ) : (
        <div className="flex flex-col gap-3">
          {data.medications.map((med) => (
            <MedicationCard
              key={med.id}
              med={med}
              status={todayStatus(med.id)}
              onLog={(s) => logStatus(med.id, s)}
              onRemove={() => removeMedication(med.id)}
            />
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nueva medicación">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            required
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-black/10 px-4 py-3"
          />
          <input
            required
            placeholder="Dosis (ej: 500mg)"
            value={form.dose}
            onChange={(e) => setForm({ ...form, dose: e.target.value })}
            className="rounded-lg border border-black/10 px-4 py-3"
          />
          <input
            required
            type="time"
            value={form.schedule[0]}
            onChange={(e) => setForm({ ...form, schedule: [e.target.value] })}
            className="rounded-lg border border-black/10 px-4 py-3"
          />
          <input
            placeholder="Motivo (opcional)"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className="rounded-lg border border-black/10 px-4 py-3"
          />
          <Button type="submit" className="mt-2 w-full">
            Guardar
          </Button>
        </form>
      </Modal>
    </div>
  )
}

function MedicationCard({
  med,
  status,
  onLog,
  onRemove,
}: {
  med: Medication
  status: MedicationStatus | null
  onLog: (s: MedicationStatus) => void
  onRemove: () => void
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display font-semibold text-ink-900">
            {med.name} <span className="font-normal text-ink-500">· {med.dose}</span>
          </p>
          <p className="text-xs text-ink-500">Horario: {med.schedule.join(', ')}</p>
          {med.reason && <p className="mt-1 text-xs text-ink-500">Motivo: {med.reason}</p>}
        </div>
        <button onClick={onRemove} className="rounded-full p-2 text-coral-600 hover:bg-red-50">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onLog('tomada')}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
            status === 'tomada' ? 'bg-teal-500 text-white' : 'bg-teal-50 text-teal-600'
          }`}
        >
          <Check size={14} /> Tomada
        </button>
        <button
          onClick={() => onLog('no_tomada')}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
            status === 'no_tomada' ? 'bg-ink-500 text-white' : 'bg-gray-100 text-ink-500'
          }`}
        >
          <X size={14} /> No tomada
        </button>
        <button
          onClick={() => onLog('vomitada')}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
            status === 'vomitada' ? 'bg-coral-500 text-white' : 'bg-red-50 text-coral-600'
          }`}
        >
          <AlertTriangle size={14} /> Vomitada
        </button>
        {status && <Badge tone="gray">Hoy</Badge>}
      </div>
    </Card>
  )
}
