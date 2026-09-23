# Textweaver Architecture

> Single source of truth for the entire stack. Providers, costs, and how they connect.
> Updated: 2026-07-13

---

## Providers

| Provider | What it runs | Why |
|----------|-------------|-----|
| **Cloudflare** | SPA (Pages), API gateway (Workers), content storage + CDN (R2) | Free tier, zero egress fees, SE Asia edges (Vientiane, Bangkok, Singapore) |
| **Supabase** | Database (Postgres), phone auth, cover image storage | Built-in phone OTP, row-level security, free tier to 50K users |
| **RunPod** | GPU compute: UE5 rendering + Llama 3 + SDXL | Cheapest GPU: $0.19/hr (spot) / $0.29/hr (on-demand) for A5000 24GB |

---

## Stack Diagram

```
USER (Laos, $50 Android phone)
         │
         ▼
┌────────────────────────────────────────────┐
│  CLOUDFLARE (free tier)                     │
│                                            │
│  Pages ───── serves React SPA               │
│  Workers ─── routes API requests, validates  │
│  R2 ──────── stores rendered comics/books    │
│  CDN ─────── delivers content (SE Asia)      │
│              Zero egress fees               │
│                                            │
│  Cost: ~$50/yr (R2 storage + domain)        │
└─────────────┬──────────────────────────────┘
              │
┌─────────────▼──────────────────────────────┐
│  SUPABASE                                   │
│                                            │
│  Auth ─────── phone OTP (built-in)          │
│  Database ─── Postgres                     │
│  Storage ──── cover images                 │
│                                            │
│  Cost: $0/mo (free) → $25/mo (pro, 50K+)   │
└─────────────┬──────────────────────────────┘
              │
┌─────────────▼──────────────────────────────┐
│  RunPod A5000 (24GB VRAM)                    │
│                                            │
│  UE5 ──────── Blueprint + MRQ rendering     │
│  Ollama ───── Llama 3 8B (scene parsing)    │
│  ComfyUI ──── SDXL (image generation)       │
│                                            │
│  Dev: $0.19/hr spot × 100 hrs = $19/mo     │
│  Prod: $0.29/hr on-demand × 180 hrs = $52/mo│
└────────────────────────────────────────────┘
```

---

## Integration Points

### Creator hits "Generate"

```
Browser (Cloudflare Pages)
  │  POST /api/render { scene_text }
  ▼
Workers API gateway
  │  PUT queue row in Supabase
  ▼
Supabase (render_queue table)
  │
  ▼
RunPod Flask API (polls queue every 10s)
  │
  ├── Ollama (Llama 3): narration → scene JSON
  ├── ComfyUI (SDXL): scene JSON → character + background PNGs
  ├── UE5 Blueprint: scene JSON + PNGs → MRQ render
  │
  ▼
Upload rendered output to R2
  │
  ▼
Update Supabase: status=complete, result_url=r2://...
```

### User downloads a comic

```
Browser (Cloudflare Pages)
  │  GET /content/{id}/manifest
  ▼
Workers API
  │  Reads manifest from Supabase
  ▼
R2 (CDN edge in Vientiane/Bangkok)
  │  Per-scene download, resume-capable
  ▼
IndexedDB (offline storage in browser)
```

### User buys a book (QR payment)

```
Browser: scan QR code → bank app → WhatsApp confirmation
  │
  ▼
Admin panel: /admin → Confirm payment
  │
  ▼
Supabase: confirm_payment() → credits user → records purchase
```

---

## Data Flow

```
                    Cloudflare                Supabase           RunPod
                    ──────────                ────────           ──────

SPA (Pages)  ←─────────────────────────►  REST API           PostgreSQL
                                                            
Workers      ←────────────────┐                        
                              │                        
R2 (CDN)     ◄── rendered ────┘── upload ←── Flask API ─── UE5/Llama/SDXL
```

---

## Estimated Costs (12 months)

| Provider | Service | Monthly | Annual |
|----------|---------|---------|--------|
| Cloudflare | Pages + Workers | $0 | $0 |
| Cloudflare | R2 (storage ~2GB) | ~$1 | ~$12 |
| Cloudflare | Domain | ~$1 | ~$10 |
| Supabase | Free tier | $0 | $0 |
| RunPod | Dev GPU (100 hrs/mo spot) | $19 | $114 |
| RunPod | Prod GPU (180 hrs/mo on-demand) | $52 | $312 |
| **Total** | | | **~$448** |

After free tier exhaustion (>50K users, >high R2 usage):
| Supabase | Pro plan | $25 | $300 |
| R2 | Additional storage | +$5 | +$60 |
| **Total (scaled)** | | | **~$858** |

---

## Related Docs

| Doc | What it covers |
|-----|---------------|
| `build-plan.md` | 15-step prompt-by-prompt build plan with status |
| `backend-architecture.md` | Workers as router, DB functions for business logic, RunPod/RunPod backend |
| `ai-architecture.md` | Self-hosted Llama 3 + SDXL on shared GPU |
| `sequential-plan.md` | Grant execution pipeline (Epic → ISIF → follow-on) |
| `dev-workflow.md` | Local development setup, Docker, testing |
