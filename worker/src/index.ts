import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './db/schema'
import members from './routes/members'
import relationships from './routes/relationships'
import photos from './routes/photos'
import auth from './routes/auth'
import users from './routes/users'
import type { Env } from './env'

const app = new Hono<Env>()

app.use('*', async (c, next) => {
  c.set('db', drizzle(c.env.DB, { schema }))
  await next()
})

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  console.error(err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

app.route('/api/auth', auth)
app.route('/api/users', users)
app.route('/api/members', members)
app.route('/api/relationships', relationships)
app.route('/api/photos', photos)

export default app
