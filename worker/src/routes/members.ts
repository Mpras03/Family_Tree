import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { eq, or } from 'drizzle-orm'
import { members, relationships } from '../db/schema'
import { requireAuth, requireRole } from '../middleware/auth'
import type { Env } from '../env'

const app = new Hono<Env>()

app.use('*', requireAuth)

// birthOrder comes from the client as a number, "" or null; keep it a positive int or null
function normalizeBirthOrder(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null
}

app.get('/', async (c) => {
  const db = c.get('db')
  const rows = await db.select().from(members)

  // attach parent ids so the list view can show / search by parent name
  const parentRels = await db.select().from(relationships).where(eq(relationships.type, 'parent'))
  const parentsByChild = new Map<string, string[]>()
  for (const r of parentRels) {
    const list = parentsByChild.get(r.relatedMemberId) ?? []
    list.push(r.memberId)
    parentsByChild.set(r.relatedMemberId, list)
  }

  return c.json(rows.map((m) => ({ ...m, parents: parentsByChild.get(m.id) ?? [] })))
})

app.post('/', requireRole('admin', 'editor'), async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  if (!body.fullName || !body.gender) {
    throw new HTTPException(400, { message: 'fullName and gender are required' })
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.insert(members).values({
    id,
    fullName: body.fullName,
    nickname: body.nickname ?? null,
    phonenumber: body.phonenumber ?? null,
    birthDate: body.birthDate ?? null,
    deathDate: body.deathDate ?? null,
    gender: body.gender,
    birthOrder: normalizeBirthOrder(body.birthOrder),
    photoKey: body.photoKey ?? null,
    bio: body.bio ?? null,
    createdAt: now,
    updatedAt: now,
  })

  const [created] = await db.select().from(members).where(eq(members.id, id))
  return c.json(created, 201)
})

app.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const [member] = await db.select().from(members).where(eq(members.id, id))
  if (!member) throw new HTTPException(404, { message: 'Member not found' })

  const rels = await db
    .select()
    .from(relationships)
    .where(or(eq(relationships.memberId, id), eq(relationships.relatedMemberId, id)))

  const parents = rels.filter((r) => r.type === 'parent' && r.relatedMemberId === id).map((r) => r.memberId)
  const children = rels.filter((r) => r.type === 'parent' && r.memberId === id).map((r) => r.relatedMemberId)
  const spouses = rels
    .filter((r) => r.type === 'spouse')
    .map((r) => (r.memberId === id ? r.relatedMemberId : r.memberId))

  return c.json({ ...member, parents, children, spouses, relations: rels })
})

app.put('/:id', requireRole('admin', 'editor'), async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const body = await c.req.json()

  const [existing] = await db.select().from(members).where(eq(members.id, id))
  if (!existing) throw new HTTPException(404, { message: 'Member not found' })

  await db
    .update(members)
    .set({
      fullName: body.fullName ?? existing.fullName,
      nickname: body.nickname ?? existing.nickname,
      phonenumber: body.phonenumber ?? existing.phonenumber,
      birthDate: body.birthDate ?? existing.birthDate,
      deathDate: body.deathDate ?? existing.deathDate,
      gender: body.gender ?? existing.gender,
      birthOrder:
        body.birthOrder === undefined ? existing.birthOrder : normalizeBirthOrder(body.birthOrder),
      photoKey: body.photoKey ?? existing.photoKey,
      bio: body.bio ?? existing.bio,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(members.id, id))

  const [updated] = await db.select().from(members).where(eq(members.id, id))
  return c.json(updated)
})

app.delete('/:id', requireRole('admin', 'editor'), async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const [existing] = await db.select().from(members).where(eq(members.id, id))
  if (!existing) throw new HTTPException(404, { message: 'Member not found' })

  await db.delete(members).where(eq(members.id, id))
  return c.body(null, 204)
})

export default app
