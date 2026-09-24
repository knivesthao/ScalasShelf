# Textweaver

A free English-learning app for students in Laos: short animated comics, written for
their level, that download once and read anywhere, even without internet. Includes a
Studio where writers turn a few lines of English into an animated comic.

## Quick Start

```bash
git clone https://github.com/knivesthao/Textweaver.git
cd Textweaver
npm install
npm run dev            # app + API on http://localhost:5173
```

That's all: no accounts or keys needed. `npm run dev` also runs the API (Hono, in
`api/`) on `/api`, backed by a local SQLite database in `.data/` that is created and
seeded with demo content on first run: a published comic ("Morning Market") and a
draft to finish in the Studio ("Noy and the Buffalo"). Delete `.data/` to reset.

- Library: `/` · My Library (saved on this device): `/my-library` · Studio: `/studio`
- Scene art in development comes from the demo art pack in `public/demo-art/`
  (regenerate with `scripts/generate-demo-art.py`).
- Offline mode needs the production build: `npm run build && npm run preview`, open
  the site once, download a book, then go offline.

## Architecture

Cloudflare, on free tiers: one Worker serves the app and the API (Hono), with D1 as the
database and R2 for files. See `docs/plans/backend-architecture.md`.

## Running Tests

```bash
npm test               # unit, API and page tests (Vitest)
npx playwright test    # browser walkthrough; needs `npm run dev` running
npm run record         # demo video clips into ./recordings (reset .data/ first)
```

## Live site

**https://textweaver.knives-thao.workers.dev** — one Cloudflare Worker (free plan)
serving the app and the API, with the D1 database `textweaver` (APAC).

```bash
npm run deploy         # build + deploy (needs `npx wrangler login` once)
npm run seed:remote    # (re)load the demo books into the Cloudflare database
```

What's switched off for now (`src/lib/features.ts`):
- **Studio is writing-only and saved on the writer's device.** No scene art, panel
  layout or audio, and no publishing. Nothing from the Studio reaches the database;
  the API refuses all writes until sign-in exists.
- Voice recordings also need R2: enable it in the Cloudflare dashboard, create the
  bucket, and uncomment `[[r2_buckets]]` in `api/wrangler.toml`.
