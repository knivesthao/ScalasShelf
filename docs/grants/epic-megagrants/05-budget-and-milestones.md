# 5. Budget & Milestones

## Budget Request

**Total Requested: $41,671 — Duration: 12 months**

| Category | Item | Detail | Cost |
|----------|------|--------|-----:|
| **Personnel** | AI Developer (1 FTE, 3 months) | Unreal Engine 5 Blueprint scripting, AI pipeline integration, full-stack web development, mobile packaging. Intensive 3-month sprint to build the core pipeline. $2,000/month. | $6,000 |
| | Operations Manager (1 FTE, 12 months) | Creator recruitment and outreach, school partnerships, marketing, payment integration, content operations. $1,000/month. | $12,000 |
| | QA / Content Writers + External Art (part-time, 3 months) | QA testing, content writing, and commissioning Lao artists for the launch library | $6,000 |
| **Equipment** | Development & testing devices | Dev machines, low-end Android testing devices, content creation tools (one-time) | $3,000 |
| **Infrastructure** | RunPod GPU (3 mo development, spot) | A5000 (24GB VRAM) at $0.19/hr spot, ~100 hrs/month × 3 months. Self-hosted Llama 3 + SDXL run on the same GPU during idle time. | $57 |
| | RunPod GPU (9 mo hosting, on-demand) | ~10 hrs/month × 9 months at $0.29/hr. Only runs when creators generate new content. | $26 |
| | Web Hosting + CDN + Domain | Cloudflare Pages (free), Workers (free tier), R2 storage (~$50), Supabase free tier, domain (~$10). Full year. Funded by the grant, administered by ADMAIS US. | $800 |
| **Operations** | Advertising, Events & Distribution | Social media ads targeting Lao parents/teachers (Facebook, Instagram), community events to onboard creators and users, printed materials for rural school outreach, plus distribution — educator-network coordination, rural device provisioning, and connectivity support. | $10,000 |
| **Contingency** | Contingency (10%) | Standard buffer for unforeseen technical or operational costs. 10% of direct costs ($37,883). | $3,788 |
| | **Total** | | **$41,671** |

*Note: Total = direct costs ($37,883) + 10% contingency ($3,788). Structure: 3-month development sprint (September–November 2026) + 9 months of platform operations (December 2026–August 2027).*

### Budget Notes

- **Hosting is grant-funded and administered by ADMAIS US.** As the grant recipient, ADMAIS US manages the web app hosting, CDN delivery, and cloud orchestration using grant funds. The RunPod GPU lines are ephemeral — instances spin up only when a creator is editing or publishing, so no GPU runs idle.
- **Personnel costs reflect local rates.** Roles are valued at Lao market rates ($1,000–2,000/month), not US rates. This is intentional and sustainable — our Laos office operates full-time on a local cost structure that this grant can significantly extend.
- **AI API costs are near-zero because inference is self-hosted.** Llama 3 (scene parsing) and Stable Diffusion (image generation) run on the same GPU during idle time, eliminating external API costs. The LLM call is narrow — it generates JSON scene structures, not prose (~500 tokens per call).
- **Content creation fees go to Lao creators.** The initial library of 40 titles serves as both the launch catalog and the proof-of-concept for the creator economy model. Creators are paid a flat fee per title.
- **Distribution is a first-class cost.** Getting content to rural readers requires more than an app — it needs on-the-ground coordination with the educator network, device provisioning for low-income schools, and support for intermittent connectivity. This is reflected in the Advertising, Events & Distribution line.
- **Contingency is a standard 10% buffer.** Epic prefers to see realistic budgets with contingency rather than bare-bones requests that bust immediately.

### If Award Is Lower

| Award | Scope |
|-------|-------|
| **$25,000–$40,000** | Core UE + AI pipeline functional, reduced content library (20 titles), reduced advertising/distribution, shorter Operations Manager contract |
| **$10,000–$25,000** | Minimum viable pipeline: UE renders AI-generated comic strips from text, sample content only. Digital library and mobile features deferred. |

---

## Milestone Plan & Timeline

**Period:** September 2026 — August 2027 (12 months: 3-month build + 9-month operations, aligned with Epic Cycle 2 notice period)

### Phase Breakdown

```
M1      │  M2-3   │  M4-5   │  M6     │  M7-M12
────────┼─────────┼─────────┼─────────┼───────────────
Found-  │  Core   │  Creat- │  Launch │  Operations &
ation   │  UE +   │  or App │  +      │  Growth
        │  AI     │  +      │  Hand-  │  (schools,
        │  Pipe-  │  Mobile │  off    │  creators,
        │  line   │         │         │  marketing)
```

| Phase | Months | Deliverables | Team |
|-------|--------|-------------|------|
| **1. Foundation** | 1 (Sep) | UE5 headless instance provisioned, Pixel Streaming server deployed, ADMAIS cloud infra set up, Stable Diffusion + ControlNet on GPU, LLM API integration started, GitHub project board operational | Laos dev lead + Laos ops lead (kickoff planning) |
| **2. Core UE Pipeline** | 2 (Oct-Nov) | Level Blueprint orchestrator functional, base mesh library (~50 assets) created, comic post-process shader v1, MRQ export automated for image sequences, first test scene renders successfully from Blueprint trigger | Laos dev lead (full-time) |
| **3. AI Integration** | 3 (Nov-Dec) | LLM → JSON scene struct pipeline functional, character consistency system (IP-Adapter) working, image-to-mesh material workflow complete, TTS integration renders first narration audio, end-to-end pipeline test: text prompt → rendered output | Laos dev lead + AI engineer |
| **4. Creator Web App + Mobile** | 4 (Dec-Jan) | React SPA built with Pixel Streaming client, create/publish flow UI complete, PWA Service Worker with offline caching, chunked download system, QR payment interop (BCEL One sandbox), 5 Lao creators onboarded for alpha testing | Laos dev lead + Laos community manager |
| **5. Content Library + Field Testing** | 5 (Jan-Feb) | 30 comics + 10 interactive books commissioned from Lao creators, 3 rural school testing sessions (readability, comprehension, engagement), Lao-language narration QA, device compatibility testing on 10 low-end Android models, iteration based on field feedback | Laos ops lead + community manager + creators |
| **6. Launch + Handoff** | 6 (Feb) | Digital library opens (100 beta users via Lao phone number), published titles available for download, ADMAIS operations team trained to run platform independently, post-grant sustainability plan activated (creator subscriptions), final report and open-source documentation published | All hands |
| **7. Operations & Growth** | 7-12 (Mar-Aug) | Creator subscriptions onboarding, school partnership expansion through educator network, advertising campaigns (Facebook/Instagram), QR payment operations, library grows toward 200 titles, platform fully operated by ADMAIS | Laos ops lead + community manager + ADMAIS US oversight |

### Key Milestones

| Milestone | Target Date | Success Criterion |
|-----------|-------------|-------------------|
| M1: First UE-rendered comic strip from AI input | Oct 31 | A creator writes a 4-panel story → AI generates consistent characters → UE renders publishable output |
| M2: End-to-end pipeline demo | Dec 15 | Full flow works: narration → LLM → image gen → UE assembly → MRQ render → chunked package stored on CDN |
| M3: Creator tool live with alpha users | Jan 15 | 5 Lao creators have published at least 1 title each through the web creator |
| M4: Field test complete | Feb 15 | 3 rural schools report: content downloaded offline, children engaged, comprehension scores measured (baseline vs. post-reading) |
| M5: Public launch | Feb 28 | 100 beta users, 40+ titles in library, platform handed to ADMAIS operations team |

### Post-Grant Trajectory (Not Funded by Epic)

```
Q3 2027 │ Native mobile apps (iOS/Android/Chinese stores)
        │ Creator subscription tiers live
        │ Self-sustaining via creator subscriptions + institutional sales
        │ Consumer access remains free
        │
Q4 2027 │ ISIF Asia grant application (if applicable)
        │ Expansion to Cambodia (Khmer language content)
        │ 500+ active users, 200+ titles
```
