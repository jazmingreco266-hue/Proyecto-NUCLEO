import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Appointment, SymptomEntry } from './types'

export interface Insight {
  id: string
  text: string
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function last(entries: SymptomEntry[], n: number): SymptomEntry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, n)
}

/**
 * Motor de patrones 100% local y transparente: no llama a ningún servicio
 * externo ni interpreta información clínica. Solo cruza los datos que la
 * persona registró para mostrarle patrones que quizás no notó a simple
 * vista. Nunca sugiere diagnósticos, causas médicas ni cambios de
 * tratamiento — eso es, siempre, tarea del equipo médico.
 */
export function buildInsights(symptoms: SymptomEntry[], appointments: Appointment[]): Insight[] {
  const insights: Insight[] = []
  if (symptoms.length < 3) {
    insights.push({
      id: 'need-more-data',
      text: 'Registrá al menos unos días más para que empecemos a mostrarte patrones sobre tu evolución.',
    })
    return insights
  }

  const recent = last(symptoms, 3)
  const previous = last(symptoms, 6).slice(3)

  const fields: { key: keyof SymptomEntry; label: string }[] = [
    { key: 'fatigue', label: 'cansancio' },
    { key: 'nausea', label: 'náuseas' },
    { key: 'pain', label: 'dolor' },
  ]

  for (const f of fields) {
    const recentAvg = average(recent.map((e) => Number(e[f.key])))
    const prevAvg = average(previous.map((e) => Number(e[f.key])))
    if (previous.length >= 2) {
      const diff = recentAvg - prevAvg
      if (diff >= 1.5) {
        insights.push({
          id: `up-${f.key}`,
          text: `Tu ${f.label} viene más alto en los últimos días (promedio ${recentAvg.toFixed(1)}/10 vs ${prevAvg.toFixed(1)}/10 antes). Puede ser útil comentarlo en tu próxima consulta.`,
        })
      } else if (diff <= -1.5) {
        insights.push({
          id: `down-${f.key}`,
          text: `Tu ${f.label} viene bajando en los últimos días (promedio ${recentAvg.toFixed(1)}/10 vs ${prevAvg.toFixed(1)}/10 antes). 🎉`,
        })
      }
    }
  }

  const moodAvg = average(recent.map((e) => e.mood))
  if (moodAvg <= 2.3) {
    insights.push({
      id: 'mood-low',
      text: 'Tu ánimo estuvo bajo en los últimos registros. Está bien no estar bien todos los días — si sentís que se sostiene, contárselo a tu equipo o a alguien de confianza puede ayudar.',
    })
  }

  // Patrón por días desde la última quimio: ¿hay un día "pico" recurrente?
  const chemoDates = appointments
    .filter((a) => a.type === 'quimio')
    .map((a) => parseISO(a.date))
    .sort((a, b) => a.getTime() - b.getTime())

  if (chemoDates.length >= 1) {
    const byOffset = new Map<number, number[]>()
    for (const s of symptoms) {
      const symptomDate = parseISO(s.date)
      const pastSessions = chemoDates.filter((c) => c <= symptomDate)
      if (pastSessions.length === 0) continue
      const closest = pastSessions[pastSessions.length - 1]
      const offset = differenceInCalendarDays(symptomDate, closest)
      if (offset < 0 || offset > 10) continue
      const list = byOffset.get(offset) ?? []
      list.push((s.fatigue + s.nausea) / 2)
      byOffset.set(offset, list)
    }
    let worstOffset = -1
    let worstAvg = -1
    for (const [offset, values] of byOffset) {
      if (values.length < 2) continue
      const avg = average(values)
      if (avg > worstAvg) {
        worstAvg = avg
        worstOffset = offset
      }
    }
    if (worstOffset >= 0 && worstAvg >= 4) {
      insights.push({
        id: 'cycle-pattern',
        text: `En tus registros, el día ${worstOffset === 0 ? 'de la sesión' : `+${worstOffset} después de la quimio`} suele ser el más pesado en cansancio y náuseas. Puede servirte para organizar esos días con menos exigencias.`,
      })
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: 'stable',
      text: 'Tus registros se mantienen estables en los últimos días. Seguí anotando: cuantos más días registres, más útiles van a ser estos patrones.',
    })
  }

  return insights.slice(0, 4)
}
