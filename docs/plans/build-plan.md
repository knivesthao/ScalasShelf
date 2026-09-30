> **Superseded (2026-09-24):** this describes the earlier Supabase + QR-payment prototype. Current setup: `README.md`; current design: `backend-architecture.md` and `MVP.md`.

# Scala’s Shelf — Build Plan (Prompt-by-Prompt)

> **Build order:** Digital Library first → Creator Studio second.
> **Architecture:** Cloudflare Pages (SPA) + Cloudflare Workers (API gateway) + Supabase (database + auth) + RunPod GPU (UE5 + AI inference) + R2 (content storage).
> See `cloud-architecture.md` for infrastructure details.
> Each prompt is self-contained — copy one at a time into a chat.
> **Status:** `⬜` not started, `🟡` in progress, `✅` done.

---

## PART A: Digital Library

### A1 — Scaffold the project (Cloudflare + Supabase)
✅

```
We're building Scala’s Shelf — a digital media library for comics and interactive children's books, primarily for Laos.

Scaffold the entire project:

Tech stack:
- Cloudflare Pages for the SPA (React)
- Cloudflare Workers for the API gateway (thin routing layer)
- Supabase for database (Postgres) + auth (phone number, built-in) + storage
- Cloudflare R2 for content storage (rendered comics, books)

Setup:
1. Cloudflare Pages — deploy a "Hello World" React app
2. Supabase — create project, set up phone auth (built-in), create schema:
   - users (managed by Supabase Auth)
   - content (id, title, creator_name, language, reading_level, cover_image_url, price_kip, description)
   - purchases (user_id, content_id, purchased_at)
   - payments (user_id, content_id, amount_kip, status, created_at)
3. Cloudflare Workers — deploy a health check: GET /api/health
4. R2 — create bucket "lmm-content"

Goal: all services talking to each other. Supabase handles auth — no hand-rolled login code.
```

### A2 — Content catalog (browse + search)
✅

```
Build the content catalog for the digital library.

Users browse available comics and books, search, and filter by language (Lao, English) and reading level.

Supabase: content table already exists from A1. Seed with 5 placeholder entries.

Build:
- /library — grid of cover images with title, price, language badge
- /search — search bar with live filter results  
- /book/:id — detail page: cover, description, creator, price, "Buy" button

Content metadata comes from Supabase REST API (auto-generated endpoints from schema). Workers routes requests.
Cover images are placeholder PNGs in R2 — we'll replace later.

Mobile-first — our users are on $50 Android phones.
```

### A3 — QR payment + WhatsApp confirmation flow
✅

```
Build the purchase flow. Laos has no online payments — users pay by scanning a QR code, sending payment confirmation to WhatsApp, and we manually verify.

Flow:
1. User taps "Buy" on book detail → sees QR code, price in kip, WhatsApp number, instructions in Lao
2. User pays via bank app (scans QR), sends WhatsApp message with their phone number
3. Admin panel: admin sees pending payments, verifies WhatsApp message, clicks "Confirm"
4. System credits user balance + adds book to their purchased library

Build:
- /purchase/:id — shows QR + instructions + "I've paid" button (registers attempt)

Supabase tables (from A1):
- payments: id, user_id, content_id, amount_kips, status, created_at
- purchases: user_id, content_id, purchased_at

Workers routes admin confirm/deny requests to Supabase.
QR image is a static file in R2. WhatsApp number and instructions are configurable.
```

### A4 — Download system (chunked, offline-capable)
✅

```
Build the content download system. Media must work on unstable 2G connections in rural Laos.

Requirements:
- Full 20-page comic under 5MB total
- Content split into per-scene chunks (~200-300KB each)
- User downloads scene 1, starts reading while scene 2 downloads in background
- Connection drops → resume, no restart from beginning
- Downloaded content stored in IndexedDB, available offline

Build:
- GET /api/content/:id/manifest — returns list of scene chunks with URLs and sizes (Workers → Supabase → R2)
- R2 folder per title: /content/{id}/scene_01.webp, scene_02.webp, ..., manifest.json
- /read/:id — reader page:
  - Fetches manifest, downloads scenes one at a time with progress bar
  - Stores each scene in IndexedDB after download
  - Swipe/scroll between scenes, no internet needed after download
- PWA setup: manifest.json + Service Worker + "Add to Home Screen"

Test with 3-5 placeholder scenes in R2.
```

### A5 — User library (purchased content)
✅

```
Build the "My Library" section. Purchased content appears here. Users see what they own, what's downloaded, and read offline.

Build:
- /my-library — grid of purchased titles
  - Each card: cover, title, download status (cloud = not downloaded, checkmark = downloaded)
  - Tap opens reader, long-press offers "Remove download"
- Workers → Supabase: GET purchases JOIN content for user's purchased items
- Download status from IndexedDB (checked on page load)

Library works offline — shows cached data from last online session.
```

---

## PART B: Creator Studio

### B1 — Set up RunPod GPU + UE5
✅

```
Provision the cloud GPU where all UE5 development and rendering will happen.

1. Create RunPod account (runpod.io)
2. Provision an A5000 GPU: 24GB VRAM, ~$0.29/hr on-demand ($0.19/hr spot for dev)
3. Install Unreal Engine 5 on it
4. Install Python 3 + Flask (for the REST API that will control UE5)
5. Set up remote desktop or SSH access
6. Verify UE5 launches and runs headless
7. Build a health check script: launch UE5 in headless mode, render a blank scene, exit
8. Configure auto-shutdown after 30 min of inactivity (save money)

Goal: you can remote into the GPU, run UE5, and trigger renders programmatically.
```

### B2 — UE5 Blueprint orchestrator (first render test)
⬜

```
Build the UE5 pipeline on the RunPod GPU. This turns a scene description into a rendered image.

Inside UE5:
1. **Base mesh library** — ~20 simple 3D models:
   - 2 characters (boy, girl — generic shapes)
   - 5 background elements (tree, house, rice field, market stall, temple silhouette)
   - Sky/lighting rig (DirectionalLight, SkyLight, ExponentialHeightFog)
   - CineCameraActor pointing at the stage

2. **Blueprint Orchestrator** (Level Blueprint):
   - Reads a JSON file from disk
   - Spawns character + background meshes at specified positions
   - Configures lighting from JSON parameters
   - Positions camera
   - Renders via Movie Render Queue
   - Saves output PNG to disk

3. **Test with a hardcoded JSON scene** — verify a rendered image appears.

Goal: UE5 on the cloud GPU reads a scene description → produces a rendered output, no human interaction.
```

### B3 — Self-host Llama 3 on RunPod (narration → scene JSON)
⬜

```
Set up a self-hosted LLM on the RunPod GPU to convert story narration into structured scene data. No external API costs — runs on the same GPU during idle time between UE5 renders.

Install and configure:
1. Install Ollama: curl -fsSL https://ollama.com/install.sh | sh
2. Pull Llama 3.1 8B: ollama pull llama3.1:8b
   - This is a quantized model that runs in ~6GB VRAM — fits alongside UE5 on the A5000 (24GB)
3. Start the Ollama API server: ollama serve
   - This exposes a local REST API at port 11434
4. Test it: curl http://localhost:11434/api/chat with a simple prompt

Build the system prompt — this is the most important part. The prompt tells the model:
- Break narration into logical panels/scenes
- For each panel: characters present, positions on a defined stage grid, expressions, background elements, lighting mood, camera framing
- Output EXACT JSON matching our UE5 Blueprint format
- Coordinates must be within the defined stage area

Build the Python bridge (runs on the RunPod machine):
- A simple Flask endpoint: POST /api/parse-narration
- Accepts: { "narration": "A boy walks through a rice field at sunset..." }
- Calls Ollama at http://localhost:11434/api/chat with narration + system prompt
- Returns the parsed scene JSON

Test with a sample narration → verify it returns valid JSON.
```

### B4 — Self-host Stable Diffusion on RunPod (image generation)
⬜

```
Set up AI image generation on the RunPod GPU. Runs on the same GPU during idle time between UE5 renders. Zero external API costs.

Install and configure:
1. Install ComfyUI (popular SD interface): git clone https://github.com/comfyanonymous/ComfyUI
2. It runs on the same RunPod GPU — uses VRAM when UE5 isn't rendering
3. Download SDXL model: sd_xl_base_1.0.safetensors
4. Download IP-Adapter model (for character consistency across scenes)
5. Start ComfyUI with the --listen flag so the API is accessible: python main.py --listen
6. Test it: open the ComfyUI web interface and generate a test image from a prompt

Build the ControlNet workflow for character consistency:
- When a creator uploads or approves a character reference image, store it
- Subsequent generations use IP-Adapter + ControlNet to match the reference
- This ensures a character on page 1 looks the same on page 20

The Python bridge (same Flask API from B3) gets another endpoint:
- POST /api/generate-images
- Accepts: { "character_prompts": [...], "background_prompts": [...] }
- Calls ComfyUI's local API to generate each image
- Returns generated image URLs

For the prototype, you can also use UE5's built-in materials (solid colors, procedural textures) instead of AI-generated images. The AI image gen is optional until you need original art.
```

### B5 — Comic post-process shader
⬜

```
Build the custom comic post-process material in UE5 on the RunPod GPU.

The rendered output should look like a comic book, not photorealistic 3D. Build a post-process material:

1. **Edge detection** — bold black outlines on geometry edges
2. **Cel shading** — quantize lighting into flat color bands (3-4 levels)
3. **Halftone screen** — dot patterns in shadow areas (printed comic look)
4. **Color palette** — restrict to warm, illustrated children's book palette

Build as a UE Material (post-process domain), applied to the Post Process Volume automatically by the Blueprint orchestrator before rendering.

Test: render same scene with and without shader — comic version should look like a graphic novel page.
```

### B6 — Creator web app (Cloudflare)
✅

```
Build the web-based creator studio. Creators log in, write stories, preview AI output, publish.

Build on Cloudflare Pages:

**1. Studio Dashboard (/studio)**
- List of creator's projects (comics and books in progress)
- "New Comic" and "New Book" buttons
- Each project: title, last edited, status (draft/published)

**2. Comic Editor (/studio/comic/:id)**
- Panel-by-panel editor:
  - Left: text input per panel — creator writes narration in Lao or English
  - Right: preview — rendered panel output
- "Add Panel" button
- "Generate" per panel → sends narration, triggers full pipeline on RunPod, returns preview
- Drag/drop to reorder panels
- Metadata: title, description, language, reading level, price in kip

**3. Book Editor (/studio/book/:id)**
- Same as comic but scene-based (for interactive books)
- Each scene: narration + optional "animation direction" field

**4. Project Settings (/studio/settings/:id)**
- Edit metadata, preview full comic/book, "Publish" button

Supabase: projects + scenes tables. Workers routes CRUD to Supabase.
POST /api/studio/generate → triggers the RunPod render pipeline (B7).
```

### B7 — Connect Creator Studio to the rendering pipeline
⬜

```
Connect the Cloudflare creator app to the RunPod GPU rendering pipeline.

When a creator hits "Generate", the full chain fires on the single GPU machine:
Llama 3 (scene parse) → Stable Diffusion (image gen) → UE5 (render) → R2 → preview.

Build the orchestration Worker:

**POST /api/studio/generate**
1. Receives { scene_text, project_id, scene_number }
2. Calls RunPod GPU REST API: POST /parse-narration (B3 — self-hosted Llama 3) → scene JSON
3. Calls RunPod GPU REST API: POST /generate-images (B4 — self-hosted SD) → image URLs
4. Calls RunPod GPU REST API: POST /render — scene JSON + image URLs → Blueprint → MRQ render
5. Returns { job_id, status: "processing" }

**RunPod GPU REST API** (Python Flask, runs on the GPU machine):
- POST /parse-narration — calls Ollama (Llama 3) → returns scene JSON
- POST /generate-images — calls ComfyUI (Stable Diffusion) → returns image URLs
- POST /render — queues a UE5 render job, waits for idle GPU, runs Blueprint → MRQ, uploads output to R2
- All three share the same GPU. Rendering gets priority; AI inference queues during idle time.
- GET /render/:job_id — returns status + result R2 URL

**Frontend polling:**
- After "Generate" — polls GET /api/studio/generation-status/:job_id every 5 seconds
- Shows loading states: "Reading story..." → "Creating characters..." → "Building scene..." → "Rendering..."
- When complete → displays rendered preview in editor

Expect 2-5 min per scene. GPU queues AI inference between render jobs.
```

---

## PART C: Admin + Infrastructure

### C1 — Admin panel
✅

```
Admin panel for the platform.

Supabase's built-in dashboard handles most admin needs:
- Table editor for browsing/editing payments, users, content directly
- SQL editor for queries
- Auth dashboard for user management

Build the one piece Supabase doesn't cover:
- /admin/payments — table of pending QR/WhatsApp payments with Confirm/Reject buttons
  - Supabase: payments table already has status column. Admin actions update it.
- /admin/generation-queue — monitor RunPod render pipeline (B7). Filter by status.

Protect admin routes: check user role in Supabase JWT (set admin users via Supabase dashboard).
```

### C2 — PWA + Mobile optimizations
✅

```
Make the library installable as a PWA and optimized for low-end Android.

1. manifest.json — app name, icons, theme color, display: standalone
2. Service Worker — caches app shell (HTML, CSS, JS) for offline launch
3. "Add to Home Screen" prompt after first login
4. All images WebP with lazy loading
5. Touch targets ≥ 48px, readable on 4.5" screen at 320px
6. API calls: timeout + retry (3x with exponential backoff)
7. Loading states + error messages in Lao
8. Offline banner when Service Worker detects no connection

Test: Chrome DevTools → Moto G4, 2G throttling. App loads under 3 seconds.
```

### C3 — Content packaging + upload pipeline
⬜

```
Build the content packaging pipeline on the RunPod GPU.

When a creator publishes, the system:
1. Takes rendered image sequence from MRQ output
2. Compresses each to WebP (quality 75, max width 800px)
3. Full 20-panel comic under 5MB total
4. Generates manifest.json with scene files, sizes, order
5. Uploads all to R2: /content/{id}/scene_{n}.webp + manifest.json + cover.webp
6. Inserts metadata into D1 content table

Build as a Python script on the RunPod GPU machine that:
- Takes a folder path of rendered images
- Takes metadata as arguments
- Runs WebP compression (Pillow)
- Uploads to R2 (Cloudflare SDK)
- Inserts metadata via Workers API

Runs as manual step during prototype — creator publishes → dev runs script → content appears in library.
```

## Status Tracking

```
PART A: Digital Library ✅ COMPLETE
✅ A1 — Scaffold the project (React + Supabase + Cloudflare)
✅ A2 — Content catalog (browse + search)
✅ A3 — QR payment + WhatsApp confirmation flow
✅ A4 — Download system (chunked, offline-capable, PWA)
✅ A5 — User library (purchased content + download status)

PART B: Creator Studio ⬜ Not started
⬜ B1 — Set up RunPod GPU + UE5
⬜ B2 — UE5 Blueprint orchestrator (first render test)
⬜ B3 — Self-host Llama 3 on RunPod (narration → scene JSON)
⬜ B4 — Self-host Stable Diffusion on RunPod (image generation)
⬜ B5 — Comic post-process shader
✅ B6 — Creator web app (Cloudflare)
⬜ B7 — Connect Creator Studio to rendering pipeline
✅ B7 — Connect Creator Studio to rendering pipeline

PART C: Admin + Infrastructure
✅ C1 — Admin panel
✅ C2 — PWA + Mobile optimizations
✅ C3 — Content packaging + upload pipeline
```
