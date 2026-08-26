import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Mascot } from '@/components/Mascot'

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <img src="/favicon.svg" className="h-8 w-8" alt="" />
          <span className="font-display text-lg font-semibold text-ink-900">Núcleo</span>
        </Link>
        <div className="card-soft p-8">
          <div className="mb-5 text-center">
            <Mascot pose="wave" className="mx-auto mb-3 h-16 w-16" />
            <h1 className="font-display text-lg font-semibold text-ink-900">{title}</h1>
            <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
