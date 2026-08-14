# CLAUDE.md

Dokumen ini menjadi panduan konteks untuk Claude Code saat mengerjakan project **Family Tree App**.

## Ringkasan Project

Aplikasi silsilah keluarga pribadi dengan fitur:
- Input & kelola data anggota keluarga (termasuk foto profil)
- Relasi antar anggota (orang tua, anak, pasangan)
- Dashboard visual yang menggambarkan pohon keluarga (tree diagram)

Project ini untuk kebutuhan pribadi, bukan produk komersial. Prioritas: simple, mudah di-maintain sendirian, minim moving parts.

## Tech Stack

**Arsitektur:** Satu Cloudflare Worker sebagai deployable tunggal — melayani API (`/api/*`) sekaligus static assets hasil build Vue (lewat `assets` binding di `wrangler.jsonc`). Tidak ada Pages project terpisah, tidak ada Dockerfile, tidak ada Render.

- **Backend:** [Hono](https://hono.dev) (mirip Express, didesain untuk Cloudflare Workers) berjalan di `worker/`
- **Frontend:** Vue 3 + TypeScript + Vite (SPA), Composition API (`<script setup>`), di-build ke `client/dist` lalu di-serve langsung oleh Worker
- **Database:** Cloudflare **D1** (SQLite terkelola Cloudflare)
- **ORM:** **Drizzle** — bukan Prisma. Prisma butuh driver adapter + `nodejs_compat` untuk jalan di D1 dan bikin bundle Worker membengkak; Drizzle native untuk D1, ringan, dan dipakai di template resmi Cloudflare
- **File storage foto profil:** Cloudflare **R2**, diakses lewat R2 *binding* langsung dari Worker (bukan S3 access key/secret) — upload & serve foto lewat route Worker sendiri
- **Visualisasi tree:** [`family-chart`](https://github.com/donatso/family-chart) — library khusus family tree (native model parent/child/spouse), dipasang dalam komponen Vue via `ref` + `onMounted`
- **Deployment:** Wrangler CLI (`wrangler.jsonc`), langsung ke Cloudflare (Workers + D1 + R2), tanpa Docker

> Project awalnya direncanakan untuk Render (Express + Dockerfile + SQLite lokal), tapi diarahkan ulang ke Cloudflare-native sejak scaffold pertama karena itu target deploy akhirnya. Workers berjalan di V8 isolate tanpa filesystem/native binding, jadi `better-sqlite3` dan `express.static` tidak relevan di stack ini.

## Struktur Folder

```
family-tree/
├── worker/                       # Cloudflare Worker (backend + serve assets)
│   ├── src/
│   │   ├── db/
│   │   │   └── schema.ts         # Drizzle schema: members, relationships
│   │   ├── routes/
│   │   │   ├── members.ts        # CRUD members
│   │   │   ├── relationships.ts  # tambah/hapus relasi parent & spouse
│   │   │   └── photos.ts         # upload ke R2, stream foto by key
│   │   ├── env.ts                # tipe Env (Bindings: DB, PHOTOS, ASSETS)
│   │   └── index.ts              # Hono app, error handling terpusat
│   ├── drizzle/                  # migration SQL hasil `drizzle-kit generate`
│   ├── drizzle.config.ts
│   ├── wrangler.jsonc            # binding D1, R2, assets
│   └── package.json
├── client/                       # Vue 3 + Vite frontend
│   ├── src/
│   │   ├── views/                 # MemberListView, MemberFormView, MemberDetailView, TreeView
│   │   ├── stores/                # membersStore (Pinia)
│   │   ├── router/
│   │   ├── App.vue
│   │   └── main.ts
│   ├── vite.config.ts             # dev proxy: /api -> wrangler dev (port 8787)
│   └── package.json
├── package.json                   # npm workspaces (client, worker) + root scripts
└── CLAUDE.md
```

## Skema Database

Model self-referencing untuk relasi keluarga, didefinisikan di `worker/src/db/schema.ts` (Drizzle):

**Table `members`**
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | text (uuid) | primary key |
| full_name | text | |
| nickname | text | nullable |
| phonenumber | text | nullable |
| birth_date | text | nullable |
| death_date | text | nullable, kalau sudah meninggal |
| gender | text enum (male/female) | |
| photo_key | text | nullable, object key di R2 (bukan URL langsung) |
| bio | text | nullable |
| created_at / updated_at | text (ISO datetime) | |

**Table `relationships`**
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | text (uuid) | primary key |
| member_id | FK -> members.id | untuk type=parent, ini adalah ortu |
| related_member_id | FK -> members.id | untuk type=parent, ini adalah anak |
| type | text enum (parent, spouse) | relasi child di-derive dari kebalikan parent, tidak disimpan dua arah |
| created_at | text (ISO datetime) | |

## API (Hono routes, di-mount di `worker/src/index.ts`)

- `GET/POST /api/members`, `GET/PUT/DELETE /api/members/:id` (detail resolve `parents`/`children`/`spouses`)
- `POST /api/relationships`, `DELETE /api/relationships/:id`
- `POST /api/photos` (multipart upload ke R2, return `{ key }`), `GET /api/photos/:key` (stream dari R2)
- Error handling terpusat via `app.onError` di `index.ts` (lempar `HTTPException` dari `hono/http-exception` di route, jangan try/catch manual per handler) — semua error di-response sebagai JSON `{ error: message }`

## Konvensi Kode

- Backend: TypeScript, `async/await`, error handling terpusat via `app.onError` (lihat di atas)
- Frontend: Composition API (`<script setup>`), Pinia untuk state management, jangan pakai Options API
- Naming: `camelCase` untuk variabel/fungsi JS/TS, `snake_case` untuk kolom database (Drizzle schema pakai `camelCase` di TS tapi map ke kolom `snake_case`)
- Commit message: format singkat deskriptif, tidak perlu strict conventional commits

## Perintah yang Sering Dipakai

```bash
# Install semua dependency (workspaces)
npm install

# Development
npm run dev:worker      # wrangler dev di http://127.0.0.1:8787 (backend + local D1/R2)
npm run dev:client      # vite dev server, proxy /api -> wrangler dev

# Database (Drizzle -> D1)
npm run db:generate                        # generate migration SQL dari schema.ts
cd worker && npm run db:migrate:local      # apply migration ke D1 lokal
cd worker && npm run db:migrate:remote     # apply migration ke D1 production (setelah setup Cloudflare)

# Build & deploy
npm run build:client    # build Vue ke client/dist
npm run deploy          # build client lalu wrangler deploy
```

## Setup Cloudflare (dilakukan manual, interaktif — bukan otomatis)

Belum dijalankan di project ini. Sebelum bisa deploy ke Cloudflare sungguhan:

1. `wrangler login`
2. `wrangler d1 create family-tree-db` → salin `database_id` yang muncul ke `worker/wrangler.jsonc` (ganti placeholder `REPLACE_AFTER_WRANGLER_D1_CREATE`)
3. `wrangler r2 bucket create family-tree-photos`
4. `cd worker && npm run db:migrate:remote` (apply migration ke D1 production)
5. `npm run deploy` dari root
6. Opsional: custom domain via Cloudflare DNS, atau pakai subdomain gratis `*.workers.dev`
7. Dipertimbangkan: Cloudflare Access (gratis untuk personal use) sebagai login wall, karena saat ini belum ada auth/access control sama sekali dan data akan bisa diakses publik lewat URL default

## Status & TODO

- [x] Setup project skeleton (worker + client, npm workspaces)
- [x] Setup Drizzle schema (members, relationships) + migration pertama
- [x] CRUD endpoint members
- [x] Endpoint relationships (tambah/hapus relasi parent-child, spouse)
- [x] Upload foto profil ke R2 (proxy upload via Worker, bukan presigned URL)
- [x] Dashboard tree view (integrasi `family-chart`)
- [x] Form tambah/edit anggota keluarga
- [x] Verifikasi lokal: `wrangler dev` + local D1/R2 jalan end-to-end
- [ ] Setup akun Cloudflare (D1, R2, deploy) — lihat bagian "Setup Cloudflare" di atas
- [ ] Pertimbangkan auth/access control sebelum deploy publik (Cloudflare Access atau semacamnya)
- [ ] Polish UI (styling masih minimal, belum ada validasi form yang kuat)

## Catatan untuk Claude Code

- Worker melayani `/api/*` sekaligus static assets Vue lewat `assets` binding di `wrangler.jsonc` — `not_found_handling: "single-page-application"` menangani client-side routing, `run_worker_first: ["/api/*"]` memastikan request API selalu masuk ke Hono app, bukan asset fallback.
- Jangan simpan file upload ke filesystem lokal — foto langsung ke R2 lewat binding `PHOTOS`, tidak butuh access key/secret sama sekali.
- Prioritaskan struktur relasi keluarga yang generik (parent/spouse) supaya bisa handle kasus keluarga besar/kompleks (poligami, anak angkat, dst) tanpa perlu redesign schema besar-besaran nantinya.
- Perubahan schema selalu lewat `worker/src/db/schema.ts` → `npm run db:generate` → apply migration (local dulu, remote setelah Cloudflare setup selesai). Jangan edit file SQL migration di `worker/drizzle/` secara manual.
