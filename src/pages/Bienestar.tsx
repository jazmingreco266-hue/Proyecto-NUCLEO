import { useState } from 'react'
import { Sparkles, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { useData } from '@/lib/data'
import { OFFICIAL_RESOURCES, WELLBEING_STORIES } from '@/lib/wellbeingContent'
import { FUN_FACTS, funFactOfTheDay } from '@/lib/funFacts'
import { SUPPLEMENT_LABELS, SUPPLEMENT_TONES } from '@/lib/labels'
import type { SupplementStatus } from '@/lib/types'
import { Badge, Button, Card, Disclaimer, EmptyState, Modal, PageHeader } from '@/components/ui'

const TABS = ['consejos', 'testimonios', 'suplementos', 'funfacts'] as const

export default function Bienestar() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('consejos')

  return (
    <div>
      <PageHeader title="Bienestar" subtitle="Contención, consejos oficiales y espacio para respirar." icon={<Sparkles size={22} />} />

      <div className="mb-5 flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t ? 'bg-lavender-500 text-white' : 'text-ink-500'
            }`}
          >
            {t === 'consejos' ? 'Consejos' : t === 'testimonios' ? 'Testimonios y dietas' : t === 'suplementos' ? 'Suplementos' : 'Fun facts'}
          </button>
        ))}
      </div>

      {tab === 'consejos' && <Consejos />}
      {tab === 'testimonios' && <Testimonios />}
      {tab === 'suplementos' && <Suplementos />}
      {tab === 'funfacts' && <FunFactsArchive />}
    </div>
  )
}

function Consejos() {
  return (
    <div className="flex flex-col gap-3">
      <Disclaimer>
        Estas son fuentes oficiales y sin fines comerciales, pensadas para pacientes y familias.
        Núcleo no agrega interpretaciones propias sobre esta información.
      </Disclaimer>
      {OFFICIAL_RESOURCES.map((r) => (
        <a
          key={r.url}
          href={r.url}
          target="_blank"
          rel="noreferrer"
          className="card-soft flex items-start justify-between gap-3 p-5 transition hover:-translate-y-0.5"
        >
          <div>
            <p className="font-display font-bold text-ink-900">{r.title}</p>
            <p className="text-xs font-bold text-lavender-600">{r.org}</p>
            <p className="mt-1 text-sm text-ink-500">{r.description}</p>
          </div>
          <ExternalLink size={18} className="mt-1 shrink-0 text-ink-500" />
        </a>
      ))}
    </div>
  )
}

function Testimonios() {
  return (
    <div className="flex flex-col gap-3">
      <Disclaimer tone="warning">
        Los testimonios reflejan experiencias personales, no recomendaciones médicas. Las
        "dietas" son hábitos compartidos por otras personas, nunca un plan alimentario: consultá
        siempre con tu nutricionista oncológico antes de cambiar algo en tu alimentación. Núcleo
        no promete curar ni mejorar tu enfermedad con ninguna dieta o práctica.
      </Disclaimer>
      {WELLBEING_STORIES.map((s) => (
        <Card key={s.id}>
          <div className="flex items-center gap-2">
            <Badge tone={s.tag === 'dieta' ? 'teal' : 'lavender'}>{s.tag === 'dieta' ? 'Hábito compartido' : 'Testimonio'}</Badge>
          </div>
          <p className="mt-2 font-display font-bold text-ink-900">{s.title}</p>
          <p className="mt-1 text-sm italic text-ink-700">"{s.text}"</p>
          <p className="mt-2 text-xs font-semibold text-ink-500">— {s.author}</p>
        </Card>
      ))}
    </div>
  )
}

function Suplementos() {
  const { data, upsertSupplement, removeSupplement } = useData()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    upsertSupplement({ name: name.trim(), status: 'pendiente' })
    setName('')
    setOpen(false)
  }

  return (
    <div>
      <Disclaimer tone="warning">
        Ningún suplemento, hierba o producto natural aparece como "seguro" automáticamente.
        Incluso vitaminas aparentemente inofensivas pueden interactuar con tu tratamiento:
        siempre consultá con tu equipo médico antes de tomar algo nuevo.
      </Disclaimer>
      <div className="my-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus size={18} /> Agregar para consultar
        </Button>
      </div>
      {data.supplements.length === 0 ? (
        <EmptyState title="Sin suplementos cargados" description='Agregá lo que quieras consultarle a tu equipo médico.' />
      ) : (
        <div className="flex flex-col gap-2">
          {data.supplements.map((s) => (
            <Card key={s.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-ink-900">{s.name}</p>
                <Badge tone={SUPPLEMENT_TONES[s.status]}>{SUPPLEMENT_LABELS[s.status]}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={s.status}
                  onChange={(e) => upsertSupplement({ id: s.id, name: s.name, status: e.target.value as SupplementStatus })}
                  className="rounded-full border border-black/10 px-3 py-1.5 text-xs"
                >
                  {Object.entries(SUPPLEMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button onClick={() => removeSupplement(s.id)} className="rounded-full p-2 text-coral-600 hover:bg-red-50">
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo suplemento o práctica">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            required
            placeholder="Ej: Vitamina D, jengibre, yoga…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-2xl border border-black/10 px-4 py-3"
          />
          <Button type="submit" className="w-full">
            Agregar como "pendiente de consultar"
          </Button>
        </form>
      </Modal>
    </div>
  )
}

function FunFactsArchive() {
  return (
    <div>
      <Card className="mb-4 bg-gradient-to-br from-peach-50 to-lavender-50">
        <p className="font-display font-bold text-ink-900">✨ El de hoy</p>
        <p className="mt-1 text-sm text-ink-700">{funFactOfTheDay()}</p>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {FUN_FACTS.map((fact) => (
          <div key={fact} className="rounded-2xl bg-white p-4 text-sm text-ink-700 shadow-sm">
            {fact}
          </div>
        ))}
      </div>
    </div>
  )
}
