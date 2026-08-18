import type { drizzle } from 'drizzle-orm/d1'
import type * as schema from './db/schema'

export type SessionUser = {
  id: string
  username: string
  role: 'admin' | 'user'
}

export type Env = {
  Bindings: {
    DB: D1Database
    PHOTOS: R2Bucket
    ASSETS: Fetcher
    ADMIN_USERNAME: string
    ADMIN_PASSWORD: string
  }
  Variables: {
    db: ReturnType<typeof drizzle<typeof schema>>
    user?: SessionUser
  }
}
