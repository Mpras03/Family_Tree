import type { drizzle } from 'drizzle-orm/d1'
import type * as schema from './db/schema'

export type Env = {
  Bindings: {
    DB: D1Database
    PHOTOS: R2Bucket
    ASSETS: Fetcher
  }
  Variables: {
    db: ReturnType<typeof drizzle<typeof schema>>
  }
}
