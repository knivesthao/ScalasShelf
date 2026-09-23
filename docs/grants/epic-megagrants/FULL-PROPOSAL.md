# Textweaver (Textweaver) — Epic MegaGrants Proposal

**Total request:** $41,671 · **Duration:** 12 months (September 2026 – August 2027)
**Grant recipient:** ADMAIS (US) — applicant and award administrator
**Development:** ADMAIS (Laos) — most development work, with a network of Lao educators for distribution

---

## Elevator Pitch

An AI-powered platform using Unreal Engine 5 to generate comics and interactive children's books for Lao and English learners — turning narration into 3D-rendered stories for underserved mobile readers across Southeast Asia.

---

## 1. The Problem

**There is a country of 7.5 million people where books are a luxury.**

Laos — landlocked, mountainous, one of Southeast Asia's poorest economies — faces a literacy crisis that has nothing to do with intelligence or willingness to learn. It is a crisis of access. Only 23% of rural children achieve minimum reading proficiency by Grade 5, and the average Lao child accesses fewer than one book per year outside of textbooks. Physical books are expensive to import, nearly impossible to distribute to rural villages, and rarely available in Lao, let alone in English. A third of households are reducing spending on education. The national currency has lost more than half its value against the dollar since 2020. The average Lao family cannot afford to buy their children a single storybook.

Meanwhile, mobile phones are everywhere. Even in remote villages without reliable electricity, people charge phones at community solar stations. Mobile data reaches over 80% of the population. The infrastructure for a digital solution exists. What doesn't exist is the content.

**This is the broken equation we are solving:** Laos has the devices and the demand. It does not have the books. Traditional publishing cannot close this gap — printing, shipping, and distributing paper books across Laos's rugged terrain is economically impossible at scale. Digital publishing should be the answer, but the content creation pipeline is empty. There are not enough illustrators, not enough writers, not enough publishers producing Lao-language children's content. And even if there were, nobody has built a digital distribution system that works when users have intermittent 2G/3G connections and pay for data by the megabyte.

**Enter Unreal Engine — not as a game engine, but as a literacy engine.**

We are building a web-based content creation platform where the heavy lifting of visual storytelling is done by AI, orchestrated through Unreal Engine's real-time 3D pipeline. A creator writes a story in Lao or English — scene by scene, strip by strip. The platform reads their narration and generates the imagery: characters, backgrounds, animations. The output is a lightweight, downloadable comic or interactive children's book that a rural student can read on a $50 Android phone, offline, in pieces small enough to download over an unstable connection.

This is not a content consumer app. **This is a content factory.** We provide the tools for Lao teachers, artists, and entrepreneurs to become publishers. They write. The AI draws. Unreal Engine renders. The digital library delivers. And a generation of Lao children — who have never owned a book — start reading.

---

## 2. The Solution — Four Stages

The visual style of UE-rendered content gives us a powerful advantage: tens of millions of people across Southeast Asia already play games built with Unreal Engine. They know and trust this visual language. A child who has spent hours in UE-rendered worlds immediately recognizes and engages with educational content rendered through the same pipeline. We are meeting learners where their visual expectations already are.

**Stage 1 — Creator Interface:** A web editor where creators write narratives. AI reads the story text (Lao, English, Thai) and automatically generates scene descriptions — what's happening, who's there, what the mood and lighting should be.

**Stage 2 — AI Scene Generation:** The scene descriptions drive AI image generation (Stable Diffusion with character consistency) to produce character sprites and background textures. A creator-approved reference sheet ensures a character on page 1 looks the same on page 20.

**Stage 3 — UE Scene Assembly:** Unreal Engine 5 reads the scene data and runs a fully automated Blueprint pipeline. It places AI-generated textures onto 3D character models and environments, configures dynamic lighting from scene parameters, positions cameras, applies a custom comic-style post-process shader, and renders final output via Movie Render Queue. For interactive books, Sequencer adds camera animation and character movement.

**Stage 4 — Distribution:** Rendered content is packaged in small per-scene chunks — a full 20-page comic targets under 5MB. Users download scene by scene. The mobile reader works offline after download. Authentication uses phone numbers (no email required). Payment integrates with local mobile money systems.

---

## 3. Why Unreal Engine? Why Not Just WebGL?

Because we are not building a simple image generator — we are building an animation pipeline that ultimately produces **real-time interactive 3D books.** Each scene in an Textweaver children's book is not a flat image; it's a UE-rendered 3D environment with animated characters, dynamic lighting, and parallax depth. A child taps a character and it moves. The scene breathes.

Unreal Engine gives us:
- **Blueprint-driven scene assembly** — AI-generated assets are composed into 3D environments programmatically via UE Blueprints
- **Real-time rendering at mobile scale** — UE's rendering pipeline produces content optimized for low-end Android/iOS devices
- **Sequencer for animation** — short animation clips are authored via Sequencer and baked into lightweight video segments
- **Pixel Streaming for the web creator tool** — creators use the UE-powered editor through a web browser without installing UE locally
- **A path to immersive experiences** — today comics and interactive books, tomorrow VR classrooms and spatial storytelling

And critically: **Epic MegaGrants exists to fund exactly this kind of lateral thinking with UE.**

This project stretches Unreal Engine into territory it has never occupied: serving the world's most underserved readers through AI-assisted, real-time 3D content creation. It demonstrates that UE is not just a game engine — it is a tool for solving fundamental human development problems: literacy, education access, and economic opportunity for creators in developing markets.

For Epic, this is a story no other engine can tell:
- **Proves UE's versatility** — from Fortnite experiences to farming literacy in rural Laos
- **Opens a new adoption category** — educational content creation for developing economies
- **Showcases UE + AI integration** — Blueprint-driven, AI-assisted scene generation as a product, not a demo
- **Creates a replicable model** — if this works in Laos, it works in Cambodia, Myanmar, Nepal, and across the Global South
- **A genuinely bold, creative vision** — the kind Epic's MegaGrants program was created to champion

---

## 4. Technical Architecture

Textweaver is a pipeline of four orchestrated stages, each leveraging a specific UE capability that no alternative engine or WebGL approach could replicate.

### Stage 1: Creator Interface — Pixel Streaming

A Lao creator logs into the Textweaver web app through a standard browser — no UE installation, no GPU requirement. The editor UI is a React single-page application that receives a Pixel Streaming video feed from a headless UE5 instance running on a cloud GPU.

**Why Pixel Streaming instead of a custom web renderer:**
- The creator needs real-time preview of 3D scenes as they are assembled — exactly what Pixel Streaming was built for
- The UE Pixel Streaming plugin handles WebRTC negotiation, input forwarding, and adaptive quality automatically
- Creators in Laos access the same editor as creators anywhere else — zero local hardware dependency
- GPU instances can be spun up on demand, keeping infrastructure costs tied to actual usage

The streaming session is ephemeral. When a creator finishes a book and publishes, the UE instance renders the final output, packages it, and terminates. No GPU runs idle.

### Stage 2: AI Content Generation Layer

The creator provides narration in plain text, scene by scene, in Lao or English. A self-hosted LLM (Llama 3 via Ollama — sharing the same GPU as rendering, so inference costs near zero) outputs structured scene JSON — never the images themselves. This separation keeps the LLM call cheap and deterministic.

Background elements, character sprites, and props are generated via Stable Diffusion. Character consistency across scenes is maintained by:
- Generating a **reference character sheet** once per character — the creator approves it
- Using **IP-Adapter + ControlNet** to constrain subsequent generations to the established design
- Storing assets in UE-compatible formats (PNG textures, EXR for HDR lighting)

### Stage 3: UE Scene Assembly Engine

A headless UE5 process receives structured scene JSON and executes a fully automated Blueprint pipeline:

1. **Level Blueprint Orchestrator** loads a pre-built "empty stage" level and reads the scene JSON
2. **Asset Spawning** loads AI textures onto a library of ~50 base meshes via `Set Material` and `Create Dynamic Material Instance`
3. **Lighting** maps JSON parameters to `DirectionalLight`, `SkyLight`, and `ExponentialHeightFog`
4. **Camera Setup** positions the `CineCameraActor`; interactive books add Sequencer keyframes for camera drift and character movement
5. **Post-Process Comic Shader** applies edge detection, cel-shaded color quantization, and halftone patterns for a consistent illustrated/comic-book aesthetic
6. **Render** via **Movie Render Queue** (MRQ), UE's high-quality offline render pipeline
7. **Batch Processing** driven by a Python script via Remote Control API — no human clicks "render"

### Stage 4: Content Packaging & Distribution

- Images compressed to aggressively optimized PNG/WebP — a full 20-page comic targets under 5MB
- Interactive books packaged **per scene** so a user on unstable 2G can download scene 1 first and read while scene 2 queues
- Video segments transcoded to H.264 baseline at 360p — playable on Android devices from 2015 onward
- A REST API serves content metadata; authentication uses Lao phone numbers; QR payment bridges the Lao mobile money ecosystem
- A Progressive Web App (PWA) with Service Worker caching and IndexedDB provides offline reading

### Technology Stack Summary

| Layer | Technology |
|-------|-----------|
| Creator UI | React + WebRTC (Pixel Streaming client) |
| UE Runtime | Unreal Engine 5.4+ (headless) |
| AI — Text | Llama 3 (self-hosted via Ollama) |
| AI — Image | Stable Diffusion XL + IP-Adapter + ControlNet (self-hosted via ComfyUI) |
| AI — Voice | ElevenLabs / Coqui TTS (Lao + English) |
| Cloud GPU | RunPod A5000 (24GB VRAM) |
| Rendering | UE Movie Render Queue |
| CDN / Storage | Cloudflare (R2, Workers, Pages) + Supabase |
| Mobile Client | PWA (Service Worker + IndexedDB) initially; UE mobile build for native |

---

## 5. Unique Features

1. **AI-powered UE scene assembly pipeline.** An LLM converts freeform narration into structured scene data. AI image generation produces consistent character art. A UE5 Blueprint orchestrator renders via Movie Render Queue — all automated, turning UE into a programmable content factory.

2. **Consistent characters across entire stories.** Characters maintain visual identity across all scenes using reference sheets and generation constraints — the hardest problem in AI visual storytelling, solved through UE's material system.

3. **UE-native visual style meets an existing audience.** Millions across Southeast Asia know the UE visual language through games. Learners engage with content that looks like the games they already love.

4. **Offline-first mobile distribution.** Content packaged in per-scene chunks under 500KB — works on a $50 Android phone with no internet after download.

5. **Free for readers, sustainable through creators and institutions.** The library is free for end users — we never charge a child to read. Sustainability comes from creator subscriptions and institutional/donor-funded access.

---

## 6. Open Source & Community Giveback

1. **Open-sourcing the UE pipeline automation.** We will publish our Blueprint systems and pipeline scripts as a UE plugin template on GitHub under an MIT license, with documentation and example scenes.

2. **Creating jobs and a digital media ecosystem in Southeast Asia.** We will train at least 10 creators in Laos on Unreal Engine fundamentals, giving them globally marketable skills.

3. **Publishing free UE learning materials.** Tutorials and documentation in Lao, English, and Thai covering UE content creation and AI/UE pipeline integration.

---

## 7. Team

Textweaver is built by **ADMAIS** — two coordinated companies spanning both sides of the project — together with a network of **Lao educators** who carry the platform into classrooms.

| Partner | Location | Role |
|---------|----------|------|
| **ADMAIS (US)** | United States | Grant application, technology hosting, cloud infrastructure, strategic oversight |
| **ADMAIS (Laos)** | Vientiane, Laos | Most of the development work — building the platform with a Lao team |
| **Educator Network** | Laos (nationwide) | Distribution, content guidance, and classroom adoption |

Most international development technology projects fail because the team building the technology has never spent a week in the community they are building for. We do not have this problem. Our development is done in Laos, by Lao developers, in the same market the product serves. When we design the download chunk size for a comic book, we know exactly what a 2G connection feels like in Luang Namtha during rainy season — because the team building it has tested it there.

**ADMAIS (US)** applies for the grant, administers the award, and manages hosting and cloud infrastructure (funded through the grant). **ADMAIS (Laos)** carries most development and brings on-the-ground expertise in the Lao telecom ecosystem, QR payment systems (BCEL One, LDB Mobile Banking), and education infrastructure. The **Educator Network** — non-profit education organizations, English learning centers, teachers, and education administrators — drives distribution and classroom adoption, validates content, and runs pilots.

---

## 8. Competitive Landscape & Target Impact

Textweaver does not exist in a vacuum. An honest accounting of who else is working in this space:

**1. AI Content Generation Platforms** (Midjourney, DALL-E, Stable Diffusion, Runway) — spectacular tools for individual images, but not storytelling platforms. They solve the pixel, not the story.

**2. AI Storytelling & Comic Generators** (AI Comic Factory, Storybird, Neural Canvas, Comicai) — English-only, flat 2D images, online-only, no Lao language, no offline mode, no educator tools.

**3. Educational Platforms for Developing Markets** (Khan Academy, Kolibri, Rumie, Worldreader) — deliver curriculum or distribute existing books, but none build a content creation pipeline that lets local communities generate their own materials. Nobody is making the books.

**4. Children's Publishing in Laos** (Big Brother Mouse, Room to Read) — allies, not competitors. Textweaver digitizes their model at 100x scale with zero printing cost, and provides the digital distribution layer they lack.

**Textweaver's Structural Moat — Four Things Nobody Else Combines:**
1. UE-powered 3D scene rendering with Pixel Streaming
2. AI pipeline for end-to-end visual storytelling with consistent characters
3. Offline-capable mobile distribution (chunked, under 5MB, 2G-capable)
4. Lao-first user experience (Lao UI, phone auth, QR payments)

**Target Impact:**
- **Year 1:** 100+ educational comics/books created, 10,000+ Lao users reached
- **Year 2:** Platform opens to third-party creators with subscription tiers
- **Year 3:** Scaled across Southeast Asia

---

## 9. Budget

**Total Requested: $41,671 — Duration: 12 months**

| Category | Item | Detail | Cost |
|----------|------|--------|-----:|
| **Personnel** | AI Developer (1 FTE, 3 months) | UE5 Blueprint scripting, AI pipeline, full-stack web, mobile packaging. $2,000/month. | $6,000 |
| | Operations Manager (1 FTE, 12 months) | Creator recruitment, school partnerships, marketing, payment integration. $1,000/month. | $12,000 |
| | QA / Content Writers + External Art (part-time, 3 months) | QA testing, content writing, commissioning Lao artists | $6,000 |
| **Equipment** | Development & testing devices | Dev machines, low-end Android test devices (one-time) | $3,000 |
| **Infrastructure** | RunPod GPU (3 mo development, spot) | A5000 (24GB) at $0.19/hr, ~100 hrs/month × 3 months | $57 |
| | RunPod GPU (9 mo hosting, on-demand) | ~10 hrs/month × 9 months at $0.29/hr | $26 |
| | Web Hosting + CDN + Domain | Cloudflare Pages/Workers/R2, Supabase, domain. Full year. | $800 |
| **Operations** | Advertising, Events & Distribution | Social ads, community events, printed materials, plus educator-network distribution, rural device provisioning, connectivity support | $10,000 |
| **Contingency** | Contingency (10%) | Standard buffer — 10% of direct costs ($37,883) | $3,788 |
| | **Total** | | **$41,671** |

**If award is lower:**

| Award | Scope |
|-------|-------|
| **$25,000–$40,000** | Core UE + AI pipeline functional, reduced content library, reduced advertising/distribution, shorter manager contract |
| **$10,000–$25,000** | Minimum viable pipeline: UE renders AI-generated comic strips from text, sample content only |

---

## 10. Milestones & Timeline

**Period:** September 2026 — August 2027 (3-month build + 9-month operations)

| Phase | Months | Deliverables |
|-------|--------|-------------|
| **1. Foundation** | 1 (Sep) | UE5 headless instance, Pixel Streaming server, SD + ControlNet on GPU, LLM integration, project board |
| **2. Core UE Pipeline** | 2 (Oct-Nov) | Blueprint orchestrator, base mesh library (~50), comic post-process shader, MRQ automation, first test render |
| **3. AI Integration** | 3 (Nov-Dec) | LLM → JSON pipeline, character consistency (IP-Adapter), TTS, end-to-end test |
| **4. Creator Web App + Mobile** | 4 (Dec-Jan) | React SPA + Pixel Streaming client, PWA offline caching, chunked download, QR payment interop, 5 alpha creators |
| **5. Content Library + Field Testing** | 5 (Jan-Feb) | 30 comics + 10 interactive books, 3 rural school tests, device testing, iteration |
| **6. Launch + Handoff** | 6 (Feb) | Library opens (100 beta users), sustainability plan activated, open-source plugin published |
| **7. Operations & Growth** | 7-12 (Mar-Aug) | Creator subscriptions, school partnerships, ad campaigns, library grows toward 200 titles |

**Key Milestones:**
- **M1 (Oct 31):** First UE-rendered comic strip from AI input
- **M2 (Dec 15):** End-to-end pipeline demo (narration → LLM → image gen → UE → MRQ → CDN)
- **M3 (Jan 15):** Creator tool live; 5 Lao creators published
- **M4 (Feb 15):** Field test complete — offline download, engagement, comprehension measured
- **M5 (Feb 28):** Public launch — 100 beta users, 40+ titles

---

## 11. Sustainability

Epic funds the spark. This section describes the fire.

**Access Model: Free for Users.** Textweaver launches free for end users — every reader, student, and family can read without paying. This is made possible by grant-funded development, grant-funded hosting (administered by ADMAIS US), and near-zero marginal delivery cost. **"Free for now" is a deliberate, honest position** — we prioritize reach in the launch window, then introduce sustainability levers that keep consumer access free.

**Long-Term Sustainability Levers (that don't tax the end user):**
- **Creator Subscription Tiers** — professional publishers pay monthly, differentiated by AI generation volume; casual creators publish free
- **Institutional & donor-funded access** — schools, NGOs, and development organizations sponsor access
- **Follow-on grants** — ISIF Asia (distribution), PCF (child-focused content), Google.org (AI/Lao language), UNESCO

**Operational Sustainability:** Textweaver is not a new organization — it's an initiative of ADMAIS, which already operates as a sustainable business. ADMAIS US generates revenue from software/AI consulting; ADMAIS Laos serves local business clients. If grant funding is delayed or reduced, ADMAIS can sustain Textweaver at a reduced burn rate.

**3-Year View:**
- **Year 1:** Grant-funded build + launch (40 titles, 100 beta users, 5 creators)
- **Year 2:** Hybrid funding (creator subscriptions + institutional sales, ISIF Asia). 500+ users, 200+ titles
- **Year 3:** Self-sustaining. Cambodia pilot. Mobile apps on iOS, Android, Chinese stores

---

## 12. Funding & Use of Funds

**Funding range requested:** $25,000–$50,000 (requesting exactly $41,671).

The $41,671 funds a 3-month development sprint (Sep–Nov 2026) followed by 9 months of operations (Dec 2026–Aug 2027):

- **Phase 1 — Core Pipeline (Month 1):** Provision GPU, set up UE5, deploy self-hosted Llama 3 + Stable Diffusion, build Blueprint orchestrator, first text→render test
- **Phase 2 — Creator Tool + Content (Month 2):** Web creator interface, Workers API gateway, 5 alpha creators
- **Phase 3 — Launch + Library (Month 3):** 30+ comics + 10+ books, digital library frontend, 100 beta users, open-source plugin published
- **Phase 4 — Operations & Growth (Months 4–12):** Creator recruitment, school partnerships, advertising, QR payment operations

**Additional funding secured:** No. This MegaGrant is the sole funding source. ADMAIS (US) administers the award and hosting (funded by the grant); ADMAIS (Laos) performs most development; a network of Lao educators drives distribution. Post-launch, consumer access remains free, with sustainability from creator subscriptions and institutional access.

---

## 13. Appendix: Data & Sources

### Literacy & Education

| Metric | Value | Source |
|--------|-------|--------|
| Adult literacy rate (male) | 78.1% | UNESCO |
| Adult literacy rate (female) | 62.9% | UNESCO |
| Primary net enrolment | 98.7% | UNICEF Lao PDR |
| Primary completion rate | 81.9% | UNICEF Lao PDR |
| 5-year-olds NOT in ECE | ~70% | UNICEF Lao PDR |
| Households reducing education spending | ~33% | World Bank survey (2025) |

**Context:** Laos has the poorest education indicators in Southeast Asia despite near-universal primary enrolment. Literacy among women is nearly 15 points lower than men, reflecting deep gender inequity in educational access.

### Economy & Connectivity

| Metric | Value | Source |
|--------|-------|--------|
| Population | 7.5 million | World Bank / UN (2023) |
| Inflation rate | ~10% | World Bank (Apr 2026) |
| Currency depreciation (kip/USD) | 9,000→21,500+ | World Bank (2020→2025) |
| Households with telephone access | 93% | Lao Social Indicator Survey (2017) |
| Population with electricity access | 93% | Lao Social Indicator Survey (2017) |

### Key Qualitative Context

- World Bank Lao Economic Monitor (June 2026): "A third of households reduced spending on food, health and education"; "Limited spending on education, health, and social protection has undermined human capital."
- UNICEF Lao PDR: "Lao PDR still has some of the poorest education indicators in Southeast Asia"; key constraint includes "the lack of teaching-learning materials."

### Sources
1. World Bank — Lao Economic Monitor (June 2026)
2. UNICEF Lao PDR — Education
3. Wikipedia — Laos (Demographics, Economy)
4. Lao Social Indicator Survey II (2017)
