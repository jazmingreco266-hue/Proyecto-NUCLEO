import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Role, User } from './types'
import { defaultAppData } from './defaultData'
import {
  clearAllNucleoData,
  generateCircleCode,
  getJSON,
  hashSecret,
  newId,
  setJSON,
} from './storage'

interface Credentials {
  [userId: string]: string // password hash
}

export interface GoogleProfile {
  email: string
  name: string
  picture?: string
}

interface SignupInput {
  name: string
  email: string
  password: string
  role: Role
  relationship?: string
  circleCode?: string // requerido si role === 'familiar'
}

interface GoogleSignupInput {
  profile: GoogleProfile
  role: Role
  relationship?: string
  circleCode?: string
}

interface AuthContextValue {
  currentUser: User | null
  loading: boolean
  locked: boolean
  signup: (input: SignupInput) => Promise<User>
  login: (email: string, password: string) => Promise<User>
  resetPassword: (email: string, newPassword: string) => Promise<void>
  findGoogleUser: (email: string) => User | undefined
  loginWithGoogle: (email: string) => Promise<User>
  completeGoogleSignup: (input: GoogleSignupInput) => Promise<User>
  logout: () => void
  updateProfile: (patch: Partial<User>) => void
  setPin: (pin: string) => Promise<void>
  clearPin: () => void
  unlock: (pin: string) => Promise<boolean>
  lockNow: () => void
  deleteAccount: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadUsers(): User[] {
  return getJSON<User[]>('auth:users', [])
}
function saveUsers(users: User[]) {
  setJSON('auth:users', users)
}
function loadCreds(): Credentials {
  return getJSON<Credentials>('auth:credentials', {})
}
function saveCreds(c: Credentials) {
  setJSON('auth:credentials', c)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    const sessionId = getJSON<string | null>('auth:session', null)
    if (sessionId) {
      const user = loadUsers().find((u) => u.id === sessionId) ?? null
      setCurrentUser(user)
      if (user?.pinHash) setLocked(true)
    }
    setLoading(false)
  }, [])

  function persistSession(user: User | null) {
    setJSON('auth:session', user?.id ?? null)
    setCurrentUser(user)
  }

  function ensureCircleData(circleId: string) {
    const key = `data:${circleId}`
    const existing = getJSON<unknown>(key, null)
    if (!existing) setJSON(key, defaultAppData())
  }

  async function signup(input: SignupInput): Promise<User> {
    const users = loadUsers()
    if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error('Ya existe una cuenta con ese email.')
    }

    let circleId: string
    let circleCode: string

    if (input.role === 'paciente') {
      circleId = newId()
      circleCode = generateCircleCode()
      ensureCircleData(circleId)
    } else {
      if (!input.circleCode) throw new Error('Ingresá el código de acceso del círculo.')
      const match = users.find(
        (u) => u.circleCode.toLowerCase() === input.circleCode!.trim().toLowerCase(),
      )
      if (!match) {
        throw new Error(
          'No encontramos ese código. Pedile a tu familiar el código de invitación de Núcleo.',
        )
      }
      circleId = match.circleId
      circleCode = match.circleCode
    }

    const user: User = {
      id: newId(),
      name: input.name,
      email: input.email,
      role: input.role,
      relationship: input.relationship,
      circleId,
      circleCode,
      createdAt: new Date().toISOString(),
      authProvider: 'password',
    }

    const creds = loadCreds()
    creds[user.id] = await hashSecret(input.password)
    saveCreds(creds)

    saveUsers([...users, user])
    persistSession(user)
    return user
  }

  async function login(email: string, password: string): Promise<User> {
    const users = loadUsers()
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase())
    if (!user || user.authProvider !== 'password') {
      throw new Error('No encontramos una cuenta con ese email.')
    }
    const creds = loadCreds()
    const hash = await hashSecret(password)
    if (creds[user.id] !== hash) throw new Error('Contraseña incorrecta.')
    persistSession(user)
    return user
  }

  async function resetPassword(email: string, newPassword: string): Promise<void> {
    const users = loadUsers()
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase())
    if (!user || user.authProvider !== 'password') {
      throw new Error('No encontramos una cuenta con ese email para restablecer.')
    }
    const creds = loadCreds()
    creds[user.id] = await hashSecret(newPassword)
    saveCreds(creds)
  }

  function findGoogleUser(email: string): User | undefined {
    return loadUsers().find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.authProvider === 'google',
    )
  }

  async function loginWithGoogle(email: string): Promise<User> {
    const user = findGoogleUser(email)
    if (!user) throw new Error('No encontramos una cuenta de Google asociada.')
    persistSession(user)
    return user
  }

  async function completeGoogleSignup({
    profile,
    role,
    relationship,
    circleCode,
  }: GoogleSignupInput): Promise<User> {
    const users = loadUsers()
    if (users.some((u) => u.email.toLowerCase() === profile.email.toLowerCase())) {
      throw new Error('Ya existe una cuenta con ese email.')
    }

    let circleId: string
    let code: string
    if (role === 'paciente') {
      circleId = newId()
      code = generateCircleCode()
      ensureCircleData(circleId)
    } else {
      if (!circleCode) throw new Error('Ingresá el código de acceso del círculo.')
      const match = users.find(
        (u) => u.circleCode.toLowerCase() === circleCode.trim().toLowerCase(),
      )
      if (!match) throw new Error('No encontramos ese código.')
      circleId = match.circleId
      code = match.circleCode
    }

    const user: User = {
      id: newId(),
      name: profile.name,
      email: profile.email,
      role,
      relationship,
      avatarDataUrl: profile.picture,
      circleId,
      circleCode: code,
      createdAt: new Date().toISOString(),
      authProvider: 'google',
    }
    saveUsers([...users, user])
    persistSession(user)
    return user
  }

  function logout() {
    persistSession(null)
    setLocked(false)
  }

  function updateProfile(patch: Partial<User>) {
    if (!currentUser) return
    const users = loadUsers()
    const updated = { ...currentUser, ...patch }
    saveUsers(users.map((u) => (u.id === currentUser.id ? updated : u)))
    setCurrentUser(updated)
  }

  async function setPin(pin: string) {
    if (!currentUser) return
    const hash = await hashSecret(pin)
    updateProfile({ pinHash: hash })
  }

  function clearPin() {
    updateProfile({ pinHash: undefined })
  }

  async function unlock(pin: string): Promise<boolean> {
    if (!currentUser?.pinHash) return true
    const hash = await hashSecret(pin)
    const ok = hash === currentUser.pinHash
    if (ok) setLocked(false)
    return ok
  }

  function lockNow() {
    if (currentUser?.pinHash) setLocked(true)
  }

  function deleteAccount() {
    if (!currentUser) return
    const users = loadUsers().filter((u) => u.id !== currentUser.id)
    saveUsers(users)
    const creds = loadCreds()
    delete creds[currentUser.id]
    saveCreds(creds)
    const stillUsingCircle = users.some((u) => u.circleId === currentUser.circleId)
    if (!stillUsingCircle) {
      localStorage.removeItem(`nucleo:data:${currentUser.circleId}`)
    }
    persistSession(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      loading,
      locked,
      signup,
      login,
      resetPassword,
      findGoogleUser,
      loginWithGoogle,
      completeGoogleSignup,
      logout,
      updateProfile,
      setPin,
      clearPin,
      unlock,
      lockNow,
      deleteAccount,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, loading, locked],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

export function wipeEverything() {
  clearAllNucleoData()
}
