# GPU Cost Comparison — Cheapest Route

> Cloudflare + Supabase are locked in (free/cheap, zero egress).
> Question: What's the cheapest GPU for UE5 + Llama 3 + SDXL?

---

## What We Need

| Task | VRAM requirement | Monthly GPU hours (dev) | Monthly GPU hours (prod) |
|------|-----------------|------------------------|--------------------------|
| UE5 development (Blueprint, MRQ) | 6–8GB | 100 hrs | — |
| UE5 rendering (creator content) | 6–8GB | — | ~60 hrs (2 hrs/day) |
| Llama 3 8B (scene parsing) | ~6GB | 20 hrs | ~30 hrs |
| SDXL (image generation) | ~8GB | 20 hrs | ~30 hrs |

**VRAM floor:** 16GB (can't run UE5 + SDXL simultaneously on 8GB card).
**Best fit:** 16–24GB VRAM card (P5000, A4000, A5000, L4).

---

## GPU Options (16–24GB VRAM)

### 1. Paperspace P5000 — $0.78/hr, $461/mo

16GB VRAM. Good for UE5 development + rendering. SDXL runs on same GPU but shares VRAM.

| Phase | Hours | Cost |
|-------|-------|------|
| Dev (mo 1–6) | 100 hrs/mo on-demand | $78/mo × 6 = $468 |
| Prod (mo 7–12) | GPU on during working hours (~8 hrs/day) | $461/mo × 6 = $2,766 |
| **12-month GPU total** | | **$3,234** |

### 2. Paperspace A4000 — $0.76/hr, $488/mo

16GB VRAM. Newer architecture than P5000 but same VRAM.

| Phase | Hours | Cost |
|-------|-------|------|
| Dev (mo 1–6) | 100 hrs/mo on-demand | $76/mo × 6 = $456 |
| Prod (mo 7–12) | Working hours | $488/mo × 6 = $2,928 |
| **12-month GPU total** | | **$3,384** |

### 3. Paperspace A5000 — $1.38/hr, $891/mo

24GB VRAM. Room for UE5 + SDXL simultaneously without VRAM sharing.

| Phase | Hours | Cost |
|-------|-------|------|
| Dev (mo 1–6) | 100 hrs/mo on-demand | $138/mo × 6 = $828 |
| Prod (mo 7–12) | Working hours | $891/mo × 6 = $5,346 |
| **12-month GPU total** | | **$6,174** |

### 4. GCP G2 L4 — $0.67/hr (on-demand), ~$0.50/hr (1yr committed)

24GB VRAM. GCP's budget GPU. Room for everything simultaneously.

| Phase | Hours | Cost |
|-------|-------|------|
| Dev (mo 1–6) | 100 hrs/mo on-demand | $67/mo × 6 = $402 |
| Prod (mo 7–12) | on-demand all month | $485/mo × 6 = $2,910 |
| **12-month GPU total** | | **$3,312** |

With 1-year committed use discount ($0.50/hr):

| Phase | Hours | Cost |
|-------|-------|------|
| Full year (720 hrs/mo) | committed 1yr | $360/mo × 12 = **$4,320** |

### 5. RunPod A5000 — $0.29/hr on-demand, $0.19/hr spot

24GB VRAM. Cheapest usable option. UE5 needs to be verified on their platform.

| Phase | Hours | Cost |
|-------|-------|------|
| Dev (mo 1–6) | 100 hrs/mo on-demand | $29/mo × 6 = $174 |
| Prod (mo 7–12) | 180 hrs/mo | $52/mo × 6 = $312 |
| **12-month GPU total** | | **$486** |

If dev uses spot pricing ($0.19/hr) with risk of preemption:
| Dev (mo 1–6) | 100 hrs/mo spot | $19/mo × 6 = $114 |
| Prod (mo 7–12) | 180 hrs/mo on-demand | $52/mo × 6 = $312 |
| **12-month spot + on-demand** | | **$426** |

---

## Full Stack Cost (everything included)

| Provider | GPU only | + Cloudflare ($50) | + Supabase ($25–150) | **Annual total** |
|----------|---------|--------------------|-----------------------|-------------|
| **RunPod spot** | $426 | $50 | $175 | **~$651** |
| **RunPod on-demand** | $486 | $50 | $175 | **~$711** |
| **Paperspace P5000** | $3,234 | $50 | $175 | **~$3,459** |
| **GCP G2 L4 (on-demand)** | $3,312 | — | — | $3,312 (+ infra) |
| **Paperspace A5000** | $6,174 | $50 | $175 | **~$6,399** |
| **GCP committed 1yr** | $4,320 | — | — | $4,320 (+ infra) |

---

## Verdict

**RunPod is 5–10x cheaper than everything else.** At $651/yr total (spot pricing for dev, on-demand for prod), the entire Textweaver infrastructure costs less than a single month of AWS GPU time.

| Tier | Cost/yr | When to use |
|------|---------|------------|
| **🥇 RunPod** | **~$650** | Absolute cheapest. Accept risk of spot preemption during dev. |
| **🥈 Paperspace P5000** | **~$3,459** | Safe bet. Proven UE5 compatibility. No preemption risk. |
| **🥉 GCP G2** | **~$4,320** | If you want one cloud for everything. |

---

## The $650/year Stack

```
┌────────────────────────────────────────────────────┐
│                  Cloudflare (free)                  │
│  Pages: React SPA                                   │
│  Workers: API gateway                               │
│  R2: Content storage + CDN (no egress)               │
│                                                     │
│  Cost: $50/yr (R2 storage + domain)                  │
└────────────────────┬───────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────┐
│                  Supabase (free → $25/mo)           │
│  Auth: Phone OTP (built-in)                         │
│  Database: Postgres                                 │
│  Storage: Cover images                              │
│                                                     │
│  Cost: $0/mo (free tier) → $25/mo (pro, >50K users) │
└────────────────────┬───────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────┐
│               RunPod A5000 (24GB VRAM)               │
│  UE5: Blueprint dev + MRQ rendering                 │
│  Ollama: Llama 3 8B (scene parsing)                 │
│  ComfyUI: SDXL (image generation)                    │
│                                                     │
│  Dev: spot $0.19/hr × 100 hrs = $19/mo              │
│  Prod: on-demand $0.29/hr × 180 hrs = $52/mo        │
│  Cost: ~$426/yr total GPU                            │
└────────────────────────────────────────────────────┘

            Total: ~$650/year
```

This is $4,350/yr cheaper than the current Paperspace plan and $5,300/yr cheaper than AWS.
