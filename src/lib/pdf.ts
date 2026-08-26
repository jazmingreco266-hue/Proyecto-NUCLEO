import { format, parseISO, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { AppData } from './types'

export async function generateDoctorSummaryPdf(
  patientName: string,
  data: AppData,
  days: 7 | 14 | 30,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const marginX = 16
  let y = 20
  const pageHeight = doc.internal.pageSize.getHeight()

  function line(text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) {
    const { size = 11, bold = false, color = [40, 35, 55] } = opts
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...color)
    const split = doc.splitTextToSize(text, 180)
    for (const s of split) {
      if (y > pageHeight - 20) {
        doc.addPage()
        y = 20
      }
      doc.text(s, marginX, y)
      y += size * 0.55
    }
  }

  function spacer(h = 4) {
    y += h
  }

  const from = subDays(new Date(), days - 1)
  const fromStr = format(from, 'yyyy-MM-dd')

  doc.setFillColor(143, 116, 224)
  doc.rect(0, 0, 210, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Núcleo · Resumen para el equipo médico', marginX, 9.5)
  y = 24

  line(`Paciente: ${patientName}`, { size: 14, bold: true })
  line(`Período: últimos ${days} días (${format(from, "d MMM", { locale: es })} — ${format(new Date(), "d MMM yyyy", { locale: es })})`)
  spacer(6)

  if (data.treatment.name) {
    line('Tratamiento', { size: 13, bold: true, color: [117, 93, 201] })
    line(`${data.treatment.name} · ciclo ${data.treatment.cyclesDone}/${data.treatment.cyclesTotal || '-'}`)
    if (data.treatment.center) line(`Centro: ${data.treatment.center}`)
    if (data.treatment.professionals) line(`Profesionales: ${data.treatment.professionals}`)
    spacer(6)
  }

  line('Registro diario de síntomas', { size: 13, bold: true, color: [117, 93, 201] })
  const entries = data.symptoms.filter((s) => s.date >= fromStr).sort((a, b) => (a.date < b.date ? -1 : 1))
  if (entries.length === 0) {
    line('Sin registros en este período.')
  } else {
    for (const e of entries) {
      line(
        `${format(parseISO(e.date), 'dd/MM')} — Ánimo ${e.mood}/5 · Dolor ${e.pain}/10 · Cansancio ${e.fatigue}/10 · Náuseas ${e.nausea}/10 · Apetito ${e.appetite} · Sueño ${e.sleep}${
          e.temperature != null ? ` · Temp ${e.temperature}°C` : ''
        }`,
        { size: 10 },
      )
      if (e.note) line(`   Nota: ${e.note}`, { size: 9, color: [110, 100, 130] })
    }
  }
  spacer(6)

  line('Medicación', { size: 13, bold: true, color: [117, 93, 201] })
  const medLogs = data.medicationLogs.filter((l) => l.date >= fromStr)
  if (medLogs.length === 0) {
    line('Sin registros de toma en este período.')
  } else {
    const grouped = new Map<string, { tomada: number; no_tomada: number; vomitada: number }>()
    for (const l of medLogs) {
      const med = data.medications.find((m) => m.id === l.medicationId)
      const name = med?.name ?? 'Medicación eliminada'
      const g = grouped.get(name) ?? { tomada: 0, no_tomada: 0, vomitada: 0 }
      g[l.status]++
      grouped.set(name, g)
    }
    for (const [name, counts] of grouped) {
      line(`${name}: tomada ${counts.tomada} · no tomada ${counts.no_tomada} · vomitada ${counts.vomitada}`, {
        size: 10,
      })
    }
  }
  spacer(8)

  line(
    'Este resumen fue generado automáticamente a partir de datos autoinformados por el paciente y/o su familia en la app Núcleo. No constituye un diagnóstico ni una interpretación clínica.',
    { size: 8, color: [130, 120, 150] },
  )

  doc.save(`nucleo-resumen-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}
