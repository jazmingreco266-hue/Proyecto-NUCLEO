/**
 * Capa de persistencia. Todo vive en localStorage: esta es una app 100% cliente
 * pensada como primera versión funcional. Está escrita como una capa aislada a
 * propósito (getJSON/setJSON) para que el día de mañana se pueda reemplazar por
 * llamadas a una API real sin tocar el resto de la app.
 */

const NS = 'nucleo'

export function getJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${NS}:${key}`)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function setJSON<T>(key: string, value: T): void {
  localStorage.setItem(`${NS}:${key}`, JSON.stringify(value))
}

export function removeKey(key: string): void {
  localStorage.removeItem(`${NS}:${key}`)
}

export function clearAllNucleoData(): void {
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(`${NS}:`)) toRemove.push(k)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
}

export function newId(): string {
  return crypto.randomUUID()
}

export async function hashSecret(secret: string): Promise<string> {
  const enc = new TextEncoder().encode(`nucleo-salt::${secret}`)
  const digest = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function generateCircleCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return `NUC-${code}`
}
