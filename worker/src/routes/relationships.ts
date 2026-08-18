import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { eq } from 'drizzle-orm'
import { members, relationships } from '../db/schema'
import { requireAuth, requireRole } from '../middleware/auth'
import type { Env } from '../env'

const app = new Hono<Env>()

app.use('*', requireAuth, requireRole('admin'))

app.post('/', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const { memberId, relatedMemberId, type } = body

  if (!memberId || !relatedMemberId || !['parent', 'spouse'].includes(type)) {
    throw new HTTPException(400, {
      message: "memberId, relatedMemberId, and type ('parent' | 'spouse') are required",
    })
  }
  if (memberId === relatedMemberId) {
    throw new HTTPException(400, { message: 'A member cannot be related to themselves' })
  }

  const [a] = await db.select().from(members).where(eq(members.id, memberId))
  const [b] = await db.select().from(members).where(eq(members.id, relatedMemberId))
  if (!a || !b) throw new HTTPException(404, { message: 'One or both members not found' })

  const id = crypto.randomUUID()
  await db.insert(relationships).values({
    id,
    memberId,
    relatedMemberId,
    type,
    createdAt: new Date().toISOString(),
  })

  const [created] = await db.select().from(relationships).where(eq(relationships.id, id))
  return c.json(created, 201)
})

app.delete('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const [existing] = await db.select().from(relationships).where(eq(relationships.id, id))
  if (!existing) throw new HTTPException(404, { message: 'Relationship not found' })

  await db.delete(relationships).where(eq(relationships.id, id))
  return c.body(null, 204)
})

export default app
