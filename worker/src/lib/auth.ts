import { eq } from 'drizzle-orm'
import { sessions } from '../db/schema'
import type { drizzle } from 'drizzle-orm/d1'
import type * as schema from '../db/schema'

export const SESSION_COOKIE_NAME = 'session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const PBKDF2_ITERATIONS = 100_000

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveHash(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveHash(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  const salt = fromBase64(parts[2])
  const expected = fromBase64(parts[3])

  const actual = await deriveHash(password, salt, iterations)
  if (actual.length !== expected.length) return false

  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}

export async function createSession(db: ReturnType<typeof drizzle<typeof schema>>, userId: string): Promise<string> {
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()
  await db.insert(sessions).values({ id: token, userId, expiresAt, createdAt: new Date().toISOString() })
  return token
}

export async function deleteSession(db: ReturnType<typeof drizzle<typeof schema>>, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token))
}
