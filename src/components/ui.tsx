import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { X, Info, ShieldAlert } from 'lucide-react'

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`card-soft p-5 sm:p-6 ${className}`}>{children}</div>
}

export function PageHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lavender-100 to-peach-100 text-lavender-600">
            {icon}
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900 sm:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'btn-primary px-4 py-2.5',
    secondary:
      'rounded-lg border border-lavender-300/60 bg-white px-4 py-2.5 font-semibold text-lavender-600 hover:bg-lavender-50',
    ghost: 'rounded-lg px-3 py-2 font-medium text-ink-700 hover:bg-black/5',
    danger: 'rounded-lg bg-coral-500 px-4 py-2.5 font-semibold text-white hover:bg-coral-600',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Disclaimer({
  children,
  tone = 'info',
  className = '',
}: {
  children: ReactNode
  tone?: 'info' | 'warning'
  className?: string
}) {
  const isWarning = tone === 'warning'
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        isWarning
          ? 'border-peach-300 bg-peach-50 text-ink-700'
          : 'border-lavender-100 bg-lavender-50 text-ink-700'
      } ${className}`}
    >
      {isWarning ? (
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-peach-500" />
      ) : (
        <Info size={18} className="mt-0.5 shrink-0 text-lavender-500" />
      )}
      <p>{children}</p>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-ink-500/20 px-6 py-10 text-center">
      <p className="font-display text-base font-semibold text-ink-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-500">{description}</p>}
      {action}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 sm:items-center sm:p-4">
      <div className="animate-pop max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-500 hover:bg-black/5"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Badge({
  children,
  tone = 'lavender',
}: {
  children: ReactNode
  tone?: 'lavender' | 'teal' | 'peach' | 'coral' | 'gray'
}) {
  const map: Record<string, string> = {
    lavender: 'bg-lavender-100 text-lavender-600',
    teal: 'bg-teal-100 text-teal-600',
    peach: 'bg-peach-100 text-peach-500',
    coral: 'bg-red-100 text-coral-600',
    gray: 'bg-gray-100 text-ink-500',
  }
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${map[tone]}`}
    >
      {children}
    </span>
  )
}

export function ScoreSlider({
  label,
  value,
  onChange,
  emojis,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  emojis?: string[]
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm font-semibold text-ink-700">{label}</label>
        <span className="font-display text-base font-semibold text-lavender-600">
          {emojis ? emojis[value] : value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-lavender-500"
      />
      <div className="flex justify-between text-[10px] text-ink-500">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  )
}

export function IconCircle({
  children,
  tone = 'lavender',
}: {
  children: ReactNode
  tone?: 'lavender' | 'teal' | 'peach'
}) {
  const map = {
    lavender: 'bg-lavender-100 text-lavender-600',
    teal: 'bg-teal-100 text-teal-600',
    peach: 'bg-peach-100 text-peach-500',
  }
  return (
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${map[tone]}`}>
      {children}
    </div>
  )
}
