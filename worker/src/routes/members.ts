import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { eq, or } from 'drizzle-orm'
import { members, relationships } from '../db/schema'
import type { Env } from '../env'

const app = new Hono<Env>()

app.get('/', async (c) => {
  const db = c.get('db')
  const rows = await db.select().from(members)
  return c.json(rows)
})

app.post('/', async (c) => {
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

  return c.json({ ...member, parents, children, spouses })
})

app.put('/:id', async (c) => {
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
      photoKey: body.photoKey ?? existing.photoKey,
      bio: body.bio ?? existing.bio,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(members.id, id))

  const [updated] = await db.select().from(members).where(eq(members.id, id))
  return c.json(updated)
})

app.delete('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const [existing] = await db.select().from(members).where(eq(members.id, id))
  if (!existing) throw new HTTPException(404, { message: 'Member not found' })

  await db.delete(members).where(eq(members.id, id))
  return c.body(null, 204)
})

export default app
