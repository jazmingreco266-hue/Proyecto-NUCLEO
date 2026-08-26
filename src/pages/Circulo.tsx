import { useState } from 'react'
import { Users, Copy, Check, Plus, Trash2, ListTodo } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useData } from '@/lib/data'
import type { CirclePermissions } from '@/lib/types'
import { Badge, Button, Card, Disclaimer, PageHeader } from '@/components/ui'

const PERMISSION_LABELS: { key: keyof CirclePermissions; label: string }[] = [
  { key: 'verAgenda', label: 'Ver agenda' },
  { key: 'recibirRecordatorios', label: 'Recibir recordatorios' },
  { key: 'registrarComoEstuvo', label: 'Registrar cómo estuvo el día' },
  { key: 'subirDocumentos', label: 'Subir documentos' },
  { key: 'verMedicacion', label: 'Ver medicación' },
]

export default function Circulo() {
  const { currentUser } = useAuth()
  const { data, updateCircleMember, addCaregiverTask, toggleCaregiverTask, removeCaregiverTask } = useData()
  const [copied, setCopied] = useState(false)
  const [taskText, setTaskText] = useState('')

  function copyCode() {
    if (!currentUser) return
    navigator.clipboard.writeText(currentUser.circleCode).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  function submitTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskText.trim()) return
    addCaregiverTask(taskText.trim())
    setTaskText('')
  }

  return (
    <div>
      <PageHeader title="Círculo familiar" subtitle="Sumá a tu familia con un código de acceso." icon={<Users size={22} />} />

      <Card className="bg-gradient-to-br from-lavender-500 to-peach-500 text-center text-white">
        <p className="text-sm font-semibold text-white/80">Código de tu círculo</p>
        <p className="mt-2 font-display text-3xl font-semibold tracking-widest">{currentUser?.circleCode}</p>
        <button
          onClick={copyCode}
          className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/30"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar código'}
        </button>
        <p className="mt-3 text-xs text-white/80">
          Compartilo con quien quieras invitar. Va a poder crear su cuenta como "Familiar" con este código.
        </p>
      </Card>

      <Disclaimer className="mt-4">
        En esta primera versión, el círculo comparte datos dentro de este mismo dispositivo/navegador.
        Para que tu familiar vea la misma información desde otro dispositivo, exportá tus datos desde
        Privacidad y compartíselos (o guardalos en un almacenamiento compartido).
      </Disclaimer>

      <div className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">Miembros del círculo</h2>
        <div className="flex flex-col gap-3">
          {data.circle.map((m) => (
            <Card key={m.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink-900">{m.name}</p>
                  <Badge tone={m.role === 'paciente' ? 'lavender' : 'teal'}>
                    {m.role === 'paciente' ? 'Paciente' : m.relationship || 'Familiar'}
                  </Badge>
                </div>
              </div>
              {m.role === 'familiar' && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PERMISSION_LABELS.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-sm text-ink-700">
                      <input
                        type="checkbox"
                        checked={m.permissions[p.key]}
                        onChange={(e) =>
                          updateCircleMember(m.id, {
                            permissions: { ...m.permissions, [p.key]: e.target.checked },
                          })
                        }
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
          <ListTodo size={20} /> Tareas del cuidador
        </h2>
        <form onSubmit={submitTask} className="flex gap-2">
          <input
            placeholder="Ej: coordinar traslado del jueves"
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            className="flex-1 rounded-lg border border-black/10 px-4 py-3"
          />
          <Button type="submit">
            <Plus size={18} />
          </Button>
        </form>
        <ul className="mt-3 space-y-2">
          {data.caregiverTasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-lg border border-black/5 bg-white p-3">
              <input type="checkbox" checked={t.done} onChange={() => toggleCaregiverTask(t.id)} />
              <p className={`flex-1 text-sm ${t.done ? 'text-ink-500 line-through' : 'text-ink-900'}`}>{t.text}</p>
              <button onClick={() => removeCaregiverTask(t.id)} className="rounded-full p-1 text-coral-600 hover:bg-red-50">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
