import {
  Sun,
  CalendarHeart,
  ClipboardList,
  Pill,
  FolderHeart,
  Phone,
  Users,
  Sparkles,
  Images,
  ShieldCheck,
  HeartHandshake,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  section: 'principal' | 'acompanamiento' | 'cuenta'
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/app/hoy', label: 'Hoy', icon: Sun, section: 'principal' },
  { to: '/app/agenda', label: 'Agenda', icon: CalendarHeart, section: 'principal' },
  { to: '/app/registro', label: 'Registro', icon: ClipboardList, section: 'principal' },
  { to: '/app/tratamiento', label: 'Tratamiento', icon: Pill, section: 'principal' },
  { to: '/app/carpeta', label: 'Mi carpeta', icon: FolderHeart, section: 'principal' },
  { to: '/app/contactos', label: 'Contactos', icon: Phone, section: 'principal' },
  { to: '/app/circulo', label: 'Círculo', icon: Users, section: 'acompanamiento' },
  { to: '/app/bienestar', label: 'Bienestar', icon: Sparkles, section: 'acompanamiento' },
  { to: '/app/galeria', label: 'Galería', icon: Images, section: 'acompanamiento' },
  { to: '/app/nosotros', label: 'Quiénes somos', icon: HeartHandshake, section: 'cuenta' },
  { to: '/app/privacidad', label: 'Privacidad', icon: ShieldCheck, section: 'cuenta' },
]
