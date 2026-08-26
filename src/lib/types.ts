export type Role = 'paciente' | 'familiar'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  relationship?: string // ej: "Hija", "Esposo" (solo si role === 'familiar')
  avatarDataUrl?: string
  circleId: string
  circleCode: string
  pinHash?: string
  createdAt: string
  authProvider: 'password' | 'google'
}

export interface CirclePermissions {
  verAgenda: boolean
  recibirRecordatorios: boolean
  registrarComoEstuvo: boolean
  subirDocumentos: boolean
  verMedicacion: boolean
}

export interface CircleMember {
  id: string
  userId: string
  name: string
  role: Role
  relationship?: string
  permissions: CirclePermissions
  joinedAt: string
}

export type AppointmentType =
  | 'quimio'
  | 'radio'
  | 'consulta'
  | 'estudio'
  | 'analisis'
  | 'cirugia'
  | 'otro'

export interface Appointment {
  id: string
  type: AppointmentType
  title: string
  date: string // yyyy-MM-dd
  time: string // HH:mm
  location?: string
  professional?: string
  notes?: string
  reminder: boolean
  cycleNumber?: number
  done: boolean
}

export interface TreatmentInfo {
  name: string
  startDate: string
  cyclesTotal: number
  cyclesDone: number
  professionals: string
  center: string
  notes: string
}

export interface Medication {
  id: string
  name: string
  dose: string
  schedule: string[] // HH:mm[]
  reason: string
  active: boolean
}

export type MedicationStatus = 'tomada' | 'no_tomada' | 'vomitada'

export interface MedicationLog {
  id: string
  medicationId: string
  date: string
  time: string
  status: MedicationStatus
}

export type AppetiteLevel = 'bajo' | 'normal' | 'bueno'
export type SleepQuality = 'mal' | 'regular' | 'bien'

export interface SymptomEntry {
  id: string
  date: string // yyyy-MM-dd
  mood: 1 | 2 | 3 | 4 | 5
  pain: number // 0-10
  fatigue: number // 0-10
  nausea: number // 0-10
  appetite: AppetiteLevel
  fluidsMl: number
  temperature: number | null
  sleep: SleepQuality
  note: string
  createdAt: string
}

export interface ActionPlanItem {
  id: string
  condition: string
  action: string
  phone?: string
}

export interface ConsultQuestion {
  id: string
  text: string
  answered: boolean
  answerNote?: string
  createdAt: string
}

export type ContactCategory =
  | 'oncologo'
  | 'enfermeria'
  | 'guardia'
  | 'centro'
  | 'obra_social'
  | 'farmacia'
  | 'familiar'
  | 'otro'

export interface Contact {
  id: string
  name: string
  category: ContactCategory
  phone: string
  whatsapp?: string
  notes?: string
}

export type DocumentCategory =
  | 'receta'
  | 'orden'
  | 'estudio'
  | 'indicacion'
  | 'analisis'
  | 'credencial'
  | 'otro'

export interface DocumentFile {
  id: string
  name: string
  category: DocumentCategory
  dataUrl: string
  mimeType: string
  uploadedAt: string
}

export type SupplementStatus =
  | 'pendiente'
  | 'autorizado'
  | 'no_autorizado'
  | 'suspendido'
  | 'no_revisado'

export interface Supplement {
  id: string
  name: string
  status: SupplementStatus
  note?: string
}

export interface GalleryPhoto {
  id: string
  dataUrl: string
  caption: string
  addedAt: string
}

export interface CaregiverTask {
  id: string
  text: string
  done: boolean
  assignedTo?: string
}

export interface AccessLogEntry {
  id: string
  who: string
  action: string
  at: string
}

export interface AppData {
  treatment: TreatmentInfo
  appointments: Appointment[]
  medications: Medication[]
  medicationLogs: MedicationLog[]
  symptoms: SymptomEntry[]
  actionPlan: ActionPlanItem[]
  questions: ConsultQuestion[]
  contacts: Contact[]
  documents: DocumentFile[]
  supplements: Supplement[]
  gallery: GalleryPhoto[]
  caregiverTasks: CaregiverTask[]
  circle: CircleMember[]
  accessLog: AccessLogEntry[]
}
