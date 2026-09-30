# Scala’s Shelf Backend Architecture

> Updated: 2026-09-24. Replaces the earlier Workers-gateway + Flask-on-GPU design.
> Decisions and reasoning: `MVP.md` → Decisions (Backend, Database, Auth).

**In one line:** a Hono API on Cloudflare Workers, with Cloudflare D1 (SQLite) as the database and R2 for files, all on free tiers. The app never talks to the database directly.

---

## Layers

```
 Phone / browser (React PWA → Capacitor app)
   │  app files + same-origin /api/* │  published comics (images, audio, JSON)
   ▼                                 ▼
 Cloudflare Worker: app + Hono API  Cloudflare R2 (CDN, no egress fees)
   │  routes → services (plain TypeScript)
   ├── D1 (SQLite): projects, scenes, books, jobs
   ├── R2: Studio voice recordings, published assets
   └── Workers AI (later): scene art, tags, narration voices, speech recognition
   ▲
   │  claims jobs with a shared secret (/api/worker/*)
 GPU worker (RunPod, later): image generation, packaging
```

| Piece | Service | Free tier (2026) |
|---|---|---|
| Web app | Worker static assets (same Worker as the API) | Asset requests free and unlimited |
| API | Cloudflare Workers + Hono | 100K requests/day, **10 ms CPU per request** |
| Database | Cloudflare D1 | 5 GB, 5M rows read/day, 100K rows written/day (queries fail past the daily limit since 2026-09-01) |
| Files | Cloudflare R2 | 10 GB, no egress fees |
| AI | Cloudflare Workers AI | 10,000 neurons/day |

The $5/month Workers Paid plan is the escape hatch when we outgrow this: it raises CPU to 30 s/request (needed for password hashing) and raises D1's limits.

## Code layout

```
api/
  migrations/0001_init.sql   D1 schema; the same files build the local SQLite database
  wrangler.toml              Cloudflare config (D1 + R2 bindings, deploy steps)
  src/
    app.ts                   Hono routes only: read request → call service → JSON
    services/                Business rules as plain functions: studio.ts, books.ts, jobs.ts
    platform.ts              Interfaces the services depend on: Db, FileStore, Auth
    worker.ts                Cloudflare entry: D1 + R2 bindings
    local.ts                 Node stand-ins: SQLite (better-sqlite3), folder file store, migrations
    devServer.ts             Mounted by vite.config.ts on /api during `npm run dev`
    seed.ts                  Demo projects for local development and the demo video
    testing.ts               Real API on in-memory SQLite, for tests
src/lib/api.ts               Frontend client for /api
```

**Rule: business logic never imports Hono, D1 or R2.** Services take a `Db` (the subset of D1's API we use) and plain inputs, and throw domain errors (`NotFound`, `Forbidden`, …) that `app.ts` maps to HTTP codes. That keeps the framework swappable, and it's why the same code runs on Workers and on Node.

## API (current)

| Route | Who | Purpose |
|---|---|---|
| `GET /api/books`, `GET /api/books/:id` | Anyone | Public library; reading needs no account |
| `GET/POST /api/studio/projects` | Creator | List / create (creates the first scene too) |
| `GET/PUT /api/studio/projects/:id` | Owner | Load; save pending project fields + scene drafts in one request |
| `POST /api/studio/projects/:id/scenes`, `DELETE /api/studio/scenes/:id` | Owner | Add scene; delete and renumber |
| `POST /api/studio/projects/:id/publish` / `unpublish` | Owner | Validate the manifest v2 package, add to/remove from the library, queue packaging |
| `POST /api/studio/projects/:id/audio`, `GET/DELETE /api/files/audio/…` | Owner | Voice recordings (private to the creator) |
| `POST /api/render`, `GET /api/render/:id` | Owner | Queue a cloud job and poll it |
| `POST /api/worker/jobs/claim`, `POST /api/worker/jobs/:id/finish` | GPU worker (secret) | Take the next job; report the result |

## Local development

`npm run dev` runs the app and the API together: Vite mounts the Hono app on `/api` and backs it with SQLite at `.data/textweaver.sqlite` (migrated and seeded with the demo story on first run). Delete `.data/` to reset. Cloudflare's own local runtime (`wrangler dev`) needs macOS 13.5+, so it isn't used; SQLite is the same engine as D1.

Local auth is a placeholder: every request is the `demo-creator` user (override with an `x-dev-user` header).

## Deploying (first time)

From `api/`: create the D1 database and R2 bucket, apply migrations with `--remote`, set `WORKER_SECRET`, `npx wrangler deploy`. Steps are in `api/wrangler.toml`. Until real sign-in exists, production treats everyone as an anonymous reader: the library works and the Studio returns 401.

## Authentication: decided later

Sign-in goes behind the `Auth` interface in `api/src/platform.ts` (`userId(request) → string | null`), so nothing else changes when it's added. Constraints collected so far:

- **Many people in Laos don't use email**, so email can't be the main sign-in method.
- **Phone SMS codes cost money per message**, and many students don't have a phone.
- **Reading needs no account.** Accounts are for syncing shelves and progress, schools, and creating.
- Candidates: teacher-created student accounts (username + PIN or class code), Google sign-in (most Android phones have an account), Facebook sign-in (very popular in Laos), WhatsApp or phone codes if the cost works out.
- **Better Auth** (open source, stores users in our D1) is the leading library. Password/PIN hashing doesn't fit the free plan's 10 ms CPU limit, so either use methods without hashing, measure Workers' native scrypt, or move to Workers Paid ($5/month).
- Roles and the school hierarchy (district → school → grade → class → lesson plan) stay in our own tables, not in the auth library.

## Status (2026-09-24)

- Supabase is gone: the library, book page, reader, My Library and Studio all use `/api`. The purchase and payment pages were removed (everything is free).
- Offline: saved books (package + images) live in IndexedDB (`src/lib/offline.ts`); the service worker caches the app itself in production builds.
- **Live:** https://scalas-shelf.knives-thao.workers.dev (Worker serving the app + `/api/*`, D1 `textweaver` in APAC, both demo books loaded with `npm run seed:remote`). Checked in a browser: library, reader, offline download and offline reading work; every write endpoint returns 401.
- **Switched off** (`src/lib/features.ts`): `rendering` (scene art, panel layout, audio) and `cloudStudio` (server storage + publishing). The Studio saves drafts on the writer's device (`src/lib/studioStore.ts` → `deviceStore`); the API's Studio routes stay built and tested but unused, and refuse everything in production because there's no sign-in.
- R2 not enabled yet (needs the dashboard; only voice recordings use it, and they're on hold).
- `gpu/package_content.py` still writes to Supabase; it gets reworked when the real GPU worker is built (it should claim `package` jobs from `/api/worker/jobs/claim`).

## API layer (2026-09-30)

The phone edits and displays; the Worker does the rest.

- **Versioned:** every route is at `/api/v1/…` (the app and mobile builds use it). The bare `/api/…` paths are the same routes, kept for what was deployed before versioning, the GPU worker and stored `/api/files/` links.
- **Reading events:** `POST /api/v1/events` takes batches of up to 50 anonymous events (random device id; no account, name, IP or user agent). The app queues them on the phone and sends them when online (`src/lib/events.ts`). Admins get per-book totals at `GET /api/v1/admin/stats`. Table: `events` (migration 0006).
- **AI usage:** every Scala call is recorded in `ai_usage` (task, model, book, tokens, time, success) through `metered()` in `services/ai.ts`. Admins: `GET /api/v1/admin/ai-usage`. Tokens only; cost is worked out from current prices at report time.
- **Server-built books:** sending for review builds the package on the server from the saved scenes and enforces the same checklist the Studio shows (`src/lib/checklist.ts`).
- **Background jobs:** Scala Finish runs as a job (`kind = 'finish'`, migration 0008) after the response is sent (`ctx.waitUntil`); the Studio polls `GET /api/v1/studio/jobs/:id`. The GPU worker only claims `scene`, `layer` and `package` jobs. A finish job still running after 3 minutes is reported as failed. If jobs outgrow `waitUntil`, move them to Cloudflare Queues behind `runInBackground()`.

Deploying needs migrations 0004–0008 applied first: from `api/`, `npx wrangler d1 migrations apply textweaver --remote`.
