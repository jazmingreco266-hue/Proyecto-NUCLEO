import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { defaultAppData } from './defaultData'
import { getJSON, newId, setJSON } from './storage'
import type {
  AccessLogEntry,
  Appointment,
  CircleMember,
  Contact,
  DocumentFile,
  GalleryPhoto,
  Medication,
  MedicationLog,
  ActionPlanItem,
  AppData,
  Supplement,
  SymptomEntry,
  TreatmentInfo,
} from './types'

interface DataContextValue {
  data: AppData
  logAccess: (action: string) => void

  setTreatment: (t: TreatmentInfo) => void

  addAppointment: (a: Omit<Appointment, 'id' | 'done'>) => void
  updateAppointment: (id: string, patch: Partial<Appointment>) => void
  removeAppointment: (id: string) => void

  addMedication: (m: Omit<Medication, 'id'>) => void
  updateMedication: (id: string, patch: Partial<Medication>) => void
  removeMedication: (id: string) => void
  logMedication: (l: Omit<MedicationLog, 'id'>) => void

  addSymptomEntry: (s: Omit<SymptomEntry, 'id' | 'createdAt'>) => void
  removeSymptomEntry: (id: string) => void

  addActionPlanItem: (a: Omit<ActionPlanItem, 'id'>) => void
  removeActionPlanItem: (id: string) => void

  addQuestion: (text: string) => void
  toggleQuestionAnswered: (id: string, answerNote?: string) => void
  removeQuestion: (id: string) => void

  addContact: (c: Omit<Contact, 'id'>) => void
  removeContact: (id: string) => void

  addDocument: (d: Omit<DocumentFile, 'id' | 'uploadedAt'>) => void
  removeDocument: (id: string) => void

  upsertSupplement: (s: Omit<Supplement, 'id'> & { id?: string }) => void
  removeSupplement: (id: string) => void

  addPhoto: (p: Omit<GalleryPhoto, 'id' | 'addedAt'>) => void
  removePhoto: (id: string) => void

  addCaregiverTask: (text: string, assignedTo?: string) => void
  toggleCaregiverTask: (id: string) => void
  removeCaregiverTask: (id: string) => void

  addCircleMember: (m: Omit<CircleMember, 'id' | 'joinedAt'>) => void
  updateCircleMember: (id: string, patch: Partial<CircleMember>) => void
  removeCircleMember: (id: string) => void

  replaceAllData: (d: AppData) => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth()
  const circleId = currentUser?.circleId ?? 'anon'
  const [data, setData] = useState<AppData>(() => getJSON(`data:${circleId}`, defaultAppData()))

  useEffect(() => {
    setData(getJSON(`data:${circleId}`, defaultAppData()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId])

  function update(mutator: (d: AppData) => AppData) {
    setData((prev) => {
      const next = mutator(prev)
      setJSON(`data:${circleId}`, next)
      return next
    })
  }

  function logAccess(action: string) {
    if (!currentUser) return
    update((d) => ({
      ...d,
      accessLog: [
        { id: newId(), who: currentUser.name, action, at: new Date().toISOString() } as AccessLogEntry,
        ...d.accessLog,
      ].slice(0, 200),
    }))
  }

  const value: DataContextValue = {
    data,
    logAccess,

    setTreatment: (t) => update((d) => ({ ...d, treatment: t })),

    addAppointment: (a) =>
      update((d) => ({
        ...d,
        appointments: [...d.appointments, { ...a, id: newId(), done: false }],
      })),
    updateAppointment: (id, patch) =>
      update((d) => ({
        ...d,
        appointments: d.appointments.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      })),
    removeAppointment: (id) =>
      update((d) => ({ ...d, appointments: d.appointments.filter((x) => x.id !== id) })),

    addMedication: (m) =>
      update((d) => ({ ...d, medications: [...d.medications, { ...m, id: newId() }] })),
    updateMedication: (id, patch) =>
      update((d) => ({
        ...d,
        medications: d.medications.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      })),
    removeMedication: (id) =>
      update((d) => ({ ...d, medications: d.medications.filter((x) => x.id !== id) })),
    logMedication: (l) =>
      update((d) => ({ ...d, medicationLogs: [{ ...l, id: newId() }, ...d.medicationLogs] })),

    addSymptomEntry: (s) =>
      update((d) => ({
        ...d,
        symptoms: [
          { ...s, id: newId(), createdAt: new Date().toISOString() },
          ...d.symptoms,
        ].sort((a, b) => (a.date < b.date ? 1 : -1)),
      })),
    removeSymptomEntry: (id) =>
      update((d) => ({ ...d, symptoms: d.symptoms.filter((x) => x.id !== id) })),

    addActionPlanItem: (a) =>
      update((d) => ({ ...d, actionPlan: [...d.actionPlan, { ...a, id: newId() }] })),
    removeActionPlanItem: (id) =>
      update((d) => ({ ...d, actionPlan: d.actionPlan.filter((x) => x.id !== id) })),

    addQuestion: (text) =>
      update((d) => ({
        ...d,
        questions: [
          { id: newId(), text, answered: false, createdAt: new Date().toISOString() },
          ...d.questions,
        ],
      })),
    toggleQuestionAnswered: (id, answerNote) =>
      update((d) => ({
        ...d,
        questions: d.questions.map((q) =>
          q.id === id ? { ...q, answered: !q.answered, answerNote: answerNote ?? q.answerNote } : q,
        ),
      })),
    removeQuestion: (id) =>
      update((d) => ({ ...d, questions: d.questions.filter((x) => x.id !== id) })),

    addContact: (c) => update((d) => ({ ...d, contacts: [...d.contacts, { ...c, id: newId() }] })),
    removeContact: (id) =>
      update((d) => ({ ...d, contacts: d.contacts.filter((x) => x.id !== id) })),

    addDocument: (doc) =>
      update((d) => ({
        ...d,
        documents: [
          { ...doc, id: newId(), uploadedAt: new Date().toISOString() },
          ...d.documents,
        ],
      })),
    removeDocument: (id) =>
      update((d) => ({ ...d, documents: d.documents.filter((x) => x.id !== id) })),

    upsertSupplement: (s) =>
      update((d) => {
        if (s.id) {
          return {
            ...d,
            supplements: d.supplements.map((x) => (x.id === s.id ? { ...x, ...s, id: s.id } : x)),
          }
        }
        return { ...d, supplements: [...d.supplements, { ...s, id: newId() }] }
      }),
    removeSupplement: (id) =>
      update((d) => ({ ...d, supplements: d.supplements.filter((x) => x.id !== id) })),

    addPhoto: (p) =>
      update((d) => ({
        ...d,
        gallery: [{ ...p, id: newId(), addedAt: new Date().toISOString() }, ...d.gallery],
      })),
    removePhoto: (id) => update((d) => ({ ...d, gallery: d.gallery.filter((x) => x.id !== id) })),

    addCaregiverTask: (text, assignedTo) =>
      update((d) => ({
        ...d,
        caregiverTasks: [...d.caregiverTasks, { id: newId(), text, done: false, assignedTo }],
      })),
    toggleCaregiverTask: (id) =>
      update((d) => ({
        ...d,
        caregiverTasks: d.caregiverTasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      })),
    removeCaregiverTask: (id) =>
      update((d) => ({ ...d, caregiverTasks: d.caregiverTasks.filter((x) => x.id !== id) })),

    addCircleMember: (m) =>
      update((d) => ({
        ...d,
        circle: [...d.circle, { ...m, id: newId(), joinedAt: new Date().toISOString() }],
      })),
    updateCircleMember: (id, patch) =>
      update((d) => ({
        ...d,
        circle: d.circle.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      })),
    removeCircleMember: (id) =>
      update((d) => ({ ...d, circle: d.circle.filter((m) => m.id !== id) })),

    replaceAllData: (d) => update(() => d),
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}
