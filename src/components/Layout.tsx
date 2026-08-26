import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X, Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { NAV_ITEMS } from '@/lib/nav'

const SECTION_LABELS: Record<string, string> = {
  principal: 'Tu día a día',
  acompanamiento: 'Acompañamiento',
  cuenta: 'Tu cuenta',
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const sections = ['principal', 'acompanamiento', 'cuenta'] as const
  return (
    <nav className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section}>
          <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-ink-500/70">
            {SECTION_LABELS[section]}
          </p>
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.filter((i) => i.section === section).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${
                    isActive
                      ? 'bg-gradient-to-r from-lavender-100 to-teal-100 text-lavender-600'
                      : 'text-ink-700 hover:bg-black/5'
                  }`
                }
              >
                <item.icon size={19} />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { currentUser, logout, lockNow } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()

  const mobilePrimary = NAV_ITEMS.filter((i) => i.section === 'principal').slice(0, 4)

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-black/5 bg-white/70 px-4 py-6 backdrop-blur md:flex">
          <div className="mb-6 flex items-center gap-2 px-2">
            <img src="/favicon.svg" className="h-9 w-9" alt="" />
            <span className="font-display text-xl font-extrabold text-ink-900">Núcleo</span>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
            <NavLinks />
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-lavender-50 p-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-lavender-300 font-display font-bold text-white">
              {currentUser?.avatarDataUrl ? (
                <img src={currentUser.avatarDataUrl} className="h-full w-full object-cover" alt="" />
              ) : (
                currentUser?.name?.[0]?.toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink-900">{currentUser?.name}</p>
              <p className="truncate text-xs text-ink-500">
                {currentUser?.role === 'paciente' ? 'Paciente' : currentUser?.relationship ?? 'Familiar'}
              </p>
            </div>
            {currentUser?.pinHash && (
              <button onClick={lockNow} className="rounded-full p-2 text-ink-500 hover:bg-black/5" title="Bloquear">
                <Lock size={16} />
              </button>
            )}
            <button
              onClick={() => {
                logout()
                navigate('/')
              }}
              className="rounded-full p-2 text-ink-500 hover:bg-black/5"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-black/5 bg-cream/90 px-4 py-3 backdrop-blur md:hidden">
            <div className="flex items-center gap-2">
              <img src="/favicon.svg" className="h-7 w-7" alt="" />
              <span className="font-display text-lg font-extrabold text-ink-900">Núcleo</span>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-full p-2 text-ink-700 hover:bg-black/5"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>
          </header>

          <main className="mx-auto max-w-4xl px-4 pb-28 pt-6 sm:px-6 md:pb-10 md:pt-8">{children}</main>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="animate-pop relative ml-auto flex h-full w-72 flex-col bg-white px-4 py-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between px-1">
              <span className="font-display text-lg font-extrabold text-ink-900">Menú</span>
              <button onClick={() => setDrawerOpen(false)} className="rounded-full p-2 hover:bg-black/5">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setDrawerOpen(false)} />
            </div>
            <button
              onClick={() => {
                logout()
                navigate('/')
              }}
              className="mt-4 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-coral-600 hover:bg-red-50"
            >
              <LogOut size={19} /> Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-black/5 bg-white/95 px-1 py-2 backdrop-blur md:hidden">
        {mobilePrimary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-bold ${
                isActive ? 'text-lavender-600' : 'text-ink-500'
              }`
            }
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-bold text-ink-500"
        >
          <Menu size={20} />
          Más
        </button>
      </nav>
    </div>
  )
}
