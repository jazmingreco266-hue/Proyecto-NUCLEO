import { useMemo, useState } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ClipboardList, Sparkles, Trash2 } from 'lucide-react'
import { useData } from '@/lib/data'
import { buildInsights } from '@/lib/insights'
import type { AppetiteLevel, SleepQuality } from '@/lib/types'
import { Button, Card, Disclaimer, PageHeader, ScoreSlider } from '@/components/ui'

const MOOD_EMOJIS = ['😞', '😕', '🙂', '😄', '🤩']
const APPETITE_OPTS: { value: AppetiteLevel; label: string }[] = [
  { value: 'bajo', label: 'Bajo' },
  { value: 'normal', label: 'Normal' },
  { value: 'bueno', label: 'Bueno' },
]
const SLEEP_OPTS: { value: SleepQuality; label: string }[] = [
  { value: 'mal', label: 'Mal' },
  { value: 'regular', label: 'Regular' },
  { value: 'bien', label: 'Bien' },
]

export default function Registro() {
  const { data, removeSymptomEntry } = useData()
  const [tab, setTab] = useState<'registro' | 'evolucion'>('registro')

  return (
    <div>
      <PageHeader
        title="Registro y evolución"
        subtitle="Un minuto por día alcanza. Nosotros armamos el resto."
        icon={<ClipboardList size={22} />}
      />

      <div className="mb-5 inline-flex rounded-full bg-white p-1 shadow-sm">
        {(['registro', 'evolucion'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t ? 'bg-lavender-500 text-white' : 'text-ink-500'
            }`}
          >
            {t === 'registro' ? 'Registro diario' : 'Evolución'}
          </button>
        ))}
      </div>

      {tab === 'registro' ? (
        <RegistroForm />
      ) : (
        <Evolucion symptoms={data.symptoms} appointments={data.appointments} />
      )}

      {tab === 'registro' && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Historial</h2>
          {data.symptoms.length === 0 ? (
            <p className="text-sm text-ink-500">Todavía no registraste ningún día.</p>
          ) : (
            <ul className="space-y-2">
              {data.symptoms.slice(0, 12).map((s) => (
                <li key={s.id} className="flex items-start gap-3 rounded-2xl border border-black/5 bg-white p-3">
                  <span className="text-2xl">{MOOD_EMOJIS[s.mood - 1]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink-900">
                      {format(parseISO(s.date), "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                    <p className="text-xs text-ink-500">
                      Dolor {s.pain}/10 · Cansancio {s.fatigue}/10 · Náuseas {s.nausea}/10 · Apetito {s.appetite}
                    </p>
                    {s.note && <p className="mt-1 text-sm text-ink-700">"{s.note}"</p>}
                  </div>
                  <button
                    onClick={() => removeSymptomEntry(s.id)}
                    className="rounded-full p-2 text-coral-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function RegistroForm() {
  const { data, addSymptomEntry, removeSymptomEntry } = useData()
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const existing = data.symptoms.find((s) => s.date === todayStr)

  const [mood, setMood] = useState<number>(existing?.mood ?? 3)
  const [pain, setPain] = useState(existing?.pain ?? 0)
  const [fatigue, setFatigue] = useState(existing?.fatigue ?? 0)
  const [nausea, setNausea] = useState(existing?.nausea ?? 0)
  const [appetite, setAppetite] = useState<AppetiteLevel>(existing?.appetite ?? 'normal')
  const [fluidsMl, setFluidsMl] = useState(existing?.fluidsMl ?? 1000)
  const [temperature, setTemperature] = useState<string>(
    existing?.temperature != null ? String(existing.temperature) : '',
  )
  const [sleep, setSleep] = useState<SleepQuality>(existing?.sleep ?? 'regular')
  const [note, setNote] = useState(existing?.note ?? '')
  const [saved, setSaved] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (existing) removeSymptomEntry(existing.id)
    addSymptomEntry({
      date: todayStr,
      mood: mood as 1 | 2 | 3 | 4 | 5,
      pain,
      fatigue,
      nausea,
      appetite,
      fluidsMl,
      temperature: temperature === '' ? null : Number(temperature),
      sleep,
      note,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-sm font-bold text-ink-700">¿Cómo te sentís hoy?</p>
          <div className="flex justify-between">
            {MOOD_EMOJIS.map((emoji, i) => (
              <button
                type="button"
                key={emoji}
                onClick={() => setMood(i + 1)}
                className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl transition ${
                  mood === i + 1 ? 'bg-lavender-100 ring-2 ring-lavender-400' : 'hover:bg-black/5'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <ScoreSlider label="Dolor" value={pain} onChange={setPain} />
        <ScoreSlider label="Cansancio" value={fatigue} onChange={setFatigue} />
        <ScoreSlider label="Náuseas" value={nausea} onChange={setNausea} />

        <div>
          <p className="mb-2 text-sm font-bold text-ink-700">Apetito</p>
          <div className="flex gap-2">
            {APPETITE_OPTS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setAppetite(opt.value)}
                className={`flex-1 rounded-xl py-2 text-sm font-bold ${
                  appetite === opt.value ? 'bg-lavender-500 text-white' : 'bg-lavender-50 text-ink-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold text-ink-700">¿Cuánto líquido tomaste? ({fluidsMl} ml)</p>
          <input
            type="range"
            min={0}
            max={3000}
            step={250}
            value={fluidsMl}
            onChange={(e) => setFluidsMl(Number(e.target.value))}
            className="w-full accent-teal-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-2 text-sm font-bold text-ink-700">Temperatura (°C)</p>
            <input
              type="number"
              step="0.1"
              placeholder="Opcional"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full rounded-2xl border border-black/10 px-4 py-3"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-ink-700">¿Cómo dormiste?</p>
            <div className="flex gap-1">
              {SLEEP_OPTS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setSleep(opt.value)}
                  className={`flex-1 rounded-xl py-3 text-xs font-bold ${
                    sleep === opt.value ? 'bg-teal-500 text-white' : 'bg-teal-50 text-ink-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold text-ink-700">Nota (opcional)</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Algo que quieras recordar de hoy…"
            className="w-full rounded-2xl border border-black/10 px-4 py-3"
          />
        </div>

        <Button type="submit" className="w-full">
          {existing ? 'Actualizar registro de hoy' : 'Guardar registro de hoy'}
        </Button>
        {saved && <p className="text-center text-sm font-bold text-teal-600">Guardado ✓</p>}
      </form>
    </Card>
  )
}

function Evolucion({
  symptoms,
  appointments,
}: {
  symptoms: import('@/lib/types').SymptomEntry[]
  appointments: import('@/lib/types').Appointment[]
}) {
  const [range, setRange] = useState(14)
  const insights = useMemo(() => buildInsights(symptoms, appointments), [symptoms, appointments])

  const chartData = useMemo(() => {
    const from = subDays(new Date(), range - 1)
    const days: { date: string; label: string; Dolor?: number; Cansancio?: number; Náuseas?: number }[] = []
    for (let i = 0; i < range; i++) {
      const d = new Date(from)
      d.setDate(from.getDate() + i)
      const key = format(d, 'yyyy-MM-dd')
      const entry = symptoms.find((s) => s.date === key)
      days.push({
        date: key,
        label: format(d, 'd/M'),
        Dolor: entry?.pain,
        Cansancio: entry?.fatigue,
        Náuseas: entry?.nausea,
      })
    }
    return days
  }, [symptoms, range])

  return (
    <div className="flex flex-col gap-5">
      <Card className="bg-gradient-to-br from-lavender-50 to-teal-50">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-lavender-600">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-ink-900">Patrones de tus registros</p>
            <ul className="mt-2 space-y-2 text-sm text-ink-700">
              {insights.map((i) => (
                <li key={i.id}>• {i.text}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-500">
              Esto es un análisis de patrones sobre lo que vos misma/o registraste, generado
              localmente en tu dispositivo. No es un diagnóstico ni reemplaza a tu equipo médico.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">Evolución de síntomas</h3>
          <div className="flex gap-1">
            {[7, 14, 30].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  range === r ? 'bg-lavender-500 text-white' : 'bg-lavender-50 text-ink-700'
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Dolor" stroke="#ff6f6f" connectNulls strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Cansancio" stroke="#8f74e0" connectNulls strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Náuseas" stroke="#3fb99b" connectNulls strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Disclaimer>
        Estos gráficos muestran solo lo que vos registraste. Compartirlos con tu equipo médico
        puede ayudar a que entiendan mejor cómo vas atravesando el tratamiento.
      </Disclaimer>
    </div>
  )
}
