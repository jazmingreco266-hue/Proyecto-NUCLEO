import { useRef, useState } from 'react'
import { Images, Upload, Trash2, Heart } from 'lucide-react'
import { useData } from '@/lib/data'
import { Button, Card, EmptyState, PageHeader } from '@/components/ui'

export default function Galeria() {
  const { data, addPhoto, removePhoto } = useData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingCaption, setPendingCaption] = useState('')

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      addPhoto({ dataUrl: reader.result as string, caption: pendingCaption })
      setPendingCaption('')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div>
      <PageHeader title="Por lo que lucho" subtitle="Las imágenes que te recuerdan por qué vale la pena cada día." icon={<Images size={22} />} />

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            placeholder="Escribí una frase o el nombre de la foto (opcional)"
            value={pendingCaption}
            onChange={(e) => setPendingCaption(e.target.value)}
            className="flex-1 rounded-2xl border border-black/10 px-4 py-3"
          />
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={18} /> Subir foto
          </Button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFileChosen} />
        </div>
      </Card>

      <div className="mt-6">
        {data.gallery.length === 0 ? (
          <EmptyState
            title="Todavía no subiste fotos"
            description="Tu familia, tu mascota, un lugar al que quieras volver: lo que te dé fuerza."
            action={
              <div className="mt-3 text-4xl">
                <Heart className="mx-auto text-peach-300" size={36} />
              </div>
            }
          />
        ) : (
          <div className="columns-2 gap-3 sm:columns-3 [&>*]:mb-3">
            {data.gallery.map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-3xl shadow-sm">
                <img src={p.dataUrl} alt={p.caption} className="w-full object-cover" />
                {p.caption && (
                  <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-xs font-bold text-white">
                    {p.caption}
                  </p>
                )}
                <button
                  onClick={() => removePhoto(p.id)}
                  className="absolute right-2 top-2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
