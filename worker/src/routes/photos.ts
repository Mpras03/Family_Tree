import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Env } from '../env'

const app = new Hono<Env>()

app.post('/', async (c) => {
  const form = await c.req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: 'file is required (multipart/form-data)' })
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop() : undefined
  const key = ext ? `${crypto.randomUUID()}.${ext}` : crypto.randomUUID()

  await c.env.PHOTOS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  })

  return c.json({ key }, 201)
})

app.get('/:key', async (c) => {
  const key = c.req.param('key')
  const object = await c.env.PHOTOS.get(key)
  if (!object) throw new HTTPException(404, { message: 'Photo not found' })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('cache-control', 'public, max-age=31536000, immutable')

  return new Response(object.body, { headers })
})

export default app
