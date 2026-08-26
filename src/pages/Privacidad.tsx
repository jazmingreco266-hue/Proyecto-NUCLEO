import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ShieldCheck, Lock, Download, Trash2, LogOut, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useData } from '@/lib/data'
import { Button, Card, Disclaimer, Modal, PageHeader } from '@/components/ui'

export default function Privacidad() {
  const { currentUser, setPin, clearPin, deleteAccount, logout } = useAuth()
  const { data, logAccess } = useData()
  const navigate = useNavigate()

  const [pin, setPinInput] = useState('')
  const [pinSaved, setPinSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function savePin(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length < 4) return
    await setPin(pin)
    logAccess('Configuró un PIN de bloqueo')
    setPin('')
    setPinInput('')
    setPinSaved(true)
    setTimeout(() => setPinSaved(false), 2000)
  }

  function exportData() {
    if (!currentUser) return
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: {
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        circleCode: currentUser.circleCode,
      },
      data,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nucleo-datos-${format(new Date(), 'yyyy-MM-dd')}.json`
    a.click()
    URL.revokeObjectURL(url)
    logAccess('Exportó todos sus datos')
  }

  function handleDeleteAccount() {
    deleteAccount()
    navigate('/')
  }

  return (
    <div>
      <PageHeader title="Privacidad y seguridad" subtitle="Tus datos son tuyos. Siempre." icon={<ShieldCheck size={22} />} />

      <Card>
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-lavender-600" />
          <h3 className="font-display text-base font-bold text-ink-900">PIN de bloqueo</h3>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          Pedile un PIN a quien abra la app en este dispositivo, además de tu sesión.
        </p>
        <form onSubmit={savePin} className="mt-3 flex gap-2">
          <input
            type="password"
            inputMode="numeric"
            minLength={4}
            maxLength={8}
            placeholder="Nuevo PIN (4 a 8 dígitos)"
            value={pin}
            onChange={(e) => setPinInput(e.target.value)}
            className="flex-1 rounded-2xl border border-black/10 px-4 py-3"
          />
          <Button type="submit">Guardar</Button>
        </form>
        {pinSaved && <p className="mt-2 text-sm font-bold text-teal-600">PIN actualizado ✓</p>}
        {currentUser?.pinHash && (
          <button
            onClick={() => {
              clearPin()
              logAccess('Desactivó el PIN de bloqueo')
            }}
            className="mt-2 text-xs font-bold text-coral-600 hover:underline"
          >
            Desactivar PIN
          </button>
        )}
      </Card>

      <Card className="mt-5">
        <div className="flex items-center gap-2">
          <Download size={18} className="text-teal-600" />
          <h3 className="font-display text-base font-bold text-ink-900">Tus datos</h3>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          Descargá una copia completa de todo lo que registraste: agenda, síntomas, medicación,
          documentos, contactos y más.
        </p>
        <Button variant="secondary" onClick={exportData} className="mt-3">
          <Download size={16} /> Descargar mis datos (JSON)
        </Button>
      </Card>

      <Card className="mt-5">
        <h3 className="font-display text-base font-bold text-ink-900">Registro de accesos</h3>
        <p className="mt-1 text-sm text-ink-500">Últimas acciones sensibles en tu cuenta.</p>
        {data.accessLog.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">Sin actividad registrada todavía.</p>
        ) : (
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-ink-500">
            {data.accessLog.slice(0, 30).map((l) => (
              <li key={l.id}>
                {format(parseISO(l.at), 'dd/MM HH:mm')} · {l.who} · {l.action}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Disclaimer className="mt-5">
        En Argentina, tus datos de salud son considerados "datos sensibles" por la Ley 25.326 de
        Protección de Datos Personales. Tenés derecho a conocer, corregir y solicitar la
        eliminación de tu información en todo momento. Núcleo no vende ni comparte tus datos con
        terceros, y no muestra publicidad basada en tu información de salud.
      </Disclaimer>

      <Card className="mt-5 border border-red-100">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-coral-600" />
          <h3 className="font-display text-base font-bold text-ink-900">Eliminar cuenta</h3>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          Esto borra tu cuenta y, si sos la última persona del círculo, también todos los datos
          asociados en este dispositivo. Es una acción permanente.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => { logout(); navigate('/') }}>
            <LogOut size={16} /> Cerrar sesión
          </Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> Eliminar mi cuenta
          </Button>
        </div>
      </Card>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="¿Eliminar tu cuenta?">
        <p className="text-sm text-ink-700">
          Esta acción no se puede deshacer. Si querés conservar tu información, descargala antes
          desde "Tus datos".
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)} className="flex-1">
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDeleteAccount} className="flex-1">
            Sí, eliminar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
