# Textweaver — Backend Architecture (How It All Connects)

> **Short answer:** Yes, we need a real backend. Cloudflare Workers handles the *public gateway* (routing, auth, fast operations). The RunPod GPU runs a *full Python backend* (Flask/FastAPI) that handles all the heavy work. The frontend talks to Workers, not directly to RunPod.

---

## The Three Layers

```
┌────────────────────────────────────────────────────────────────────┐
│  LAYER 1: FRONTEND (Cloudflare Pages)                              │
│                                                                     │
│  React SPA running in the user's browser.                           │
│  Two apps in one: Library (buy/read) + Creator Studio (write/generate)│
│                                                                     │
│  Makes API calls to: Layer 2 (Workers)                              │
│  Loads content from: R2 (via CDN, no API needed)                    │
└────────────────────────────────────────────────────────────────────┘
         │                           ▲
         │  HTTP calls               │
         ▼                           │
┌────────────────────────────────────────────────────────────────────┐
│  LAYER 2: API GATEWAY (Cloudflare Workers)                          │
│                                                                      │
│  Public HTTPS endpoints. Lightweight, fast (under 10ms each).       │
│                                                                      │
│  Routes:                                                             │
│    GET /api/content     ──►  Supabase REST                           │
│    POST /api/purchase   ──►  Supabase REST                           │
│    POST /api/render     ──►  RunPod Flask API                    │
│    GET  /api/render/:id ──►  RunPod Flask API                    │
│                                                                      │
│  Does NOT do any heavy work — just routes and validates.             │
└────────────────────────────────────────────────────────────────────┘
         │                           ▲
         │  HTTP calls               │
         ▼                           │
┌────────────────────────────────────────────────────────────────────┐
│  LAYER 3: COMPUTE + DATA                                           │
│                                                                     │
│  ┌─────────────────────┐   ┌────────────────────────────┐          │
│  │ SUABASE (cloud)      │   │ RUNPOD GPU                │
│  │                      │   │                            │          │
│  │ Postgres database   │   │ Flask/FastAPI Python backend│          │
│  │ Phone auth          │   │   ↓                         │          │
│  │ User data           │   │   Llama 3 (scene parse)    │          │
│  │ Content metadata    │   │   SDXL (image gen)         │          │
│  │ Purchases, payments │   │   UE5 (3D render)          │          │
│  │ Projects, scenes    │   │                            │          │
│  └─────────────────────┘   └──────────┬─────────────────┘          │
│                                       │                             │
│                                       ▼                             │
│                              ┌────────────────┐                     │
│                              │ R2 (content     │                     │
│                              │ storage)        │                     │
│                              │                 │                     │
│                              │ Finished comics │                     │
│                              │ and books       │                     │
│                              └────────────────┘                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## How Each API Call Flows

### Library operations (fast, <1 second each)

```
User browses catalog
────► Worker: GET /api/content?language=lao
     ────► Supabase: SELECT * FROM content WHERE language='lao'
     ◄──── Returns JSON
◄──── Returns JSON to browser

User clicks "Buy"
────► Worker: POST /api/purchase { content_id, user_id }
     ────► Supabase: INSERT INTO purchases + UPDATE user balance
     ◄──── 200 OK
◄──── 200 OK
```

Workers handles these easily — they're simple database reads/writes under 30ms.

### Creator studio operations (slow, minutes per render)

```
Creator clicks "Generate" on a scene
────► Worker: POST /api/render { scene_text, project_id, scene_number }
     ────► Workers adds to render queue (Supabase table: render_queue)
     ────► Returns { job_id, status: "queued" } immediately
◄──── Frontend starts polling every 3 seconds

Meanwhile on RunPod GPU:
─────────────────────────────────
The Flask API polls Supabase render_queue table every 10 seconds:
  GET /pending-items → finds new job
  POST /api/render/claim { job_id } → marks as "in_progress"
  
  === Sequential pipeline (1 machine, no parallelism) ===
  Step 1: Llama 3 — "A boy walks through a rice field..." → { scene JSON }
  Step 2: SDXL — { scene JSON } → character.png, background.png
  Step 3: UE5 — { scene JSON + PNGs } → renders comic panel → output.png
  Step 4: Compress output → upload to R2
  Step 5: UPDATE render_queue SET status='complete', result_url='r2://...'

  Time: 2-5 minutes total. GPU runs all three jobs in sequence.
─────────────────────────────────

Frontend polls:
────► Worker: GET /api/render/:job_id
     ────► Supabase: SELECT status FROM render_queue WHERE id=:job_id
     ◄──── { status: "rendering" } or { status: "complete", result_url }
◄──── When complete, frontend shows the rendered scene
```

---

## What Workers Actually Runs (Code)

The Workers code is short. Each route is ~5-15 lines:

```js
// Example: POST /api/render — kick off a render job
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Route: submit a render job
    if (url.pathname === '/api/render' && request.method === 'POST') {
      const body = await request.json();
      
      // 1. Validate JWT (from Supabase)
      const user = await validateSupabaseJWT(request.headers);
      if (!user) return new Response('Unauthorized', { status: 401 });
      
      // 2. Save to queue in Supabase
      const { data, error } = await supabaseClient.from('render_queue').insert({
        user_id: user.id,
        scene_text: body.scene_text,
        project_id: body.project_id,
        status: 'queued'
      });
      
      // 3. Return immediately — don't wait for the render
      return new Response(JSON.stringify({ job_id: data.id, status: 'queued' }));
    }

    // Route: check render status
    if (url.pathname.match(/^\/api\/render\/(.+)/) && request.method === 'GET') {
      const jobId = url.pathname.split('/')[3];
      const { data } = await supabaseClient.from('render_queue')
        .select('status, result_url').eq('id', jobId).single();
      return new Response(JSON.stringify(data));
    }

    // Route: library catalog
    if (url.pathname === '/api/content' && request.method === 'GET') {
      const { data } = await supabaseClient.from('content').select('*');
      return new Response(JSON.stringify(data));
    }
  }
}
```

Workers is just a **thin routing layer** — typically ~50 lines total for the entire app.

---

## The RunPod Backend (Where the Real Work Happens)

This is the "real backend" you're thinking of. It's a Python Flask/FastAPI server:

```python
# runpod_server.py — runs on the GPU machine
from fastapi import FastAPI
from ollama import chat  # interacts with local Llama 3

app = FastAPI()

@app.post("/render")
def start_render(job: RenderJob):
    # Step 1: Parse narration with Llama 3
    scene_json = ollama.chat(
        model="llama3.1:8b",
        messages=[{"role": "system", "content": SYSTEM_PROMPT},
                  {"role": "user", "content": job.scene_text}]
    )
    
    # Step 2: Generate character/background images with SDXL
    images = comfyui.generate(
        characters=scene_json["characters"],
        backgrounds=scene_json["backgrounds"]
    )
    
    # Step 3: Trigger UE5 Blueprint via Remote Control API
    ue5.render(scene_json, images)
    
    # Step 4: Upload result to R2
    r2_upload("lmm-content", f"projects/{job.project_id}/scene_{job.scene_number}.webp")
    
    # Step 5: Update Supabase
    supabase.table("render_queue").update({"status": "complete"}).eq("id", job.id)
```

This is a proper backend server. It runs continuously on the RunPod GPU machine.

---

## Truth Table: What Each Layer Handles

| Operation | Workers (CF) | Why it works | Supabase | RunPod Flask |
|-----------|-------------|-------------|----------|------------------|
| **User login** | ✅ Routes to Supabase | Just returns JWT | ✅ Processes auth | ❌ |
| **Browse library** | ✅ Routes to Supabase | <30ms DB query | ✅ Returns content | ❌ |
| **Buy content** | ✅ Routes to Supabase | <30ms DB write | ✅ Inserts purchase | ❌ |
| **Confirm payment** | ✅ Routes to Supabase | Admin click | ✅ Updates status | ❌ |
| **Kick off a render** | ✅ Inserts queue row | <30ms DB write | ✅ Stores the job | ❌ |
| **Check render status** | ✅ Reads queue row | <30ms DB read | ✅ Returns status | ❌ |
| **Parse narration (LLM)** | ❌ Needs GPU | 30s timeout | ❌ | ✅ Llama 3 on GPU |
| **Generate images (SDXL)** | ❌ Needs GPU | 30s timeout | ❌ | ✅ SDXL on GPU |
| **Render scene (UE5)** | ❌ Needs GPU + Python | 30s timeout | ❌ | ✅ UE5 Blueprint |
| **Compress + upload** | ❌ Needs Python | 30s timeout | ❌ | ✅ Python + R2 SDK |

---

## What This Means in Practice

**Workers is NOT a backend server.** It's a routing gateway — like a receptionist that directs calls to the right department (Supabase for data, RunPod for compute). It never does the actual work.

**The PAPERSAPE machine IS the real backend.** It runs:
- A Flask/FastAPI server (public endpoint: not exposed to internet, only accessible from Workers)
- Llama 3 (AI)
- ComfyUI (Stable Diffusion)
- UE5 (rendering engine)
- Queue worker (polls Supabase for new jobs)

**The frontend never talks to RunPod directly.** Everything goes through Workers. The frontend doesn't need to know that RunPod exists — it just calls Workers endpoints and waits for results.

---

## Why Not Use a Traditional Server Instead of Workers?

You could. But Workers is better for the gateway layer because:
- **Zero cold start** — Workers respond in <5ms globally
- **No server to manage** — no patching, no scaling, no downtime
- **SE Asia edge** — Workers run in Singapore, close to users
- **It's just a router** — there's no business logic complex enough to need a full server here

The only server we manage is the RunPod GPU — and that's because it has hardware (GPU) that can't exist anywhere else.
