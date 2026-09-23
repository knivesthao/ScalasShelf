# Epic MegaGrants — Application

> Use this to fill out the Epic MegaGrants portal form at https://www.unrealengine.com/megagrants.
> All fields marked `*` are required. Character limits noted where applicable.

---

## *How did you hear about us?

Researching Unreal Engine applications in educational technology and international development. The MegaGrants program came up as the most aligned funding mechanism for projects that push real-time 3D into new, socially impactful domains.

---

## Project media link
> YouTube, GDrive, Dropbox, Vimeo, etc.

No project media exists yet — we are applying at the concept stage. This grant will fund the prototype that generates our first demo reel.

---

## Project build link
> github?

No public build yet. The repository will be created as the first deliverable in Month 1 of the grant period. We will host at github.com/admais/textweaver.

---

## Project website
> subpage of admais.xyz

https://admais.xyz/textweaver *(to be created — currently redirects to ADMAIS homepage)*

---

## *What phase is your project in?

**Concept.** No prototype exists yet. This MegaGrant funds the prototype build from the ground up.

---

## *Is your project currently in Unreal Engine or Unreal Editor for Fortnite?

**Unreal Engine 5** — not Unreal Editor for Fortnite (UEFN).

UEFN is a specialized version of UE for building and publishing content exclusively within the Fortnite ecosystem. Textweaver is building a standalone web and mobile platform — a creator tool that generates downloadable comics and interactive books distributed through our own digital library, not through Fortnite. UEFN does not support Pixel Streaming for web-based creator tools, does not allow headless rendering, and does not export content outside the Fortnite platform. We need the full Unreal Engine 5 for its Blueprint scripting, Movie Render Queue, Sequencer for animation, and mobile packaging pipeline.

---

## *Is your project open source and/or does it give back to the 3D community?

Yes — in three ways:

**1. Open-sourcing the UE pipeline automation.** We will open-source our Blueprint systems and pipeline scripts that drive automated scene assembly. The core innovation — a Blueprint orchestrator that reads structured scene data, spawns AI-generated assets into 3D environments, applies lighting and camera configurations, and renders via Movie Render Queue without human intervention — is a novel UE workflow. We will publish this as a UE plugin template on GitHub under an MIT license, with documentation and example scenes.

**2. Creating jobs and a digital media ecosystem in Southeast Asia.** We will train creators and content writers in Laos and the region on Unreal Engine — giving them globally marketable skills. Southeast Asia is home to millions of gamers already familiar with the UE visual style through popular titles. Our platform bridges that visual familiarity into education. By the end of this grant, we expect to have trained at least 10 creators on Unreal Engine fundamentals.

**3. Publishing free UE learning materials.** We will publish tutorials and documentation in Lao, English, and Thai covering UE content creation, Blueprint scripting, and AI/UE pipeline integration — lowering the barrier for entry-level creators in non-English-speaking markets.

---

## *Project elevator pitch (max 225 chars)

An AI-powered platform using Unreal Engine 5 to generate comics and interactive children's books for Lao and English learners — turning narration into 3D-rendered stories for underserved mobile readers across Southeast Asia.

---

## *Full project details

### The Problem

Laos faces an acute literacy crisis. A landlocked country of 7.5 million, only 23% of rural children achieve minimum reading proficiency by Grade 5. The average Lao child accesses fewer than one book per year outside of textbooks. Physical books are expensive to import and near-impossible to distribute to rural villages. Meanwhile, mobile phones reach over 80% of the population. The digital infrastructure exists — the content does not.

This pattern repeats across the region. Thailand's rural provinces face similar access gaps. English language learning — a gateway to economic opportunity across ASEAN — is bottlenecked by the same content shortage. Traditional publishing cannot close this gap. And even if it could, there simply aren't enough illustrators, writers, or publishers producing children's content in these languages.

### The Solution

We are building Textweaver (Textweaver): a web-based content creation platform where Unreal Engine 5 serves as a literacy engine. A creator writes a story scene by scene in Lao, English, or Thai. AI reads the narration and extracts what each scene needs — characters, settings, lighting, camera angles — as structured data. AI image generation produces consistent character sprites and backgrounds. Unreal Engine assembles everything into fully rendered 3D scenes with dynamic lighting and cinematic presentation. The output is a lightweight, downloadable comic or interactive children's book that a student can read on a $50 Android phone, offline, in pieces small enough to download over a 2G connection.

The visual style of UE-rendered content gives us a powerful advantage: tens of millions of people across Southeast Asia already play games built with Unreal Engine. They know and trust this visual language. A child who has spent hours in UE-rendered worlds immediately recognizes and engages with educational content rendered through the same pipeline. We are meeting learners where their visual expectations already are.

Textweaver has four stages:

**Stage 1 — Creator Interface:** A web editor where creators write narratives. AI reads the story text (Lao, English, Thai) and automatically generates scene descriptions — what's happening, who's there, what the mood and lighting should be.

**Stage 2 — AI Scene Generation:** The scene descriptions drive AI image generation (Stable Diffusion with character consistency) to produce character sprites and background textures. A creator-approved reference sheet ensures a character on page 1 looks the same on page 20.

**Stage 3 — UE Scene Assembly:** Unreal Engine 5 reads the scene data and runs a fully automated Blueprint pipeline. It places AI-generated textures onto 3D character models and environments, configures dynamic lighting from scene parameters, positions cameras, applies a custom comic-style post-process shader, and renders final output via Movie Render Queue. For interactive books, Sequencer adds camera animation and character movement.

**Stage 4 — Distribution:** Rendered content is packaged in small per-scene chunks — a full 20-page comic targets under 5MB. Users download scene by scene. The mobile reader works offline after download. Authentication uses phone numbers (no email required). Payment integrates with local mobile money systems.

### Why This Matters for Epic

This project stretches Unreal Engine into territory it has never occupied: serving underserved readers through AI-assisted, real-time 3D content creation. It proves UE's versatility, opens a new adoption category (educational content creation for developing economies), showcases UE + AI integration as a product rather than a demo, and creates a replicable model across Southeast Asia. There is no direct competitor at this intersection — adjacent players either distribute static content, generate flat 2D images, or publish physical books — making Textweaver a first-mover in an unclaimed niche. This is the bold, lateral use of UE that MegaGrants was created to champion.

### The Next Step

The next step is to prove the core loop end-to-end. We will provision a RunPod A5000 GPU (24GB VRAM), install Unreal Engine 5 in headless mode, and deploy the self-hosted AI stack (Llama 3 for narration parsing, Stable Diffusion XL for image generation). Then we build the Blueprint orchestrator — the master script that reads structured scene data, spawns AI-generated assets, configures lighting and cameras, applies the comic post-process shader, and renders via Movie Render Queue. The first milestone is a single working proof: a creator writes a four-panel story, and the pipeline produces a UE-rendered comic strip. That prototype is the foundation for everything that follows.

---

## *Please tell us about some of the unique features of your project.

1. **AI-powered UE scene assembly pipeline.** An LLM converts freeform narration (Lao, English, Thai) into structured scene data. AI image generation produces consistent character art. A UE5 Blueprint orchestrator reads the scene data, spawns AI-generated assets into 3D environments, configures dynamic lighting, applies a custom comic-style post-process shader, and renders via Movie Render Queue — all automated. This turns UE into a programmable content factory.

2. **Consistent characters across entire stories.** AI-generated characters maintain visual identity across all scenes using reference sheets and generation constraints. A character on page 1 looks the same on page 20 — the hardest problem in AI visual storytelling, solved through UE's material system.

3. **UE-native visual style meets an existing audience.** Millions across Southeast Asia know the UE visual language through games. Learners engage with educational content that looks like the games they already love — reducing the adoption barrier by leveraging visual familiarity.

4. **Offline-first mobile distribution.** Content packaged in per-scene chunks under 500KB — users download scene by scene over unstable connections. Works on a $50 Android phone with no internet after download.

5. **Free for readers, sustainable through creators and institutions.** The library is free for end users — we never charge a child to read. Sustainability comes from creator subscriptions and institutional/donor-funded access. The library grows organically as creators publish.

6. **No direct competitor — an unoccupied niche.** Global digital education platforms (Khan Academy, Kolibri, Rumie, Worldreader) distribute static, pre-existing content; AI storytelling tools (Storybird, Comicai, AI Comic Factory) are English-only, flat 2D, and online-only; and Lao print publishers (Big Brother Mouse, Room to Read) lack any digital distribution network. No one combines an automated Unreal Engine 3D pipeline, offline-first lightweight downloads, a Lao-language interface, and local mobile money integration — the exact combination Textweaver delivers.

---

## *What funding range are you requesting for this project? (US Dollars)

**$25,000–$50,000**

We are requesting exactly $41,671 for a focused 3-month development sprint followed by 9 months of platform operations — 12 months total. The development phase is compressed to deliver the core UE5 + AI pipeline rapidly, while the Operations Manager continues for the full year to run the platform, recruit creators, and manage content delivery.

All development runs on a RunPod A5000 GPU ($0.19/hr spot for dev, $0.29/hr on-demand for occasional creator rendering) — we have no local machine capable of UE5. AI inference (Llama 3 for scene parsing + Stable Diffusion for image generation) runs on the same GPU during idle time, eliminating external API costs.

| Category | Estimated | Detail |
|----------|-----------|--------|
| Personnel — AI Developer (1 FTE, 3 mo) | $6,000 | Unreal Engine 5 Blueprint scripting, AI pipeline integration, full-stack web development, mobile packaging. Intensive 3-month sprint to build the core pipeline. $2,000/month. |
| Personnel — Operations Manager (1 FTE, 12 mo) | $12,000 | Full-year role. Creator recruitment and outreach, school partnerships, marketing, payment integration, content operations. $1,000/month. |
| Personnel — QA / Content Writers + External Art (part-time, 2 people + contracts, 3 mo) | $6,000 | QA testing, content writing, AND commissioning external Lao artists for illustrations. Covers both in-house writing work and paid commissions for the launch library. |
| Equipment | $3,000 | Development and testing devices, content creation tools (one-time) |
| RunPod GPU (3 mo development, spot) | $57 | RunPod A5000 (24GB VRAM) at $0.19/hr spot pricing, ~100 hours/month × 3 months. Self-hosted Llama 3 + Stable Diffusion run on the same GPU during idle time. |
| RunPod GPU (9 mo hosting, on-demand) | $26 | Light usage during hosting phase — ~10 hours/month × 9 months at $0.29/hr. Only runs when creators generate new content. |
| Web Hosting + CDN + Domain | $800 | Cloudflare Pages (free), Workers (free tier), R2 storage (~$50), Supabase free tier, domain (~$10). Full year. Funded by the grant, administered by ADMAIS US. |
| Advertising, Events & Distribution | $10,000 | Social media ads targeting Lao parents/teachers (Facebook, Instagram), community events to onboard creators and users, printed materials for rural school outreach, plus distribution — educator-network coordination, rural device provisioning, and connectivity support. |
| Contingency (10%) | $3,788 | Standard buffer for unforeseen technical or operational costs. 10% of direct costs ($37,883). |
| **Total** | **$41,671** | Direct costs ($37,883) + 10% contingency ($3,788) |

**Note on items not shown:**
- PWA mobile client development → part of AI Developer's scope (in salary)
- Device testing → developer's local machine + Android emulators (no separate cost)
- Training and workshops → part of Operations Manager's role (in salary)

**If award is lower:**

| Award | Scope |
|-------|-------|
| $25,000–$40,000 | Core UE + AI pipeline functional, Lao-only, reduced content library, reduced advertising/distribution, shorter manager contract |
| $10,000–$25,000 | Minimum viable pipeline: UE renders AI-generated comic strips from text, sample content only |

---

## *How do you plan to use the funds for the project?

The $41,671 funds a 12-month plan: a 3-month development sprint (September–November 2026) followed by 9 months of platform operations (December 2026–August 2027). At a high level, the funds are allocated as:

**Personnel — $24,000**
- **Hiring an AI/UE Developer** for 3 months ($6,000) — Unreal Engine 5 Blueprint scripting, the AI pipeline, and the creator web app.
- **Hiring an Operations Manager** for 12 months ($12,000) — creator recruitment, school partnerships, marketing, and payment operations.
- **QA, content writers, and commissioned Lao artists** for 3 months ($6,000) — testing the pipeline and producing the launch library.

**Equipment — $3,000**
- Development and testing devices, including low-end Android phones for field testing.

**Infrastructure — $883**
- RunPod A5000 cloud GPU ($83) — spot pricing for development, on-demand for rendering.
- Web hosting, CDN, and domain ($800) — Cloudflare and Supabase, administered by ADMAIS US.

**Operations — $10,000**
- Advertising, community events, and distribution ($10,000) — social ads, events, printed materials, and educator-network distribution into schools.

**Contingency — $3,788**
- A 10% buffer for unforeseen technical or operational costs.

**How the work unfolds:**

- **Month 1** — Set up the cloud GPU and UE5 environment, deploy the self-hosted AI models, and build the automated Blueprint pipeline that turns a text prompt into a rendered comic strip.
- **Month 2** — Build the web-based creator tool and onboard 5 Lao creators for alpha testing.
- **Month 3** — Produce the initial library (30+ comics, 10+ interactive books) and launch with 100 beta users.
- **Months 4–12** — Operate and grow: recruit creators, expand school partnerships, run advertising, and process payments.

**Covered within the salaries above:** PWA/mobile development (part of the AI/UE Developer's scope), device testing, and creator training/workshops (part of the Operations Manager's role).

---

## Have you secured additional funding for this project?

**No.** This MegaGrant will be the sole funding source for the prototype build. The grant recipient will be **ADMAIS (US)** — the entity applying for and administering the award, including hosting, which is funded by the grant. **ADMAIS (Laos)** performs most of the development work, operating on the ground alongside a network of Lao educators (non-profits, English learning centers, teachers, and education administrators) who drive distribution and classroom adoption. Post-launch, consumer access remains free, with sustainability coming from creator subscriptions and institutional/donor-funded access.
