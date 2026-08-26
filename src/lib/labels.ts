import type {
  AppointmentType,
  ContactCategory,
  DocumentCategory,
  SupplementStatus,
} from './types'

export const APPOINTMENT_LABELS: Record<AppointmentType, string> = {
  quimio: 'Quimioterapia',
  radio: 'Radioterapia',
  consulta: 'Consulta',
  estudio: 'Estudio',
  analisis: 'Análisis',
  cirugia: 'Cirugía',
  otro: 'Otro',
}

export const APPOINTMENT_COLORS: Record<AppointmentType, string> = {
  quimio: 'lavender',
  radio: 'teal',
  consulta: 'peach',
  estudio: 'lavender',
  analisis: 'teal',
  cirugia: 'coral',
  otro: 'gray',
}

export const CONTACT_LABELS: Record<ContactCategory, string> = {
  oncologo: 'Oncólogo/a',
  enfermeria: 'Enfermería',
  guardia: 'Guardia',
  centro: 'Centro de tratamiento',
  obra_social: 'Obra social',
  farmacia: 'Farmacia',
  familiar: 'Familiar',
  otro: 'Otro',
}

export const DOCUMENT_LABELS: Record<DocumentCategory, string> = {
  receta: 'Receta',
  orden: 'Orden médica',
  estudio: 'Estudio',
  indicacion: 'Indicación',
  analisis: 'Análisis',
  credencial: 'Credencial',
  otro: 'Otro',
}

export const SUPPLEMENT_LABELS: Record<SupplementStatus, string> = {
  pendiente: 'Pendiente de consultar',
  autorizado: 'Autorizado por el profesional',
  no_autorizado: 'No autorizado',
  suspendido: 'Suspendido',
  no_revisado: 'No revisado',
}

export const SUPPLEMENT_TONES: Record<SupplementStatus, 'gray' | 'teal' | 'coral' | 'peach'> = {
  pendiente: 'peach',
  autorizado: 'teal',
  no_autorizado: 'coral',
  suspendido: 'coral',
  no_revisado: 'gray',
}
