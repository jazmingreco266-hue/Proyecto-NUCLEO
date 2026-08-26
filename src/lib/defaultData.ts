import type { AppData } from './types'

export function defaultAppData(): AppData {
  return {
    treatment: {
      name: '',
      startDate: '',
      cyclesTotal: 0,
      cyclesDone: 0,
      professionals: '',
      center: '',
      notes: '',
    },
    appointments: [],
    medications: [],
    medicationLogs: [],
    symptoms: [],
    actionPlan: [],
    questions: [],
    contacts: [],
    documents: [],
    supplements: [],
    gallery: [],
    caregiverTasks: [],
    circle: [],
    accessLog: [],
  }
}
