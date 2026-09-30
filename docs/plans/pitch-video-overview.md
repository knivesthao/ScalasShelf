# Scala’s Shelf — Product Screenshots & Pitch Video Overview

> **For:** ADMAIS LLC × External AI Assistant collaboration
> **Purpose:** Plan screenshots, UI layouts, and short video captures for the Epic MegaGrant pitch video
> **Date:** 2026-07-31

---

## 1. High-Level Architecture & Tech Stack

Scala’s Shelf is an **AI-powered digital media platform for Laos** that generates comics and interactive children's books, then distributes them through a mobile-first digital library accessible to Lao citizens via phone number.

### What the app does

| Audience | Role | Key Actions |
|----------|------|-------------|
| **Users** (Lao citizens) | Read & purchase | Browse library, buy with QR/WhatsApp payment, download for offline reading |
| **Creators/Publishers** | Produce content | Write narration → AI generates scenes in UE5 → publish to library |
| **Admin** (ADMAIS) | Manage platform | Verify payments, monitor render queue |

### Core Technologies

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend** | React 18 + TypeScript + React Router v6 | SPA hosted on Cloudflare Pages |
| **API Gateway** | Cloudflare Workers | Thin routing layer — queues renders, proxies to Supabase |
| **Database & Auth** | Supabase (Postgres) | Phone OTP auth, content catalog, purchases, payments, render queue |
| **Content Storage** | Cloudflare R2 | Zero-egress-fee CDN for Southeast Asia; stores rendered comics/books |
| **GPU Compute** | RunPod A5000 (24GB VRAM) | UE5 headless rendering + Llama 3 (narration parsing) + SDXL (image gen) |
| **Offline Client** | PWA (Service Worker + IndexedDB) | Installable on $50 Android phones, works offline after download |
| **Packaging** | Python (Pillow + R2 AWS4 signing) | Image compression, manifest generation, CDN upload |

### Architecture Diagram

```
USER (Laos, $50 Android phone)
         │
         ▼
┌────────────────────────────────────────────┐
│  CLOUDFLARE (free tier)                     │
│  Pages ───── serves React SPA               │
│  Workers ─── routes API requests            │
│  R2 ──────── stores rendered comics/books   │
│  CDN ─────── zero egress fees (SE Asia)     │
└─────────────┬──────────────────────────────┘
              │
┌─────────────▼──────────────────────────────┐
│  SUPABASE                                   │
│  Auth ─────── phone OTP (built-in)          │
│  Database ─── Postgres (REST API)           │
└─────────────┬──────────────────────────────┘
              │
┌─────────────▼──────────────────────────────┐
│  RunPod A5000 (24GB VRAM)                    │
│  UE5 ──────── Blueprint + MRQ rendering     │
│  Ollama ───── Llama 3 (narration → JSON)    │
│  ComfyUI ──── SDXL (image generation)       │
└────────────────────────────────────────────┘
```

---

## 2. UI & Screen Map

### Complete Route Table

| Route | Component | Status | Description |
|-------|-----------|--------|-------------|
| `/` | `Library` | ✅ Complete | Content catalog grid with search + language filter |
| `/book/:id` | `BookDetail` | ✅ Complete | Cover, description, price, "Buy" button |
| `/purchase/:id` | `Purchase` | ✅ Complete | QR code + WhatsApp payment instructions (Lao + English) |
| `/read/:id` | `Reader` | ✅ Complete | Scene-by-scene reader with download progress, offline support |
| `/my-library` | `MyLibrary` | ✅ Complete | Purchased books grid with download status badges |
| `/admin` | `Admin` | ✅ Complete | Payment verification table (confirm/reject) |
| `/studio` | `StudioDashboard` | ✅ Complete | Creator project list + "New Comic"/"New Book" buttons |
| `/studio/:type/:id` | `StudioEditor` | ✅ Complete (UI only) | Panel-by-panel editor with narration input + Generate button |

### Screen Descriptions

#### Library (`/`) — Primary Landing Page
- Header with "Scala’s Shelf" title + nav link to My Library
- Search bar + language dropdown filter (All / ລາວ / English)
- Responsive grid of cover cards: image, title, language badge, reading level badge, price in kip
- Empty state: "No books found."

#### Book Detail (`/book/:id`)
- Back navigation button
- Hero section: cover image (left) + metadata (right)
- Tags: language, reading level
- Description text
- Price display (accent color)
- "Buy" CTA button → transitions to Purchase page (production) or My Library (dev)

#### Purchase (`/purchase/:id`) — QR Payment Flow
- Book header with thumbnail + title + creator
- Price display in accent color
- QR code image (placeholder — `/mock/qr-placeholder.png`)
- "Scan with your banking app" hint
- Step-by-step instructions in English
- WhatsApp number + Lao instructions block
- "I've Paid" button → success state → redirect to My Library
- Success state: checkmark icon + confirmation message

#### Reader (`/read/:id`) — The Core Reading Experience
- Top toolbar: Back button, scene counter (e.g., "3 / 5"), Download All button, "✓ Offline" badge
- Progress bar during bulk download
- Scene viewport: iframe-rendered scene content (dark background)
- Loading state: spinner + "Loading scene..." + cache progress bar
- Bottom navigation: ← Prev / dot indicators / Next →
- Keyboard navigation: ArrowLeft / ArrowRight
- Full-screen immersive reading layout (fills viewport)

#### My Library (`/my-library`)
- Offline banner (teal) when no internet connection
- Header: "My Library" + "← Browse Library" link
- Grid of purchased books with:
  - Cover image + download badge (✓ = downloaded, ☁ = not downloaded)
  - Title, language badge, reading level badge
  - "Remove" button for downloaded content (long-press type action)
- Empty states: "Log in to see your purchased books" / "No books purchased yet"

#### Admin (`/admin`)
- Header with pending payment count badge
- Tab bar: Pending / All
- Table: Date, User (phone), Book, Amount (kip), Status badge, Actions
- Confirm (✓) and Reject (✗) buttons on pending rows
- Status badges: pending (red), confirmed (teal), rejected (muted)

#### Studio Dashboard (`/studio`)
- "Creator Studio" header + back link to Library
- "+ New Comic" and "+ New Book" action buttons
- Project grid: title, type badge, language badge, status badge (draft/published)

#### Studio Editor (`/studio/:type/:id`) — Creator Tool
- Editor toolbar: Back button, editable title input, "Saved" indicator
- Scene list with numbered cards:
  - Scene number circle (accent color)
  - Narration textarea with contextual placeholder
  - Scene preview frame (dark placeholder for rendered output)
  - "Generate" button with loading spinner state
- Footer: "+ Add Scene/Panel" button + "Publish" button

---

## 3. Visual Workflows for Screen Recording

### Workflow 1: User Discovery → Purchase → Read (Best Narrative Arc)
**Duration:** ~30 seconds (or split into 3 clips of ~10s each)

| Step | Screen | Action | Visual Appeal |
|------|--------|--------|---------------|
| 1 | `/` | Library grid loads, shows covers with language badges | Clean dark UI, card grid animation |
| 2 | `/` | User types into search bar, results filter live | Real-time filter, smooth interaction |
| 3 | `/book/1` | Tap a card → transitions to detail page | Route transition, hero layout |
| 4 | `/book/1` | Tap "Buy" → transitions to purchase | CTA button interaction |
| 5 | `/purchase/1` | QR code displayed with instructions in Lao | QR + bilingual UI, culturally relevant |
| 6 | `/purchase/1` | "I've Paid" → success checkmark animation → auto-redirect | Success state, positive feedback |
| 7 | `/my-library` | Book appears in purchased library with download badge | Grid update, status indicators |
| 8 | `/read/1` | Reader opens, download progress bar fills, scenes load | Progress animation, immersive reader |
| 9 | `/read/1` | User swipes through scenes with dot indicators | Scene transitions, navigation fluidity |

**Recommended 5–10s clips for pitch video:**
- **Clip A (8s):** Library grid → search filter → tap card → book detail reveal
- **Clip B (10s):** Purchase flow: price display → QR code → "I've Paid" → success → redirect to My Library
- **Clip C (8s):** Reader: download progress bar animates → scene loads → user navigates between scenes

### Workflow 2: Creator Studio — The "Magic" Demo
**Duration:** ~15 seconds

| Step | Screen | Action | Visual Appeal |
|------|--------|--------|---------------|
| 1 | `/studio` | Dashboard with project list | Clean project management UI |
| 2 | `/studio` | Click "+ New Comic" → editor opens | Instant creation |
| 3 | `/studio/comic/:id` | Type narration in Lao into panel 1 | Text input, bilingual capability |
| 4 | `/studio/comic/:id` | Click "Generate" → spinner → preview appears | Loading animation → result |
| 5 | `/studio/comic/:id` | Add multiple panels, scroll through list | Building a full comic strip |

**Recommended 5–10s clip:**
- **Clip D (10s):** Type Lao narration → click "Generate" → spinner animation → preview frame updates → scroll to panel 2

### Workflow 3: Admin Payment Verification
**Duration:** ~5 seconds

| Step | Screen | Action | Visual Appeal |
|------|--------|--------|---------------|
| 1 | `/admin` | Table with pending payments | Data table, status badges |
| 2 | `/admin` | Click ✓ to confirm a payment | Row updates, badge changes from red to teal |

---

## 4. Key Files & Configs

### Entry & Routing

| File | Role | Lines |
|------|------|-------|
| `src/main.tsx` | React root — mounts App inside BrowserRouter | 12 |
| `src/App.tsx` | Route definitions + AuthProvider + ErrorBoundary + InstallPrompt | 33 |
| `index.html` | Vite entry HTML | — |

### Pages (7 route-level components)

| File | Route | Lines | Key State |
|------|-------|-------|-----------|
| `src/pages/Library.tsx` | `/` | 117 | `content[]`, `search`, `language` filter |
| `src/pages/BookDetail.tsx` | `/book/:id` | 130 | `book`, `purchasing` |
| `src/pages/Purchase.tsx` | `/purchase/:id` | 203 | `book`, `submitted` (success state) |
| `src/pages/Reader.tsx` | `/read/:id` | 284 | `manifest`, `sceneStates` (Map), `progress` |
| `src/pages/MyLibrary.tsx` | `/my-library` | 184 | `books[]`, `downloadedIds` (Set), `offline` |
| `src/pages/Admin.tsx` | `/admin` | 187 | `payments[]`, `filter`, `confirming` (Set) |
| `src/pages/Studio.tsx` | `/studio` + `/studio/:type/:id` | 221 | `projects[]`, `scenes[]`, `generatingId` |

### Hooks & State Management

| File | Role |
|------|------|
| `src/hooks/useAuth.tsx` | React Context — Supabase phone OTP auth (user, signIn, signOut) |
| `src/hooks/useGenerate.ts` | Render pipeline — queues generation via Workers API, polls for result |
| `src/hooks/useRetry.ts` | Exponential backoff retry wrapper for unreliable connections |

### Data Layer

| File | Role |
|------|------|
| `src/lib/supabase.ts` | Supabase client initialization + stub client for dev without credentials |
| `src/lib/idb.ts` | IndexedDB wrapper — store/get/remove cached scenes for offline reading |
| `src/lib/messages.ts` | Lao-language UI string constants (all user-facing labels) |

### Infrastructure

| File | Role |
|------|------|
| `workers/api-gateway.ts` | Cloudflare Worker — `POST /api/render` (queue job), `GET /api/render/:id` (poll status) |
| `gpu/package_content.py` | Python script on RunPod — WebP compression, manifest generation, R2 upload, Supabase metadata |
| `gpu/requirements.txt` | Python dependencies (Pillow, requests) |

### Styling

| File | Lines | Notes |
|------|-------|-------|
| `src/index.css` | 964 | Single CSS file, no framework. Dark theme (`#0f0f23`), mobile-first, touch targets ≥48px, full Reader + Admin + Studio styling |

### Config & Build

| File | Role |
|------|------|
| `package.json` | React 18, React Router 6, Supabase JS, Vite, Vitest, Playwright |
| `vite.config.ts` | Vite config with path aliases (`@/` → `src/`) |
| `tsconfig.json` | TypeScript strict config |
| `vitest.config.ts` | Unit test config (jsdom environment) |
| `playwright.config.ts` | E2E test config |

### PWA

| File | Role |
|------|------|
| `public/manifest.json` | PWA manifest — app name, icons, standalone display |
| `public/service-worker.js` | Service Worker — caches app shell, enables offline launch |

### Mock Data

| Path | Content |
|------|---------|
| `public/mock/cover-placeholder.png` | Placeholder cover image for content cards |
| `public/mock/qr-placeholder.png` | Placeholder QR code for purchase flow |
| `public/mock/content/1/manifest.json` | 5-scene comic manifest (The Brave Buffalo) |
| `public/mock/content/1/scene_01.html` through `scene_05.html` | Placeholder scene HTML (dark theme, title, art emoji, text) |

---

## 5. Visual Readiness Assessment

### ✅ Complete & Pitch-Ready (Part A: Digital Library)

| Screen | Polish Level | Notes |
|--------|-------------|-------|
| **Library** (`/`) | ⭐⭐⭐⭐ | Clean dark UI, responsive grid, real-time search, language filter. Cards with cover images, badges, prices. Ready to record. |
| **Book Detail** (`/book/:id`) | ⭐⭐⭐⭐ | Hero layout with cover + metadata, clear CTA, back navigation. Polished. |
| **Purchase** (`/purchase/:id`) | ⭐⭐⭐⭐ | QR code display, bilingual instructions (English + Lao), success animation with checkmark, auto-redirect. Strong visual flow. |
| **Reader** (`/read/:id`) | ⭐⭐⭐⭐ | Full-screen immersive reader, progress bar animation, scene dot indicators with cached/active states, keyboard navigation, offline badge. Good motion. |
| **My Library** (`/my-library`) | ⭐⭐⭐⭐ | Offline banner, download status badges (✓/☁), remove action. Clean grid. |
| **Admin** (`/admin`) | ⭐⭐⭐ | Functional table with status badges and confirm/reject buttons. Utilitarian — not visually "wow" but clean and professional. |

### ⭐ Pitch-Ready But Limited (Part B: Creator Studio)

| Screen | Polish Level | Notes |
|--------|-------------|-------|
| **Studio Dashboard** (`/studio`) | ⭐⭐⭐ | Project grid with type/language/status badges. Clean but minimal. |
| **Studio Editor** (`/studio/:type/:id`) | ⭐⭐⭐ | Scene editor with numbered cards, narration textarea, preview frame. **Generate button triggers a stub** (2s simulated delay, returns mock HTML). Good for demonstrating the UX flow, but not real AI output. |

### ⬜ Not Visual / Not Built

| Component | Status | Notes |
|-----------|--------|-------|
| UE5 Blueprint Orchestrator (B2) | Not started | Core rendering engine — no visual output yet |
| Comic Post-Process Shader (B5) | Not started | Cel shading, edge detection, halftone — the "comic look" |
| Llama 3 on RunPod (B3) | Not started | Narration-to-JSON parsing |
| Stable Diffusion on RunPod (B4) | Not started | AI image generation |
| Render Pipeline Connection (B7) | Not started | Real Generate button → RunPod → UE5 chain |
| Content Packaging Pipeline (C3) | Not started | Automated WebP compression + R2 upload |
| UI Localization | Partial | String constants in `messages.ts` but UI renders English labels primarily |

---

## 6. Pitch Video Strategy Recommendations

### What to show (high polish, real code)

1. **Library Browse → Search** (5s) — Shows the polished catalog UI with Lao language badges, demonstrates the app works
2. **Purchase Flow** (8s) — QR code → instructions in Lao → "I've Paid" → success animation. Shows cultural relevance + real payment integration
3. **Reader Experience** (7s) — Download progress bar → scene loads → navigation between scenes. Shows offline-first design + PWA capability
4. **Creator Studio UX** (10s) — Type narration → Generate → preview appears. Shows the creator workflow even if backed by a stub

### What to mock up, animate, or show as concept art

5. **UE5 Pipeline Animation** — An animated diagram showing: narration text → Llama 3 parsing → JSON → UE5 Blueprint → comic-shaded render. This is the "magic" — it doesn't need to be real footage, a motion graphic communicates the concept powerfully
6. **Before/After Comic Shader** — Side-by-side: photorealistic UE5 render → post-processed comic shader output. Even a static mockup of this is compelling
7. **Device Context Shot** — Show the app running on a low-end Android phone mockup (Moto G4 dimensions, 320px width). Reinforces the $50 phone narrative

### What to avoid showing

- Code editors, terminal output, or developer tools
- Stub/mock data being obviously fake (the placeholder art emoji 🎨 in scenes)
- Empty states (no books found, no projects yet)
- Admin panel (functional but not visually compelling for a pitch video)

### Color Palette (for motion graphics / overlays)

```
--bg:       #0f0f23  (deep navy — dark background)
--bg-card:  #1a1a2e  (card surfaces)
--accent:   #ff6b6b  (coral red — CTAs, highlights)
--badge-lao: #4ecdc4 (teal — Lao language indicator)
--text:     #e4e4e4  (light gray — primary text)
```

---

## 7. File Index for Screenshot Capture

When capturing screenshots, open these routes in the browser (dev server):

```bash
# Start dev server
cd ScalasShelf && npm run dev
# Opens at http://localhost:5173
```

| Screenshot | URL | What to Capture |
|------------|-----|-----------------|
| Library with content | `http://localhost:5173/` | Full grid with search + filters visible |
| Book detail | `http://localhost:5173/book/1` | Hero layout with cover + Buy button |
| Purchase — QR code | `http://localhost:5173/purchase/1` | QR + instructions (scroll to show Lao text) |
| Purchase — success | Click "I've Paid" | Success checkmark animation |
| Reader — scene 1 | `http://localhost:5173/read/1` | Toolbar + scene frame + nav dots |
| Reader — downloading | Click "Download All" | Progress bar animation (record video) |
| My Library | `http://localhost:5173/my-library` | Grid with download badges |
| Studio Dashboard | `http://localhost:5173/studio` | Project grid + New buttons |
| Studio Editor | Create a project → editor | Narration input + Generate button |
| Admin | `http://localhost:5173/admin` | Payment table with status badges |
| Mobile viewport | Any route, resize to 360×640 | Responsive layout on small screen |

---

*End of overview. For build status tracking, see `docs/plans/build-plan.md`. For grant details, see `docs/grants/epic-megagrants/index.md`.*
