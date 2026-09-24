# Textweaver Architecture

> Updated 2026-09-24. The detailed, current design is in [`backend-architecture.md`](./backend-architecture.md);
> product scope and decisions are in [`MVP.md`](./MVP.md). This page is the one-screen overview.

| Layer | What | Where |
|---|---|---|
| App | React + Vite PWA (Capacitor wrapper later for app stores) | `src/` |
| API | Hono on Cloudflare Workers; the same Worker serves the app | `api/` |
| Database | Cloudflare D1 (SQLite); local dev uses a SQLite file | `api/migrations/` |
| Files | Cloudflare R2 (not enabled yet) | `api/src/worker.ts` |
| Offline | IndexedDB for saved books; service worker for the app shell | `src/lib/offline.ts`, `public/service-worker.js` |
| Scene art | Cloud jobs (`/api/render`, claimed by the GPU worker); demo mode uses `public/demo-art/` | `src/hooks/useGenerate.ts` |
| Comic format | Motion-comic manifest v2 (layers + keyframes + text keyed by language), Lite edition now, HD later | `src/lib/format.ts` |

Everything runs on Cloudflare free tiers. Supabase, RunPod-hosted Flask, and the QR purchase flow from earlier versions of this page are gone.
