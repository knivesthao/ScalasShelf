# Textweaver — Local Development Workflow

> How to run everything on your machine without RunPod, Docker, or cloud costs.
> You only spin up what you're working on.

---

## The Principle

| When working on | You need running | You DON'T need |
|----------------|-----------------|----------------|
| **Library UI** (browse, buy, read) | React dev server + Supabase (cloud) | Workers, RunPod, UE5 |
| **Creator Editor UI** (write stories) | React dev server + Supabase (cloud) | RunPod, UE5 |
| **Creator Generate** (trigger renders) | React + Workers (local) + Supabase | RunPod (returns mock) |
| **API routes** (Workers logic) | Workers dev server (local) + Supabase | RunPod, UE5 |
| **UE5 Blueprint pipeline** (B2, B5) | UE5 on RunPod GPU only | Everything else |
| **Llama 3 / SDXL** (B3, B4) | On RunPod GPU only | Everything else |

**For 90% of development, you only need React + Supabase.**

---

## Step 1: Clone and Install

```bash
git clone https://github.com/knivesthao/Textweaver.git
cd Textweaver

# Frontend (React + Vite)
npm install

# Workers (optional — only when editing API routes)
npm install -g wrangler

# Supabase CLI (optional — only when changing schema)
brew install supabase/tap/supabase
```

## Step 2: Environment Variables

Create `.env` at the root:

```
# From your Supabase project dashboard
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# For Workers (when running locally)
SUPABASE_SERVICE_KEY=your-service-role-key
```

You get these values once from Supabase dashboard → Settings → API. Write them down and never touch them again.

## Step 3: Start What You Need

### For Library work (UI only)

```bash
# One terminal
cd Textweaver
npm run dev
# → Opens http://localhost:5173
# → Supabase SDK connects directly to cloud Supabase
# → No Workers needed — Supabase handles auth + data
```

The React app talks to Supabase directly using anon key + row-level security. This works for:
- Browsing the catalog
- Login/register
- Viewing purchases
- Reading content (from local placeholder files)

**Mock the "Buy" button** — in dev mode, have it skip payment and just insert a purchase row. Add a flag:

```js
// vite.config.js — add a mock flag
define: { __DEV_MOCK_PAYMENTS__: true }

// In the app — skips QR payment flow in dev
if (typeof __DEV_MOCK_PAYMENTS__ !== 'undefined') {
  // Just purchase directly, no payment screen
}
```

### For Creator Editor work (writing stories)

Same setup — just React + Supabase:

```bash
npm run dev
# → Opens http://localhost:5173/studio
# → Creator can: create projects, write narration, save scenes
# → "Generate" button returns a PLACEHOLDER image
```

The "Generate" button should show a loading animation and after 2 seconds return a hardcoded placeholder image:

```js
// During local development — no GPU needed
async function generateScene(narration) {
  if (import.meta.env.DEV) {
    // Return a placeholder after a mock delay
    await new Promise(r => setTimeout(r, 2000));
    return { status: 'complete', result_url: '/mock/scene_01.png' };
  }
  // Real API call when deployed
  return await workersApi.post('/api/render', { scene_text: narration });
}
```

The placeholder image is just a PNG in `public/mock/` — could be a simple text overlay showing what the scene should be: "Scene 1: A boy walks through a rice field."

### For Workers API work

```bash
# Terminal 1: Workers
cd Textweaver/workers
wrangler dev

# Terminal 2: React
cd Textweaver
npm run dev
```

Workers runs on `http://localhost:8787`. Change the API base URL in the React app when running both:

```js
const API_BASE = import.meta.env.DEV ? 'http://localhost:8787' : '/api';
```

### For RunPod work (UE5 + AI)

**This only happens on the cloud GPU, never locally.** You make changes to the Python scripts in `gpu/`, push to GitHub, and the GPU auto-pulls and restarts.

If you absolutely need to test UE5 Blueprints locally (B2, B5), you'd need a machine that can run UE5 — which you've already said you don't have. So this work IS the RunPod machine. You access it via remote desktop:

```
1. SSH into RunPod
2. git pull
3. Make Blueprint changes in UE5 Editor (remote desktop)
4. Push to GitHub
```

This is the one part of development that isn't local. Everything else is.

## Summary: What You Type Day-to-Day

```bash
# 90% of the time — just this
cd Textweaver && npm run dev

# When editing Workers API routes
cd Textweaver/workers && wrangler dev               # Terminal 1
cd Textweaver && npm run dev                         # Terminal 2

# When editing UE5 or Python backend
git commit -am "fix: updated Blueprint orchestrator"
git push                                      # → auto-deploys to RunPod

# Full deploy (rare — once a week maybe)
git push origin main                          # → deploys everything
```

## What a Typical Day Looks Like

| Time | What | Command |
|------|------|---------|
| Morning | Fix library catalog layout | `npm run dev` → edit React components → save → browser refreshes |
| Midday | Add search filter API | `wrangler dev` → edit Workers route → save → test with curl |
| Afternoon | Tweak UE5 render pipeline | SSH into RunPod → edit Blueprint in UE5 → push to GitHub |
| End of day | Deploy everything | `git push` |

**You never switch project folders or manage multiple repos. You have one project open in your editor. You only run the parts you're actively working on.**
