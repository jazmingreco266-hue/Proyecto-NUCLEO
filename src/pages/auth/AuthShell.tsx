import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BlobDecoration } from '@/components/ui'

export function AuthShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-4 py-10">
      <BlobDecoration className="pointer-events-none absolute -left-24 -top-20 h-72 w-72 text-lavender-100/70" />
      <BlobDecoration className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 text-teal-100/70" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <img src="/favicon.svg" className="h-8 w-8" alt="" />
          <span className="font-display text-lg font-extrabold text-ink-900">Núcleo</span>
        </Link>
        <div className="card-soft p-8">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-lavender-100 text-lavender-600">
              {icon}
            </div>
            <h1 className="font-display text-xl font-bold text-ink-900">{title}</h1>
            <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
