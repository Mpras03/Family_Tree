import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { eq, count } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { users } from '../db/schema'
import { hashPassword } from '../lib/auth'
import { requireAuth, requireRole } from '../middleware/auth'
import type * as schema from '../db/schema'
import type { Env } from '../env'

const app = new Hono<Env>()

app.use('*', requireAuth, requireRole('admin'))

function toSafeUser(u: typeof users.$inferSelect) {
  const { passwordHash, ...safe } = u
  return safe
}

async function adminCount(db: ReturnType<typeof drizzle<typeof schema>>) {
  const [{ value }] = await db.select({ value: count() }).from(users).where(eq(users.role, 'admin'))
  return value
}

app.get('/', async (c) => {
  const db = c.get('db')
  const rows = await db.select().from(users)
  return c.json(rows.map(toSafeUser))
})

app.post('/', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const { username, password, role } = body

  if (!username || !password || !['admin', 'user'].includes(role)) {
    throw new HTTPException(400, { message: 'username, password, and role (admin|user) are required' })
  }

  const [existing] = await db.select().from(users).where(eq(users.username, username))
  if (existing) throw new HTTPException(409, { message: 'Username already taken' })

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.insert(users).values({
    id,
    username,
    passwordHash: await hashPassword(password),
    role,
    createdAt: now,
    updatedAt: now,
  })

  const [created] = await db.select().from(users).where(eq(users.id, id))
  return c.json(toSafeUser(created), 201)
})

app.put('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const body = await c.req.json()

  const [existing] = await db.select().from(users).where(eq(users.id, id))
  if (!existing) throw new HTTPException(404, { message: 'User not found' })

  if (body.role && !['admin', 'user'].includes(body.role)) {
    throw new HTTPException(400, { message: 'role must be admin or user' })
  }

  const currentUser = c.get('user')!
  if (body.role && body.role !== existing.role && existing.id === currentUser.id) {
    throw new HTTPException(400, { message: 'Cannot change your own role' })
  }
  if (existing.role === 'admin' && body.role === 'user') {
    const admins = await adminCount(db)
    if (admins <= 1) throw new HTTPException(400, { message: 'Cannot demote the last remaining admin' })
  }

  await db
    .update(users)
    .set({
      role: body.role ?? existing.role,
      passwordHash: body.password ? await hashPassword(body.password) : existing.passwordHash,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, id))

  const [updated] = await db.select().from(users).where(eq(users.id, id))
  return c.json(toSafeUser(updated))
})

app.delete('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const currentUser = c.get('user')!

  const [existing] = await db.select().from(users).where(eq(users.id, id))
  if (!existing) throw new HTTPException(404, { message: 'User not found' })

  if (existing.id === currentUser.id) {
    throw new HTTPException(400, { message: 'Cannot delete your own account' })
  }
  if (existing.role === 'admin') {
    const admins = await adminCount(db)
    if (admins <= 1) throw new HTTPException(400, { message: 'Cannot delete the last remaining admin' })
  }

  await db.delete(users).where(eq(users.id, id))
  return c.body(null, 204)
})

export default app
