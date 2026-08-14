import { sql } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const members = sqliteTable('members', {
  id: text('id').primaryKey(),
  fullName: text('full_name').notNull(),
  nickname: text('nickname'),
  phonenumber: text('phonenumber'),
  birthDate: text('birth_date'),
  deathDate: text('death_date'),
  gender: text('gender', { enum: ['male', 'female'] }).notNull(),
  photoKey: text('photo_key'),
  bio: text('bio'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(current_timestamp)`),
})

export const relationships = sqliteTable('relationships', {
  id: text('id').primaryKey(),
  memberId: text('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  relatedMemberId: text('related_member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['parent', 'spouse'] }).notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
})
