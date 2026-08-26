import { useMemo, useState } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
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
          <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">Historial</h2>
          {data.symptoms.length === 0 ? (
            <p className="text-sm text-ink-500">Todavía no registraste ningún día.</p>
          ) : (
            <ul className="space-y-2">
              {data.symptoms.slice(0, 12).map((s) => (
                <li key={s.id} className="flex items-start gap-3 rounded-lg border border-black/5 bg-white p-3">
                  <span className="text-2xl">{MOOD_EMOJIS[s.mood - 1]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">
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
          <p className="mb-2 text-sm font-semibold text-ink-700">¿Cómo te sentís hoy?</p>
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
          <p className="mb-2 text-sm font-semibold text-ink-700">Apetito</p>
          <div className="flex gap-2">
            {APPETITE_OPTS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setAppetite(opt.value)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                  appetite === opt.value ? 'bg-lavender-500 text-white' : 'bg-lavender-50 text-ink-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-700">¿Cuánto líquido tomaste? ({fluidsMl} ml)</p>
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
            <p className="mb-2 text-sm font-semibold text-ink-700">Temperatura (°C)</p>
            <input
              type="number"
              step="0.1"
              placeholder="Opcional"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full rounded-lg border border-black/10 px-4 py-3"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-700">¿Cómo dormiste?</p>
            <div className="flex gap-1">
              {SLEEP_OPTS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setSleep(opt.value)}
                  className={`flex-1 rounded-xl py-3 text-xs font-semibold ${
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
          <p className="mb-2 text-sm font-semibold text-ink-700">Nota (opcional)</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Algo que quieras recordar de hoy…"
            className="w-full rounded-lg border border-black/10 px-4 py-3"
          />
        </div>

        <Button type="submit" className="w-full">
          {existing ? 'Actualizar registro de hoy' : 'Guardar registro de hoy'}
        </Button>
        {saved && <p className="text-center text-sm font-semibold text-teal-600">Guardado ✓</p>}
      </form>
    </Card>
  )
}

const CHART_COLORS = {
  pain: '#e11d48',
  fatigue: '#8b3fe8',
  nausea: '#2fa662',
  bad: '#e11d48',
  neutral: '#f08ae0',
  good: '#2fa662',
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function StatTile({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-lg border border-black/5 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink-900">
        {value}
        {suffix && <span className="text-sm font-medium text-ink-500"> {suffix}</span>}
      </p>
    </div>
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

  const inRange = useMemo(() => {
    const fromStr = format(subDays(new Date(), range - 1), 'yyyy-MM-dd')
    return symptoms.filter((s) => s.date >= fromStr)
  }, [symptoms, range])

  const stats = useMemo(() => {
    let streak = 0
    const dates = new Set(symptoms.map((s) => s.date))
    for (let i = 0; i < 365; i++) {
      const key = format(subDays(new Date(), i), 'yyyy-MM-dd')
      if (dates.has(key)) streak++
      else break
    }
    return {
      total: symptoms.length,
      streak,
      moodAvg: average(inRange.map((s) => s.mood)).toFixed(1),
      painAvg: average(inRange.map((s) => s.pain)).toFixed(1),
    }
  }, [symptoms, inRange])

  const appetiteData = useMemo(() => {
    const counts = { bajo: 0, normal: 0, bueno: 0 }
    inRange.forEach((s) => counts[s.appetite]++)
    return [
      { name: 'Bajo', value: counts.bajo, fill: CHART_COLORS.bad },
      { name: 'Normal', value: counts.normal, fill: CHART_COLORS.neutral },
      { name: 'Bueno', value: counts.bueno, fill: CHART_COLORS.good },
    ]
  }, [inRange])

  const sleepData = useMemo(() => {
    const counts = { mal: 0, regular: 0, bien: 0 }
    inRange.forEach((s) => counts[s.sleep]++)
    return [
      { name: 'Mal', value: counts.mal, fill: CHART_COLORS.bad },
      { name: 'Regular', value: counts.regular, fill: CHART_COLORS.neutral },
      { name: 'Bien', value: counts.bien, fill: CHART_COLORS.good },
    ].filter((d) => d.value > 0)
  }, [inRange])

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-l-2 border-l-lavender-600 bg-lavender-50">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-lavender-600">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-ink-900">Patrones de tus registros</p>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Días registrados" value={String(stats.total)} />
        <StatTile label="Racha actual" value={String(stats.streak)} suffix="días" />
        <StatTile label="Ánimo promedio" value={stats.moodAvg} suffix="/5" />
        <StatTile label="Dolor promedio" value={stats.painAvg} suffix="/10" />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-ink-900">Evolución de síntomas</h3>
          <div className="flex gap-1">
            {[7, 14, 30].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
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
              <Line type="monotone" dataKey="Dolor" stroke={CHART_COLORS.pain} connectNulls strokeWidth={2} dot={false} />
              <Line
                type="monotone"
                dataKey="Cansancio"
                stroke={CHART_COLORS.fatigue}
                connectNulls
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Náuseas"
                stroke={CHART_COLORS.nausea}
                connectNulls
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-display text-base font-semibold text-ink-900">Apetito en el período</h3>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={appetiteData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {appetiteData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 font-display text-base font-semibold text-ink-900">Sueño en el período</h3>
          {sleepData.length === 0 ? (
            <p className="flex h-52 items-center justify-center text-sm text-ink-500">
              Todavía no hay registros en este período.
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <PieChart width={176} height={176}>
                <Pie
                  data={sleepData}
                  dataKey="value"
                  nameKey="name"
                  cx={88}
                  cy={88}
                  innerRadius={45}
                  outerRadius={72}
                  paddingAngle={3}
                  isAnimationActive={false}
                >
                  {sleepData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
              <ul className="flex flex-col gap-2 text-sm text-ink-700">
                {sleepData.map((entry) => (
                  <li key={entry.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.fill }} />
                    {entry.name} <span className="text-ink-500">· {entry.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Disclaimer>
        Estos gráficos muestran solo lo que vos registraste. Compartirlos con tu equipo médico
        puede ayudar a que entiendan mejor cómo vas atravesando el tratamiento.
      </Disclaimer>
    </div>
  )
}
