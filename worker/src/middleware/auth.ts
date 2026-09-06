import { getCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { createMiddleware } from 'hono/factory'
import { eq } from 'drizzle-orm'
import { sessions, users } from '../db/schema'
import { SESSION_COOKIE_NAME } from '../lib/auth'
import type { Env, Role } from '../env'

export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE_NAME)
  if (!token) throw new HTTPException(401, { message: 'Not authenticated' })

  const db = c.get('db')
  const [row] = await db
    .select({
      userId: users.id,
      username: users.username,
      role: users.role,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))

  if (!row || new Date(row.expiresAt).getTime() < Date.now()) {
    throw new HTTPException(401, { message: 'Not authenticated' })
  }

  c.set('user', { id: row.userId, username: row.username, role: row.role })
  await next()
})

export function requireRole(...roles: Role[]) {
  return createMiddleware<Env>(async (c, next) => {
    const user = c.get('user')
    if (!user || !roles.includes(user.role)) throw new HTTPException(403, { message: 'Forbidden' })
    await next()
  })
}
