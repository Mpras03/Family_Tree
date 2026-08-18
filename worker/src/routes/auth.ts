import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { eq, count } from 'drizzle-orm'
import { users } from '../db/schema'
import { createSession, deleteSession, hashPassword, verifyPassword, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '../lib/auth'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../env'

const app = new Hono<Env>()

function cookieOptions(c: import('hono').Context<Env>) {
  return {
    httpOnly: true,
    sameSite: 'Lax' as const,
    path: '/',
    secure: new URL(c.req.url).protocol === 'https:',
  }
}

app.post('/login', async (c) => {
  const db = c.get('db')
  const body = await c.req.json().catch(() => ({}))
  const username = typeof body.username === 'string' ? body.username : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!username || !password) {
    throw new HTTPException(400, { message: 'username and password are required' })
  }

  let [user] = await db.select().from(users).where(eq(users.username, username))

  if (!user) {
    const [{ value: userCount }] = await db.select({ value: count() }).from(users)
    const isBootstrap =
      userCount === 0 && username === c.env.ADMIN_USERNAME && password === c.env.ADMIN_PASSWORD

    if (!isBootstrap) throw new HTTPException(401, { message: 'Invalid credentials' })

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await db.insert(users).values({
      id,
      username,
      passwordHash: await hashPassword(password),
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    })
    ;[user] = await db.select().from(users).where(eq(users.id, id))
  } else {
    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) throw new HTTPException(401, { message: 'Invalid credentials' })
  }

  const token = await createSession(db, user.id)
  setCookie(c, SESSION_COOKIE_NAME, token, { ...cookieOptions(c), maxAge: SESSION_TTL_SECONDS })

  return c.json({ id: user.id, username: user.username, role: user.role })
})

app.post('/logout', async (c) => {
  const db = c.get('db')
  const token = getCookie(c, SESSION_COOKIE_NAME)
  if (token) await deleteSession(db, token)
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' })
  return c.body(null, 204)
})

app.get('/me', requireAuth, async (c) => {
  return c.json(c.get('user'))
})

export default app
