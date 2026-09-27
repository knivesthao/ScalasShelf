# Textweaver MVP — Stack Decision, Build Plan & Funding

> Updated: 2026-09-24
> Answers three questions: (1) which stack for the MVP, before any move to Unreal or Unity, (2) how the scene pipeline and comic format should work, (3) which grants and funding the new premise opens up.

> **Current scope (decided 2026-09-24):** **English only, and free for every user.** Comics, word meanings, quizzes and the Studio are all in English (like a graded English reader). Lao translations and Lao-language comics come later with localization. There's no pricing or purchase flow for new content. Sections below that mention Lao ⇄ English, translation review or pricing describe that later phase. The format keeps text keyed by language (`text.en`), so adding Lao later is additive.
>
> **Prototype status (2026-09-24):** working end to end, locally. Studio (write → generate art → layout → words → quiz → publish), library, book page, reader (animated panels, tap-a-word meanings, quiz) and offline download all run on the new format and the Hono + D1 API. Supabase and the purchase flow are removed. Voice recording and narration are on hold for the MVP. See `backend-architecture.md` → Status.
>
> **Demo art (for the demo video):** scene art is stubbed. Demo mode (`/?demo=1` on localhost) serves a pre-generated art pack in `public/demo-art/` (4 backgrounds, 4 characters for "Noy and the Buffalo" and "Morning Market"), matched by scene keywords and speaker names, with plain shapes as the fallback. The pack was made with Cloudflare Workers AI's free tier (FLUX.1 Schnell) by `scripts/generate-demo-art.py`. Local generation isn't practical on the current dev Mac (2015 Intel MacBook Pro, 2 GB GPU). Workers AI is also the natural first real generation backend after the demo.

---

## TL;DR

1. **Keep what we have: React + Vite + Supabase + Cloudflare. Add a JSON "motion comic" format and a lightweight layered renderer. Wrap it in Capacitor when we go to app stores.** This is Gemini's option 1, changed in one important way: **the reader animates panels with DOM/CSS (Web Animations API) first, and PixiJS only comes in later for effects.** The reason is Lao text (see [Why not canvas-first](#why-not-canvas-first-lao-text)).
2. **Take UE5 out of the MVP's critical path.** For MVP, "the rendering engine develops the scene" means *AI generates layered art, and our pipeline turns it into an animated panel.* That output is a few hundred KB of stills plus JSON, not video.
3. **The format is the product, and it supports two editions.** Every book has a **Lite** edition (layered motion comic, ~2 MB, built by the MVP pipeline). Later it can also get an **HD** edition (high-quality/3D art from Unreal or Unity). Both share the same text, audio, vocab and quiz. The library picks the edition that suits the reader's connection, and the reader can always switch. See [Two editions](#two-editions-lite-and-hd). This is also the Epic MegaGrants story: UE produces the HD edition.
4. **It's a language-learning product first.** Comics are how we teach, not the end goal. Every episode is leveled (CEFR A1–B2), has tap-a-word meanings and human-recorded audio, and ends in a short check. English only for now; Lao comes with localization. See [Language-learning layer](#language-learning-layer). Stories are **original**, written by our team.
5. **Estimated time to MVP: ~11 weeks** on the current codebase (the learning features add ~1–2 weeks). A Flutter + Flame rewrite would take ~15–18 weeks.
6. **Funding:** the MVP is what unlocks **DIV Fund** (rolling, up to $200K). It also makes us credible for **UNICEF Venture Fund**, **GSMA Innovation Fund**, and embassy small grants (**Australia DAP, Japan GGP, Canada CFLI**). Apply for **Cloudflare for Startups** credits now. Full list in [Funding](#funding--grants).

---

## 1. The premise, restated

**Textweaver is a free language-learning app.** Lao students learn English by reading short animated comics written for their level. (Later, with localization: Lao help text, and learners of Lao learning Lao.)

The studio is how we make that content cheaply. A writer composes short English lines and describes the scene. The engine builds the scene, and the pipeline assembles panels into an **animated English comic** that learners **download once and read offline**. For now, all stories are original, written by our own team. Users are mainly in Laos and Southeast Asia, on cheap Android phones with patchy, metered data.

The constraints that decide everything:

| Constraint | What it forces |
|---|---|
| Patchy, metered mobile data | Episodes must be **small** (target ≤ 3 MB) and downloadable **in chunks** that resume |
| Low-end Android (2–3 GB RAM, older Mali/Adreno GPUs) | Light rendering: no game engine runtime and no heavy WebGL on the reader side |
| Language learners (Lao ⇄ English) | Dialogue stays as **real text** and is never baked into images, so it's toggleable, tappable and tiny. Stories are leveled, and audio models pronunciation |
| "Animated" | Motion comes from **layers + keyframes**, not video. Video costs 10–50× more bytes |
| Small team, AI-assisted development | Stay in the language and framework we already have, where AI coding tools are strongest |

---

## 2. What we already have

Existing work matters in a stack decision. Current state of the repo:

| Piece | Status | File |
|---|---|---|
| React 18 + Vite + TS PWA (library, book detail, purchase, reader, my library, admin, studio) | ✅ Built, tested | `src/pages/*` |
| Phone OTP auth | ✅ | `src/hooks/useAuth.tsx` |
| QR payment + admin confirmation | ✅ | `src/pages/Purchase.tsx`, `supabase/migrations/002_business_functions.sql` |
| Chunked, resumable per-scene download into IndexedDB | ✅ | `src/pages/Reader.tsx`, `src/lib/idb.ts` |
| PWA install prompt | ✅ | `src/components/InstallPrompt.tsx` |
| Studio on the motion-comic format (script, panel editor, audio, words, quiz, publish) | ✅ Rebuilt 2026-09-24; GPU still stubbed | `src/pages/studio/`, `src/lib/format.ts`, `src/hooks/useGenerate.ts` |
| Workers API gateway → render queue | 🟡 | `workers/api-gateway.ts` |
| Packaging: WebP compress → manifest → R2 → Supabase | 🟡 Flat images only | `gpu/package_content.py` |
| UE5 scene rendering | ⬜ Not started | — |

The library, payments and offline download (**about 70% of the non-AI product**) are already written in React. Any stack that throws this away needs a very strong reason.

---

## 3. Stack options compared

### Options

| | **A. Current stack + motion-comic format** (recommended) | **B. React + PixiJS + Capacitor** (Gemini #1 as written) | **C. Flutter + Flame** (Gemini #2) | **D. UE5 server-rendered** (current grant plan) |
|---|---|---|---|---|
| Reader renderer | DOM + CSS transforms / Web Animations; PixiJS added later for effects | PixiJS (WebGL canvas) for everything | Flame on Flutter's Skia/Impeller canvas | Pre-rendered frames or video from UE5 |
| Reuses existing code | ~100% | ~90% (reader rewritten) | ~0% (Dart rewrite); Supabase backend stays | ~100% frontend; adds UE pipeline |
| Mobile delivery | PWA now → Capacitor for Play/App Store/Chinese Android stores | Same | Native binaries | Same as A |
| Reader payload | Smallest: 0 KB extra library | +~200–450 KB PixiJS | Native app 15–25 MB; Flutter web ≈ 2 MB+ runtime | Video or frame sequences: largest by far |
| Lao text in bubbles | ✅ Browser shaping + dictionary line-breaking | ⚠️ Canvas has no line-breaking for Lao | ⚠️ Probably OK via ICU/SkParagraph; **test before committing** | Baked into frames ❌ |
| Low-end Android performance | ✅ Compositor-accelerated transforms | 🟡 Good on most devices; old WebViews/GPUs can be flaky | ✅ Very good natively | ✅ Playback is fine, downloads are heavy |
| AI coding-assist quality | ✅ Best | ✅ Very good | 🟡 Good, weaker than React | 🟡 Blueprint work is mostly manual |
| GPU cost per scene | Image gen only | Image gen only | Image gen only | Image gen + UE render time |
| **Time to MVP** | **~9–10 wks** | ~11–12 wks | ~15–18 wks | ~20–26 wks |
| Grant alignment | Neutral: UE/Unity plug in later as producers | Neutral | Neutral | ✅ Epic MegaGrants |

### Pros and cons

**A. Current stack + motion-comic format (recommended)**
- ➕ Ships fastest. Only the renderer, Studio editor, pipeline and packaging need building.
- ➕ Speech bubbles are real DOM text: Lao/English toggle, adjustable font size, screen readers, search. That's core for language learners.
- ➕ Smallest downloads. The same WebP layers work in the web reader, in Capacitor, and in any future native reader.
- ➖ CSS can't do rich effects (particles, displacement, lighting). **Mitigation:** an optional PixiJS "FX layer" behind the text, loaded lazily only for panels that use it.
- ➖ WebView apps feel slightly less native than Flutter. For a reader app that's rarely what users notice. Download size and offline reliability matter more.

**B. React + PixiJS + Capacitor (Gemini #1 as written)**
- ➕ One uniform canvas renderer, and effects are easy.
- ➖ Putting text in the canvas breaks Lao line-wrapping and loses accessibility and translation. Keeping text in DOM overlays gets you back to option A with an extra dependency.
- ➖ WebGL context loss and memory pressure on cheap phones are a real support burden.

**C. Flutter + Flame (Gemini #2)**
- ➕ Best native performance and a polished app feel. Offline storage is straightforward.
- ➖ Full rewrite of working, tested code in a new language. Throws away ~2 months of work.
- ➖ Flame is a *game loop* engine, which is overkill for panels with keyframes.
- ➖ Flutter web output is heavy, which hurts the "just open a link" web library. Laos users often discover things through Facebook/WhatsApp links.
- Worth reconsidering **only** if the Capacitor app tests poorly on real devices in Laos.

**D. UE5 server-rendered (current grant architecture)**
- ➕ Highest visual ceiling (3D scenes, lighting, camera moves). Required story for Epic MegaGrants.
- ➖ Slowest to build. RunPod UE5 headless rendering is still unverified (`gpu-costs.md` flags this).
- ➖ The output is pixels. Animation means video, and video breaks the size budget.
- **Better role:** the producer of the **HD edition** after MVP. UE (or Unity) renders from the same scene JSON the Studio already creates. Readers on good connections get richer visuals, and everyone else keeps the small Lite edition. See [Two editions](#two-editions-lite-and-hd).

### Other engines, briefly

- **Godot (web export):** 20–40 MB WASM runtime. Too heavy for our users.
- **React Native:** a rewrite with no real advantage over Capacitor for a content reader.
- **Unity (later):** a peer to UE for option D's "premium producer" role. It would unlock Unity for Humanity. Mobile builds are smaller than UE's, but the same reasoning applies: produce layers, not the runtime.

### Why not canvas-first: Lao text

Lao script has **no spaces between words**. Browsers break Lao lines correctly using a built-in dictionary (ICU) when the element has `lang="lo"`. `<canvas>` `fillText` has **no line-breaking at all**, and PixiJS word-wrap splits on spaces, so a Lao sentence either overflows the bubble or breaks mid-word. Keeping dialogue in the DOM gets this right for free, and it's what makes the Lao ⇄ English toggle possible.

### Decision

**Option A.** Build the reader and Studio on the existing React app with a format-first design. Ship as a PWA for pilots, then wrap with **Capacitor** for Google Play, the App Store and Chinese/alternative Android stores (Huawei AppGallery, Xiaomi, APK sideload). Capacitor also fixes a real offline risk: **browsers can evict IndexedDB** under storage pressure on Android. Capacitor's Filesystem storage is persistent. Until then, call `navigator.storage.persist()`.

---

## 4. MVP architecture

The three modules Gemini proposed (Hub / Reader / Studio) are right, and they map onto what we already have:

```
                ┌───────────────────────── STUDIO (creator, web) ─────────────────────────┐
 sentence +     │  1. Script panel: dialogue line + scene description                    │
 scene desc ───►│  2. "Generate" → queue job                                              │
                │  3. Panel editor: move/scale layers, place bubbles, pick motion preset │
                │  4. Publish → package                                                   │
                └──────────────┬──────────────────────────────────────────────▲──────────┘
                               │ POST /api/render                             │ layers + scene JSON
                               ▼                                              │
                Workers ─► Supabase render_queue ─► GPU worker (RunPod) ──────┘
                                                     ├─ LLM: text → scene JSON
                                                     ├─ Image model: background plate
                                                     ├─ Image model + char reference: character pose
                                                     └─ Background removal → alpha cutout
                               │ publish
                               ▼
                package_content.py v2 ─► R2 (CDN) + Supabase metadata  ◄── HUB / LIBRARY
                               │
                               ▼
                READER (PWA → Capacitor): manifest → per-scene chunks → IndexedDB/Filesystem
                               → layered DOM renderer + keyframe animation + text overlay
```

### Scene pipeline (what "the engine develops the scene" means for MVP)

1. **Parse:** the LLM turns *"Noy walks her buffalo through the rice field at sunset. 'We're late!'"* into scene JSON: setting, time of day, characters + pose + expression, camera shot, dialogue lines with speaker.
2. **Background:** the image model generates a vertical background plate (~720×1280) from setting + mood. Plates get cached and reused across panels in the same location.
3. **Characters:** each series has a **character sheet** (reference image). Poses are generated with character-reference conditioning (IP-Adapter per `ai-architecture.md`, or a newer open model with reference support). Background removal then gives alpha cutouts. **Characters reused across panels are downloaded once.**
4. **Compose:** the engine lays out the layers from the camera shot and applies a default **motion preset** chosen from the scene mood.
5. **Creator adjusts:** drag, re-roll one layer, edit the bubble text, change the preset. Everything is JSON edits, and re-renders are cheap.

This keeps the existing plan's principle: *minimum AI, self-hosted on RunPod*. Without UE, the GPU box only runs the LLM + image model, which is simpler and cheaper. If RunPod setup slows us down, a hosted image API is a fine temporary stub behind the same queue.

### What runs where: cloud vs creator's phone

All heavy work runs on a **cloud GPU instance**. The creator's phone only edits JSON and plays previews, which costs about the same as reading a comic.

| Work | Where | Why |
|---|---|---|
| LLM: text → scene JSON, draft translation, level check | ☁️ Cloud GPU (RunPod) | Needs a GPU and several GB of RAM |
| Image generation (backgrounds, character poses) | ☁️ Cloud GPU | Needs 8+ GB VRAM; impossible on a phone |
| Background removal, WebP encoding | ☁️ Cloud GPU/CPU | Heavy image processing |
| Audio cleanup + Opus encoding | ☁️ Cloud CPU | Phone just uploads the raw recording |
| Packaging (tokens, vocab, quiz draft, manifest v2) → R2 | ☁️ Cloud CPU | Runs once, at publish |
| Typing lines, reviewing translations, recording audio | 📱 Phone | Plain form input + microphone |
| Moving/scaling layers, placing bubbles, picking presets | 📱 Phone | Only changes numbers in JSON |
| Previewing a panel | 📱 Phone | Same lightweight `<MotionPanel>` as the reader |

**Keeping it light for creators on weak phones and weak connections:**
- **Low-res previews in the Studio.** The cloud returns ~360 px thumbnails while the creator edits. Full 720 px assets are only generated and stored at publish, and the creator's phone never downloads them.
- **Async jobs.** "Generate" queues a job and returns right away. The creator can lock the phone or close the app, and the result is waiting when they come back. A notification is optional.
- **Uploads stay small:** text + a compressed voice recording (~20–50 KB per line).
- **Re-rolls cost GPU time, not phone time.** Limit them per project to control cost (this becomes a subscription-tier limit later).
- **"Still preview" toggle** for very old phones: shows the composed panel without animation.

**Cloud GPU hosting:** creator usage is bursty (busy in working hours, idle at night), so use **RunPod Serverless** (scales to zero, billed per second of GPU use) for image generation and the LLM. Keep the option of an always-on pod once usage is steady enough that it's cheaper. The trade-off is cold starts: the first job after an idle period can take tens of seconds. That's acceptable because jobs are already async. Compare this against the always-on estimates in `gpu-costs.md` once we have real pilot usage.

### Motion presets (MVP set)

These give the "animated" feel for almost no bytes:

| Preset | Effect | Implementation |
|---|---|---|
| `parallax` | BG/mid/FG layers drift at different speeds on scroll/tilt | CSS transform tied to scroll position |
| `kenburns` | Slow pan/zoom across the plate | Web Animations keyframes |
| `idle` | Character breathe/bob | Small looping scale/translate |
| `blink` | 2-frame eye swap | Sprite frame toggle (two tiny layers) |
| `pop` | Bubble/SFX pop-in on panel enter | Keyframes + IntersectionObserver |
| `shake` | Impact / surprise | Keyframes |
| `weather` *(post-MVP)* | Rain, leaves, fireflies | Lazy-loaded PixiJS FX layer |

Honor `prefers-reduced-motion`, and add a data-saver "still mode" for people who get motion sickness or have very weak phones.

### The comic format (`manifest v2`)

Standardize on a JSON + assets package, similar in spirit to Electricomics as Gemini suggested. The reader never needs to know which engine made the layers.

```jsonc
// content/{id}/manifest.json
{
  "format": "textweaver.motion-comic/2",
  "id": "c_123", "title": { "lo": "ນ້ອຍ ແລະ ຄວາຍ", "en": "Noy and the Buffalo" },
  "languages": ["lo", "en"],
  "assets": {                                   // deduplicated across all scenes
    "bg_ricefield_sunset": { "url": "a/bg_ricefield_sunset.webp", "bytes": 94000 },
    "noy_walk":            { "url": "a/noy_walk.webp",            "bytes": 38000 }
  },
  "chunks": [                                   // download unit = a few scenes
    { "n": 1, "url": "chunks/01.json", "assets": ["bg_ricefield_sunset", "noy_walk"], "bytes": 141000 }
  ]
}

// chunks/01.json
{ "scenes": [{
    "n": 1, "aspect": "9:16",
    "layers": [
      { "asset": "bg_ricefield_sunset", "z": 0, "motion": { "preset": "kenburns", "to": { "scale": 1.08 } } },
      { "asset": "noy_walk", "z": 1, "x": 0.35, "y": 0.55, "w": 0.4, "motion": { "preset": "idle" } }
    ],
    "bubbles": [
      { "speaker": "noy", "x": 0.2, "y": 0.18, "style": "speech", "motion": { "preset": "pop", "delay": 400 },
        "text": { "lo": "ພວກເຮົາຊ້າແລ້ວ!", "en": "We're late!" },
        "tokens": {                               // pre-segmented at publish; Lao has no spaces
          "lo": [{ "t": "ພວກເຮົາ", "gloss": "we", "v": "phuak_hao" }, { "t": "ຊ້າ", "gloss": "late", "v": "sa" }, { "t": "ແລ້ວ!" }],
          "en": [{ "t": "We're", "gloss": "ພວກເຮົາ" }, { "t": "late!", "gloss": "ຊ້າ", "v": "late" }]
        },
        "audio": { "lo": "au/lo/s01_b1.opus", "en": "au/en/s01_b1.opus" } }
    ]
}]}

// vocab.json (per episode): v-ids → headword, translation, part of speech, audio, example
// quiz.json  (per episode): 3–5 items (picture match, fill the bubble, listen + choose)
```

`manifest.json` also carries `"level"` (e.g. `"en": "A1"`, `"lo": "beginner"`) and `"direction"` (`"lo→en"` or `"en→lo"`). The same comic can serve both directions: which language is primary and which is the gloss is a reader setting.

**Size budget:** 720 px wide WebP (not AVIF: decoding is too slow on low-end phones), q≈70.
- Background ≈ 80–120 KB, character cutout ≈ 25–60 KB, scene JSON ≈ 1–2 KB.
- A 20-panel episode with reused plates and characters ≈ **1.5–2.5 MB**. The equivalent MP4 motion comic would be 20–60 MB.
- **Audio:** Opus mono at ~24 kbps ≈ 3 KB/sec, so ~2 minutes of dialogue ≈ 350 KB **per language**. It's a separate, optional download per language, so learners on tight data can get text first.
- Keep `TARGET_TOTAL_MB = 5` in `package_content.py` as the hard ceiling.

### Two editions: Lite and HD

| | **Lite** (MVP) | **HD** (after MVP, from UE/Unity) |
|---|---|---|
| Visuals | 720 px WebP layers + CSS keyframe motion | High-res/3D-rendered layers, plus short pre-rendered clips (camera moves, character animation) where they add value |
| Size per 20-panel episode | ~1.5–2.5 MB | Estimate ~30–80 MB (depends on how much video; measure once we have a UE pipeline) |
| Made by | MVP cloud pipeline (image model + compositing) | UE/Unity on a cloud GPU, **from the same scene JSON** |
| Text, tokens, audio, vocab, quiz | **Shared.** Stored once, used by both editions | **Shared** |
| Works offline | ✅ | ✅ Downloaded, never streamed |
| Always available | ✅ Every book | Only books with an HD render |

**The rule: both editions are the same lesson.** Only the pictures differ. A learner on a weak connection learns exactly what a learner on fast Wi-Fi learns, and switching editions keeps their place, saved words and quiz progress.

**Not in the library: real-time 3D** (interactive UE/Unity scenes running on the phone, or cloud pixel streaming). The engine runtime is too big for low-end phones, and streaming needs a constant fast connection, which breaks offline reading. If we ever build interactive 3D, it belongs in a separate app. HD is pre-rendered and downloaded.

**How the library chooses an edition by default:**
1. **Signals.** Available on Android Chrome and inside the Capacitor app; iOS Safari exposes fewer, so there it falls back to step 2:
   - Connection: `navigator.connection` (`effectiveType`, `downlink`, `saveData`); Wi-Fi vs cellular from the Capacitor Network plugin.
   - Device: `navigator.deviceMemory` (low-RAM phones stay on Lite even on fast Wi-Fi, since HD clips can stutter).
   - Storage: `navigator.storage.estimate()`. Don't offer HD if it wouldn't fit.
2. **Measured speed.** Time the manifest download (plus a small probe file if needed) to get real throughput. Real throughput beats reported connection type.
3. **Default = HD only when every signal is good:** Wi-Fi (or unmetered), fast enough measured speed, enough RAM, enough free storage, Save-Data off. **Anything weak or unknown → Lite.** Guessing wrong toward Lite costs a little quality; guessing wrong toward HD costs a learner's data budget.
4. **Always show both sizes and let the reader choose:** "Lite · 2 MB ✓ recommended" / "HD · 45 MB".
5. **Remember the choice.** A global preference ("Always Lite", "HD on Wi-Fi only", "Auto"), which can be overridden per book.
6. **Upgrade later.** Download Lite now, then offer "Get HD when you're on Wi-Fi" as a background download.

**Format support:** the manifest lists editions, and the shared learning content sits outside them:

```jsonc
{
  "format": "textweaver.motion-comic/2",
  "text": { "url": "text.json", "bytes": 18000 },          // bubbles, tokens, vocab, quiz: shared
  "audio": { "lo": { "url": "audio-lo.pack", "bytes": 350000 }, "en": { /* … */ } },
  "editions": {
    "lite": { "assets": { /* … */ }, "chunks": [ /* … */ ], "bytes": 2100000 },
    "hd":   { "assets": { /* … */ }, "chunks": [ /* … */ ], "bytes": 46000000, "renderer": "ue5" }  // optional
  }
}
```

Scenes reference bubbles by ID, so both editions point at the same text. **The MVP builds Lite only**, but the format, reader and Studio include `editions` from day one so HD doesn't mean a retrofit.

**Pricing: none. Everything is free** (decided 2026-09-24). Both editions are free for every reader. If pricing ever comes back, the principle should stay the same: one price unlocks both editions, so readers on poor connections never pay the same for less.

### Language-learning layer

This is what turns a comic reader into a learning tool. MVP features:

| Feature | What the learner does | How it works |
|---|---|---|
| **Primary + gloss language** | Reads in the target language, with native-language help one tap away | Reader setting: `lo→en` (Lao student learning English) or `en→lo`. Long-press a bubble to see the full translation |
| **Tap-a-word** | Taps a word → sees its meaning, hears it, can save it | `tokens` in the scene JSON. Lao words are pre-segmented at publish time (`Intl.Segmenter` / ICU dictionary suggests boundaries, the editor fixes them) |
| **Audio per bubble** | Taps ▶ to hear the line. Karaoke-style highlight follows the audio | **Human-recorded** by bilingual voice actors in the Studio (phone mic is fine). English TTS is good enough as a fallback; Lao TTS isn't reliable yet, so Lao audio stays human |
| **Levels** | Picks a level and sees stories that fit | Each episode is tagged with a level (English: CEFR A1–B1; Lao: beginner/intermediate/advanced, already in the DB). Studio flags words above the level |
| **Episode vocab list** | Reviews the 5–10 new words after reading | `vocab.json`, built automatically from tokens, curated by the writer |
| **End-of-episode check** | Answers 3–5 quick questions | `quiz.json`: picture match, fill the bubble, listen and choose. Scores stored locally, synced when online |
| **My words** | Reviews saved words later, offline | Local word bank in IndexedDB with simple spaced repetition |

**Motion should serve comprehension.** Highlight the speaking character when their line plays, and pop bubbles in reading order. Keep ambient motion subtle so it doesn't pull attention from the text.

**Authoring in the Studio:**
1. Writer composes the line in one language. The LLM drafts the other language and suggests level-appropriate wording.
2. **A bilingual human editor always reviews it.** LLM Lao is noticeably weaker than its English, and wrong Lao in a learning product is worse than none.
3. The Studio checks vocabulary against the level word list and flags words above it.
4. Voice actor records each bubble in the Studio. Audio is trimmed and encoded to Opus on the server.
5. Publishing auto-builds tokens, vocab and a draft quiz, which the writer edits.

**Pedagogy partner:** have a Lao English teacher (from the partner schools) review the level lists and the first episodes. Grant reviewers will ask who validated the curriculum.

### Changes to existing code

| File | Change |
|---|---|
| `src/lib/idb.ts` | Store **Blobs per asset** + chunk JSON (not HTML strings). Dedupe assets across scenes and series. Request persistent storage |
| `src/pages/Reader.tsx` | Replace the `iframe srcDoc` scene with a `<MotionPanel>` renderer: layers + bubbles + presets, vertical scroll. Primary/gloss language, tap-a-word, bubble audio, end-of-episode quiz |
| `src/pages/studio/` | ✅ **Done (2026-09-24; Words tab removed 2026-09-27: a reading book, not a dictionary).** Script (lines + level checker + cloud art generation), Panel (drag layers/bubbles, size, motion presets, re-roll), Audio (record per line), Quiz (write + edit), Publish (checklist → manifest v2). English only, no pricing |
| New: `src/pages/MyWords.tsx` | Offline word bank + spaced-repetition review |
| `src/hooks/useGenerate.ts` | Return scene JSON + layer URLs instead of a single result URL |
| `gpu/package_content.py` | Emit manifest v2: asset dedupe, chunking, bilingual text, tokens, Opus audio per language, vocab + quiz files |
| `supabase/migrations/` | `characters` (reference sheets per series), `assets`, scene JSON column, `level_wordlists`, `quiz_results` (synced from device) |
| New: `src/lib/format.ts` | Types + validator for the format (shared by Studio, Reader, tests) |

---

## 5. Build plan (~11 weeks)

| Week | Milestone | Done when |
|---|---|---|
| 1 | **Format + renderer spike** | `format.ts` types (incl. tokens/audio/vocab); `<MotionPanel>` plays a hand-made 5-panel bilingual comic with parallax/kenburns/pop; Lao line-breaking verified in bubbles |
| 2 | **Reader v2** | Vertical-scroll reader on manifest v2 (with `editions`; Lite only for now); asset dedupe + chunked resume in IndexedDB; primary/gloss language; still mode; edition picker showing sizes, with auto-select logic behind it |
| 3 | **Learning features** | Tap-a-word, bubble audio with highlight, episode vocab, end-of-episode quiz, My Words (offline) |
| 4–5 | **GPU pipeline** | RunPod worker: LLM → scene JSON → background + character cutout; queue wired end-to-end through Workers |
| 6 | **Character consistency** | Character sheets per series; same character recognizable across 10 panels (spot-check with the Lao partner team) |
| 7–8 | **Studio editor** ✅ | Writer goes from a line of English to a published, leveled 10-panel episode with audio and quiz, without developer help. Includes level checker. **Built ahead of schedule on 2026-09-24**, against demo stubs; still needs the real GPU worker (weeks 4–5) |
| 9 | **Packaging + publish + content** | `package_content.py` v2 → R2 → library → offline read (free, no purchase step). Team writes the first **6–8 original episodes** (A1–A2), reviewed by a partner-school teacher |
| 10 | **Device testing in Laos** | 3–5 real low-end Androids on 3G/throttled connections: episode ≤ 3 MB (+ audio), first panel < 3 s, smooth scroll, audio plays offline |
| 11 | **Capacitor wrap + school pilot** | Android build (Play + APK), Filesystem storage; pilot in 2–3 partner schools with 50+ students |

**Out of MVP scope:** the HD edition and its UE/Unity producer (the format supports it; nothing renders it yet), AI video clips, Lao TTS (human recording instead), speech recognition / pronunciation scoring, PixiJS FX layer, teacher dashboard, outside creators, creator subscriptions and revenue share.

**MVP success metrics** (these become the DIV Fund evidence base):
- **Learning:** pre/post vocabulary test gain per student over the pilot (run by partner-school teachers), quiz accuracy, words saved and reviewed per week.
- **Engagement:** episodes completed per student per week, D7/D30 retention, % reads completed offline.
- **Cost/delivery:** average episode size, time from line to published panel, GPU cost per panel, cost per student reached.

DIV Fund cares most about *learning gain per dollar*. Design the pilot's pre/post test with the partner schools before it starts, not after.

---

## 6. Funding & grants

### What the premise changes

The core pitch stays **language learning and literacy for Lao students** (English and Lao), which is what the earlier research (`docs/grants/`) was built on. This MVP makes that pitch stronger in three ways:
- **Measurable learning outcomes:** pre/post tests from the school pilot. Education funders and DIV Fund want exactly this.
- **Low-connectivity digital inclusion:** offline-first, tiny downloads.
- **Open standards:** an open, bilingual motion-comic format + reader.

The **creative economy / jobs** angle (Lao writers, illustrators and voice actors) still holds. For now it means our own hired team, with outside creators later.

### ⚠️ Epic MegaGrants and the MVP

The Epic proposal (`docs/grants/epic-megagrants/`) **was submitted for the Sept 4, 2026 cycle**. Epic typically responds in ~90 days (≈ Dec 2026).
- The MVP doesn't contradict it. In every other application, describe UE as the producer of the **HD edition**, which plugs into the open format the MVP defines. Don't call it the MVP's runtime.
- **If awarded:** the grant funds the HD edition. UE renders high-quality/3D versions of each book from the same scene JSON, delivered alongside Lite so readers with good connections get the richer version automatically.
- **If declined:** nothing in the MVP changes. Reapply in a later cycle with a working product and a concrete UE producer demo.

### Act now

| Opportunity | Amount | Why it fits | Next step |
|---|---|---|---|
| **DIV Fund** (fka USAID DIV) | Stage 1 up to $200K | Rolling. Needs a *post-prototype* product tested with real users, **which this MVP produces** | Finish MVP + 50-user pilot, then submit Stage 1 (prep in `docs/grants/usaid-div/`) |
| **Cloudflare for Startups** | $5K–$250K credits | We already run on Pages/Workers/R2. No deadline | Apply now; the bootstrapped tier needs no funding ([cloudflare.com/startups](https://www.cloudflare.com/startups/)) |
| **Other cloud/GPU credits** | Varies | Cuts GPU and hosting costs during the pilot | Google for Startups Cloud, Microsoft for Startups, NVIDIA Inception, AWS Activate |
| **Australia Direct Aid Program** (Vientiane embassy) | Small grants | Funds education and community projects in Laos | **Partner non-profit applies**, with our Lao company as the technology provider and partner schools as pilot sites (an offline reading library in schools) ([form](https://laos.embassy.gov.au/vtan/AEV003001.html)) |
| **Japan GGP / Kusanone** (Vientiane embassy) | < ¥10M (~$65K) | Supports education projects by NGOs, schools and local authorities. 350+ Lao projects since 1989 | **Partner non-profit (or a partner school) applies.** Pitch: school tablets + Textweaver offline library. GGP favors equipment and tangible deliverables ([how to apply](https://www.la.emb-japan.go.jp/jp/japans_oda_to_laos/ggp/ggp_how_to_apply.html)) |

### Next calls to watch

| Opportunity | Amount | Fit & requirements | Timing |
|---|---|---|---|
| **UNICEF Venture Fund** | Up to $100K equity-free | Company registered in a UNICEF programme country (the **Lao partner company qualifies**), working prototype, **open-source commitment**. ✅ We've committed to open-sourcing the format + reader | 2026 calls were blockchain and climate-health. Watch for an AI/edtech call ([apply page](https://www.unicefventurefund.org/apply-funding)) |
| **GSMA Innovation Fund** | £100K–£200K | For-profit small enterprises in S/SE Asia. Earlier rounds covered AI and digital inclusion | Themed rounds (2025 Impactful AI; 2026 Green Transition closed Apr 6). Watch for the next inclusion/AI theme ([GSMA](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/gsma-innovation-fund/)) |
| **Canada Fund for Local Initiatives – Laos** | Typically C$15K–30K (max C$100K) | Locally led projects; the partner non-profit leads, and our Lao company supports | 2025 Laos cycle closed. Watch for the 2027 cycle ([CFLI Laos](https://www.international.gc.ca/world-monde/funding-financement/cfli-fcil/lao-laos.aspx?lang=eng)) |
| **Unity for Humanity** | $600K pool (2026) | **Only if** Unity becomes the premium producer | Annual window, ~Jan–Feb (2026 closed Feb 20) ([Unity](https://unity.com/humanity)) |
| **Mekong–ROK Cooperation Fund** | $300K–$1M | Regional, multi-country, submitted via national MOFA. Long shot unless we partner with an institution in 2+ Mekong countries | EOIs ~April (10th call closed Apr 10, 2026) ([Mekong Institute](https://mekonginstitute.org/mekong-rok-cooperation-fund-launches-10th-call-for-innovative-regional-project-proposals/)) |
| **ISIF Asia** | Up to $75K | Already tracked. The offline-first angle now fits better | 2027 (`docs/grants/isif-asia/`) |

### Partners worth approaching (not grants, but they raise grant win rates)

- **The Asia Foundation – Let's Read:** free digital library with offline download, **including Lao-language books**. It's both the closest competitor and the most natural partner. Its openly licensed stories could be adapted into motion comics (check each book's license), which would seed our library and give us an instant credible partner ([Let's Read](https://asiafoundation.org/programs/education-and-leadership/lets-read/)).
- **Pratham Books – StoryWeaver:** the best-known open children's-story platform, and a possible *later* content source (for now, all stories are original). All stories and images are **CC BY 4.0**: no royalties, commercial use allowed, but every adaptation must carry StoryWeaver's attribution line crediting author, illustrator, funder and publisher ([attribution guidelines](https://storyweaver.org.in/attributions)). To support this, manifest v2 needs a `credits` / `source` field, and the reader and store listing must show it. We're keeping the Textweaver name. See [Naming](#naming-textweaver-vs-storyweaver) for how to handle the similarity.
- **Room to Read** and **Big Brother Mouse** (Lao children's publisher): distribution into schools and a pool of local creators.

### Updated grant sequence

```
Now          Cloudflare credits · approach Let's Read · line up partner non-profit + schools for embassy grants
Q4 2026      Build MVP (Option A) · embassy small grants (DAP, GGP) via Lao partner + schools
Q1 2027      Pilot (50+ readers, 3–5 creators) → DIV Fund Stage 1 · Unity for Humanity (only if Unity)
2027         ISIF Asia · UNICEF Venture Fund / GSMA when a matching call opens · CFLI 2027
Dec 2026     Epic MegaGrants decision (submitted Sept 4) → if awarded, start UE producer after MVP
Later        UE/Unity premium producer · GIF · UNESCO PP
```

### How we apply: entity roles

We're a for-profit, working closely with a non-profit and with school connections. That covers most of the list if each entity takes the right role:

| Funder type | Lead applicant | Our role |
|---|---|---|
| Embassy grants (DAP, GGP, CFLI) | **Partner non-profit** (GGP: or a school) | Technology + content provider; schools are pilot sites |
| DIV Fund, GSMA, UNICEF Venture Fund | **Our company** (US or Lao entity, per each call's rules) | Non-profit + schools as implementation partners, with letters of support |
| Epic MegaGrants, Unity for Humanity | **Our company** | — |

Get a short partnership MOU with the non-profit and **letters of support from 2–3 schools** now. Nearly every application above asks for them.

---

## Naming: Textweaver vs StoryWeaver

**Decision: keep Textweaver.** Changing it isn't necessary.

- **Legal risk looks low.** The only "TEXTWEAVER" US trademark we found is a 2001 filing by the San Diego State University Foundation, **abandoned in 2003** ([Justia](https://trademarks.justia.com/763/40/textweaver-76340646.html)). "Textweaver" and "StoryWeaver" are different marks. Not legal advice, though: run a proper clearance before spending on branding (USPTO, WIPO Global Brand Database, Laos Department of Intellectual Property), then file for Textweaver in Class 9 (software) and Class 41 (education/publishing).
- **The real risk is recognition, not law.** Literacy funders know StoryWeaver, and a reviewer might briefly think we're related or derivative. Handle it with positioning:
  - Always pair the name with the category: **"Textweaver — animated comics for Lao readers."** StoryWeaver is static picture books, so the difference is clear in one line.
  - Mention StoryWeaver once in competitive-landscape sections, as an open content source we build on. Naming it first shows we know the field.
  - Readers will mostly see the **Lao app name and icon** in stores, so decide the Lao-script name early and use it consistently.
- **Upside:** if we adapt StoryWeaver's openly licensed stories into motion comics, the similar name reads as a fit rather than a copy.

---

## 7. Decisions (2026-09-24)

| Question | Decision | Consequence |
|---|---|---|
| Epic MegaGrants submitted? | ✅ Yes, Sept 4, 2026 cycle | UE is described as the premium producer in all applications; decision ≈ Dec 2026 |
| Open-source format + reader? | ✅ Yes (Studio + pipeline stay closed) | Unlocks UNICEF Venture Fund. Publish `format.ts` + `<MotionPanel>` under a permissive license (MIT/Apache-2.0) once the format stabilizes (~week 2) |
| Lao entity type | For-profit, working closely with a non-profit, with school connections | Non-profit leads embassy grants; see [entity roles](#how-we-apply-entity-roles) |
| Name | Keep **Textweaver** | See [Naming](#naming-textweaver-vs-storyweaver); run trademark clearance and file |
| Editions | **Lite** (every book) + **HD** (later, UE/Unity); library auto-picks by connection, reader can switch | See [Two editions](#two-editions-lite-and-hd) |
| Studio for now | **Writing only, saved on the writer's device** (2026-09-24). Scene art, layout, audio and publishing switched off (`src/lib/features.ts`) | Stops bad actors flooding the database before sign-in exists; rendering comes later. Demo books are published directly |
| Live demo | **https://textweaver.knives-thao.workers.dev** | Cloudflare Worker + D1, free plan. Library, reader, quiz and offline reading work publicly |
| Pricing | **Free for all users.** No pricing in the Studio or library for now | Existing QR payment code stays in the repo but new content has no price. Revisit later |
| Language | **English only** for now (content, meanings, quiz, Studio). Lao later with localization | Format keeps text keyed by language so Lao is additive. Removes translation review from the Studio |
| Backend | **Cloudflare Workers API built with [Hono](https://hono.dev)**, no separate server (keeps hosting free). Built 2026-09-24 in `api/`; see `backend-architecture.md` | Keep business logic in plain TypeScript modules; Hono only maps routes and runs middleware, so swapping frameworks stays cheap. Runs under Node locally, since Cloudflare's local runtime needs macOS 13.5+ |
| Database | **Cloudflare D1** (SQLite), replacing Supabase Postgres; files in **R2** | Free tier never pauses and sits with hosting, R2 and Workers AI. No row-level security, so every permission check lives in the API (covered by tests). Locally the API uses a SQLite file (same engine). The Studio has moved; library/reader pages move next |
| Auth | **Decided later**, behind one small interface (`api/src/platform.ts`) | Users sign in in different ways, and **many people in Laos don't use email**, so email can't be the main method. Reading needs no account. Better Auth is the leading library; see `backend-architecture.md` → Authentication |
| Open source | **Contribute to Hono upstream** when we need something it lacks or could do better | Only general-purpose improvements, not Textweaver-specific code. Open an issue or discussion first, then a PR (core, or the `honojs/middleware` repo). Doubles as marketing ("built with and contributing to Hono") and reduces the single-maintainer risk we depend on |

---

## Sources

- Unity for Humanity 2026: [unity.com/humanity](https://unity.com/humanity), [2026 announcement](https://unity.com/blog/unity-for-humanity-2026-grant-now-open)
- UNICEF Venture Fund: [apply](https://www.unicefventurefund.org/apply-funding), [climate & health 2026 call](https://www.unicef.org/innovation/call-for-application-climate-and-health-2026)
- GSMA Innovation Fund: [overview](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/gsma-innovation-fund/), [Green Transition 2026](https://www.gsma.com/newsroom/press-release/gsma-launches-innovation-fund-to-accelerate-green-transition-through-mobile-technology/)
- Australia DAP Laos: [application form](https://laos.embassy.gov.au/vtan/AEV003001.html)
- Japan GGP Laos: [how to apply](https://www.la.emb-japan.go.jp/jp/japans_oda_to_laos/ggp/ggp_how_to_apply.html)
- CFLI Laos: [international.gc.ca](https://www.international.gc.ca/world-monde/funding-financement/cfli-fcil/lao-laos.aspx?lang=eng)
- Mekong–ROK Cooperation Fund: [10th call](https://mekonginstitute.org/mekong-rok-cooperation-fund-launches-10th-call-for-innovative-regional-project-proposals/)
- Cloudflare for Startups: [cloudflare.com/startups](https://www.cloudflare.com/startups/)
- TEXTWEAVER trademark (abandoned): [Justia](https://trademarks.justia.com/763/40/textweaver-76340646.html)
- Let's Read: [Asia Foundation](https://asiafoundation.org/programs/education-and-leadership/lets-read/), [Google Play](https://play.google.com/store/apps/details?id=org.asiafoundation.letsread&hl=en)
- Capacitor vs Flutter (2026): [OpenForge](https://openforge.io/capacitor-vs-flutter-what-ctos-need-to-know-in-2026/)
- Internal: `ARCHITECTURE.md`, `ai-architecture.md`, `gpu-costs.md`, `docs/grants/index.md`, `docs/grants/future/pursuit-plan.md`
