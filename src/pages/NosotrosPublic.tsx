import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Nosotros from './Nosotros'

export default function NosotrosPublic() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6">
        <Link to="/" className="flex items-center gap-2">
          <img src="/favicon.svg" className="h-8 w-8" alt="" />
          <span className="font-display text-lg font-semibold text-ink-900">Núcleo</span>
        </Link>
        <Link to="/" className="flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-lavender-600">
          <ArrowLeft size={16} /> Volver al inicio
        </Link>
      </header>
      <main className="mx-auto max-w-4xl px-5 pb-20">
        <Nosotros />
      </main>
    </div>
  )
}
