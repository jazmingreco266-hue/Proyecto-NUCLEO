import { useState } from 'react'
import { Phone, MessageCircle, Plus, Trash2, ShieldAlert, HelpCircle, CheckCircle2, Circle } from 'lucide-react'
import { useData } from '@/lib/data'
import { CONTACT_LABELS } from '@/lib/labels'
import type { ContactCategory } from '@/lib/types'
import { Badge, Button, Card, Disclaimer, EmptyState, Modal, PageHeader } from '@/components/ui'

const TABS = ['contactos', 'plan', 'preguntas'] as const

export default function Contactos() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('contactos')

  return (
    <div>
      <PageHeader title="Contactos y comunicación" subtitle="Tu equipo, tu plan de acción y tus preguntas pendientes." icon={<Phone size={22} />} />

      <div className="mb-5 flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t ? 'bg-lavender-500 text-white' : 'text-ink-500'
            }`}
          >
            {t === 'contactos' ? 'Contactos' : t === 'plan' ? 'Plan de acción' : 'Preguntas'}
          </button>
        ))}
      </div>

      {tab === 'contactos' && <ContactosTab />}
      {tab === 'plan' && <PlanTab />}
      {tab === 'preguntas' && <PreguntasTab />}
    </div>
  )
}

function ContactosTab() {
  const { data, addContact, removeContact } = useData()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'oncologo' as ContactCategory, phone: '', whatsapp: '', notes: '' })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    addContact(form)
    setForm({ name: '', category: 'oncologo', phone: '', whatsapp: '', notes: '' })
    setOpen(false)
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus size={18} /> Nuevo contacto
        </Button>
      </div>
      {data.contacts.length === 0 ? (
        <EmptyState title="Sin contactos cargados" description="Sumá a tu oncólogo, enfermería, guardia y farmacia." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.contacts.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display font-bold text-ink-900">{c.name}</p>
                  <Badge tone="lavender">{CONTACT_LABELS[c.category]}</Badge>
                </div>
                <button onClick={() => removeContact(c.id)} className="rounded-full p-2 text-coral-600 hover:bg-red-50">
                  <Trash2 size={16} />
                </button>
              </div>
              {c.notes && <p className="mt-2 text-xs text-ink-500">{c.notes}</p>}
              <div className="mt-3 flex gap-2">
                <a
                  href={`tel:${c.phone}`}
                  className="flex flex-1 items-center justify-center gap-1 rounded-full bg-teal-50 py-2 text-xs font-bold text-teal-600"
                >
                  <Phone size={14} /> Llamar
                </a>
                {c.whatsapp && (
                  <a
                    href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-lavender-50 py-2 text-xs font-bold text-lavender-600"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo contacto">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            required
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-2xl border border-black/10 px-4 py-3"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as ContactCategory })}
            className="rounded-2xl border border-black/10 px-4 py-3"
          >
            {Object.entries(CONTACT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Teléfono"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-2xl border border-black/10 px-4 py-3"
          />
          <input
            placeholder="WhatsApp (opcional, con código de país)"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            className="rounded-2xl border border-black/10 px-4 py-3"
          />
          <input
            placeholder="Notas (opcional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="rounded-2xl border border-black/10 px-4 py-3"
          />
          <Button type="submit" className="mt-2 w-full">
            Guardar
          </Button>
        </form>
      </Modal>
    </div>
  )
}

function PlanTab() {
  const { data, addActionPlanItem, removeActionPlanItem } = useData()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ condition: '', action: '', phone: '' })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    addActionPlanItem(form)
    setForm({ condition: '', action: '', phone: '' })
    setOpen(false)
  }

  return (
    <div>
      <Disclaimer tone="warning">
        <strong>Esta indicación fue registrada por tu equipo médico.</strong> Núcleo no determina
        la gravedad de un síntoma ni decide cuándo es una emergencia.
      </Disclaimer>
      <div className="my-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus size={18} /> Agregar indicación
        </Button>
      </div>
      {data.actionPlan.length === 0 ? (
        <EmptyState
          title="Todavía no cargaste tu plan de acción"
          description='Ej: "Si la fiebre supera 38°, llamar a guardia oncológica al ___". Cargalo tal como te lo indicó tu médico.'
        />
      ) : (
        <div className="flex flex-col gap-3">
          {data.actionPlan.map((item) => (
            <Card key={item.id}>
              <div className="flex items-start gap-3">
                <ShieldAlert size={20} className="mt-0.5 shrink-0 text-peach-500" />
                <div className="flex-1">
                  <p className="font-bold text-ink-900">Si: {item.condition}</p>
                  <p className="text-sm text-ink-700">→ {item.action}</p>
                  {item.phone && (
                    <a href={`tel:${item.phone}`} className="mt-1 inline-block text-sm font-bold text-teal-600">
                      📞 {item.phone}
                    </a>
                  )}
                </div>
                <button onClick={() => removeActionPlanItem(item.id)} className="rounded-full p-2 text-coral-600 hover:bg-red-50">
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nueva indicación del equipo médico">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            required
            placeholder="Si sucede esto… (ej: fiebre mayor a 38°)"
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value })}
            className="rounded-2xl border border-black/10 px-4 py-3"
          />
          <input
            required
            placeholder="Hacer esto… (ej: llamar a guardia oncológica)"
            value={form.action}
            onChange={(e) => setForm({ ...form, action: e.target.value })}
            className="rounded-2xl border border-black/10 px-4 py-3"
          />
          <input
            placeholder="Teléfono asociado (opcional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-2xl border border-black/10 px-4 py-3"
          />
          <Button type="submit" className="mt-2 w-full">
            Guardar
          </Button>
        </form>
      </Modal>
    </div>
  )
}

function PreguntasTab() {
  const { data, addQuestion, toggleQuestionAnswered, removeQuestion } = useData()
  const [text, setText] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    addQuestion(text.trim())
    setText('')
  }

  const pending = data.questions.filter((q) => !q.answered)
  const answered = data.questions.filter((q) => q.answered)

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          placeholder="Escribí una pregunta para tu próxima consulta…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-2xl border border-black/10 px-4 py-3"
        />
        <Button type="submit">
          <Plus size={18} />
        </Button>
      </form>

      <div className="mt-6">
        <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-bold text-ink-500">
          <HelpCircle size={16} /> Pendientes ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-ink-500">No tenés preguntas pendientes.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((q) => (
              <li key={q.id} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3">
                <button onClick={() => toggleQuestionAnswered(q.id)} className="text-ink-500">
                  <Circle size={18} />
                </button>
                <p className="flex-1 text-sm text-ink-900">{q.text}</p>
                <button onClick={() => removeQuestion(q.id)} className="rounded-full p-1 text-coral-600 hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {answered.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 font-display text-sm font-bold text-ink-500">Respondidas</h3>
          <ul className="space-y-2">
            {answered.map((q) => (
              <li key={q.id} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/60 p-3 opacity-70">
                <button onClick={() => toggleQuestionAnswered(q.id)} className="text-teal-600">
                  <CheckCircle2 size={18} />
                </button>
                <p className="flex-1 text-sm text-ink-900 line-through">{q.text}</p>
                <button onClick={() => removeQuestion(q.id)} className="rounded-full p-1 text-coral-600 hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
