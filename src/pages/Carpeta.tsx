import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { FolderHeart, Upload, FileText, Trash2, Download } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useData } from '@/lib/data'
import { DOCUMENT_LABELS } from '@/lib/labels'
import type { DocumentCategory } from '@/lib/types'
import { generateDoctorSummaryPdf } from '@/lib/pdf'
import { Button, Card, Disclaimer, EmptyState, PageHeader } from '@/components/ui'

const MAX_FILE_MB = 4

export default function Carpeta() {
  const { currentUser } = useAuth()
  const { data, addDocument, removeDocument } = useData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<DocumentCategory>('estudio')
  const [error, setError] = useState('')

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`El archivo pesa demasiado (máx. ${MAX_FILE_MB} MB en esta versión).`)
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      addDocument({
        name: file.name,
        category,
        dataUrl: reader.result as string,
        mimeType: file.type,
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const grouped = data.documents.reduce<Record<string, typeof data.documents>>((acc, doc) => {
    acc[doc.category] = acc[doc.category] ?? []
    acc[doc.category].push(doc)
    return acc
  }, {})

  return (
    <div>
      <PageHeader title="Mi carpeta" subtitle="Recetas, órdenes, estudios y credenciales, siempre a mano." icon={<FolderHeart size={22} />} />

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="rounded-2xl border border-black/10 px-4 py-3"
          >
            {Object.entries(DOCUMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button onClick={() => fileRef.current?.click()} className="sm:flex-1">
            <Upload size={18} /> Subir documento o foto
          </Button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={onFileChosen} />
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-coral-600">{error}</p>}
      </Card>

      <div className="mt-6">
        {data.documents.length === 0 ? (
          <EmptyState title="Tu carpeta está vacía" description="Subí tu primera receta, estudio o credencial." />
        ) : (
          Object.entries(grouped).map(([cat, docs]) => (
            <div key={cat} className="mb-6">
              <h3 className="mb-2 font-display text-sm font-bold text-ink-500">
                {DOCUMENT_LABELS[cat as DocumentCategory]}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {docs.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.dataUrl}
                    download={doc.name}
                    className="card-soft group relative flex flex-col overflow-hidden p-0"
                  >
                    {doc.mimeType.startsWith('image/') ? (
                      <img src={doc.dataUrl} alt={doc.name} className="h-28 w-full object-cover" />
                    ) : (
                      <div className="flex h-28 w-full items-center justify-center bg-lavender-50 text-lavender-500">
                        <FileText size={32} />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-1 p-2">
                      <p className="truncate text-xs font-semibold text-ink-700">{doc.name}</p>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          removeDocument(doc.id)
                        }}
                        className="shrink-0 rounded-full p-1 text-coral-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <Card className="mt-2">
        <h3 className="font-display text-base font-bold text-ink-900">Resumen para el médico</h3>
        <p className="mt-1 text-sm text-ink-500">
          Generá un PDF con síntomas, medicación y evolución para llevar (o mandar) a tu próxima consulta.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[7, 14, 30].map((d) => (
            <Button
              key={d}
              variant="secondary"
              onClick={() => generateDoctorSummaryPdf(currentUser?.name ?? 'Paciente', data, d as 7 | 14 | 30)}
            >
              <Download size={16} /> Últimos {d} días
            </Button>
          ))}
        </div>
      </Card>

      <Disclaimer className="mt-4">
        Guardamos tus documentos únicamente en este dispositivo. Recordá que en esta primera
        versión no hay copia automática en la nube: si cambiás de dispositivo, exportá tus datos
        desde Privacidad antes.
      </Disclaimer>

      {data.documents.some((d) => d.category === 'credencial') && (
        <p className="mt-3 text-xs text-ink-500">
          Última actualización: {format(parseISO(data.documents[0].uploadedAt), 'dd/MM/yyyy HH:mm')}
        </p>
      )}
    </div>
  )
}
