import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function LegalShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
        <Link to="/" className="flex items-center gap-2">
          <img src="/favicon.svg" className="h-8 w-8" alt="" />
          <span className="font-display text-lg font-semibold text-ink-900">Núcleo</span>
        </Link>
        <Link to="/" className="flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-lavender-600">
          <ArrowLeft size={16} /> Volver al inicio
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-20">
        <div className="card-soft p-8 sm:p-10">
          <h1 className="font-display text-2xl font-semibold text-ink-900 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-ink-500">{subtitle}</p>}
          <div className="prose-legal mt-6 flex flex-col gap-4 text-sm leading-relaxed text-ink-700">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
