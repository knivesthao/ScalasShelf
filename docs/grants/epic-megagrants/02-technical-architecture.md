# 3. Technical Architecture

Textweaver is a pipeline of four orchestrated stages, each leveraging a specific UE capability that no alternative engine or WebGL approach could replicate.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1: Creator Interface (Web)                            │
│  ┌─────────────┐    Pixel Streaming    ┌──────────────────┐ │
│  │  Browser UI  │ ←─────────────────→  │  UE5 Application  │ │
│  │  (React SPA) │    WebRTC stream     │  (Headless mode)  │ │
│  │              │                      │  Runs on cloud GPU │ │
│  └──────┬───────┘                      └────────┬─────────┘ │
│         │  Text narration                        │            │
│         ▼  (Lao or English)                      │            │
├─────────────────────────────────────────────────────────────┤
│  STAGE 2: AI Content Generation Layer                       │
│  ┌─────────────┐     ┌──────────────┐    ┌───────────────┐ │
│  │ LLM Pipeline │────▶│ Scene Struct  │───▶│ Image Gen API │ │
│  │ (Llama 3,    │     │ Parser        │    │ (SDXL,        │ │
│  │  self-host)  │     │ JSON → UE     │    │  self-host)   │ │
│  │              │     │ Data Assets   │    │               │ │
│  └─────────────┘     └──────┬───────┘    └───────┬───────┘ │
│                             │                     │          │
│    Example output:          ▼                     ▼          │
│    "A young girl walks     Structured scene:    Assets:     │
│     through a rice field   { characters: [...],  char_01.png
│     with her water          backgrounds: [...],  bg_rice.exr
│     buffalo..."             lighting: sunset,   (HDR light)
│                             camera: wide }                 │
├─────────────────────────────────────────────────────────────┤
│  STAGE 3: UE Scene Assembly Engine                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Blueprint Orchestrator (headless UE5 process)         │ │
│  │                                                        │ │
│  │  1. Load Scene Template (Level Blueprint)              │ │
│  │  2. Spawn AI-generated static mesh actors              │ │
│  │  3. Apply materials with AI textures                   │ │
│  │  4. Place HDR sky + dynamic lights per scene settings  │ │
│  │  5. Position CineCameraActor per camera data           │ │
│  │  6. Apply post-process volume (comic shader)           │ │
│  │  7. Render via Movie Render Queue → image sequence     │ │
│  │  8. (Interactive books) → Sequencer keyframes for      │ │
│  │      character animation + camera movement             │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  STAGE 4: Content Packaging & Distribution                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Image seq.   │───▶│ Chunked      │───▶│ CDN / Storage│ │
│  │ + audio +    │    │ Package      │    │ + PWA Cache  │ │
│  │ metadata     │    │ (per-scene)  │    │              │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Creator Interface — Pixel Streaming

A Lao creator logs into the Textweaver web app through a standard browser — no UE installation, no GPU requirement. The editor UI is a React single-page application that receives a Pixel Streaming video feed from a headless UE5 instance running on a cloud GPU (RunPod A5000, 24GB VRAM).

**Why Pixel Streaming instead of a custom web renderer:**
- The creator needs real-time preview of 3D scenes as they are assembled — exactly what Pixel Streaming was built for
- The UE Pixel Streaming plugin handles WebRTC negotiation, input forwarding, and adaptive quality automatically
- Creators in Laos access the same editor as creators anywhere else — zero local hardware dependency
- GPU instances can be spun up on demand, keeping infrastructure costs tied to actual usage

**Interaction model:** The creator inputs are divided into two paths. Text narration (Stage 2) triggers the AI pipeline and returns generated scenes for approval. Direct manipulation (character placement, color palette selection, dialog positioning) sends UI commands through a thin WebSocket bridge that routes to Blueprint events in the UE instance.

The streaming session is ephemeral. When a creator finishes a book and publishes, the UE instance renders the final output (Stage 3), packages it (Stage 4), and terminates. No GPU runs idle.

---

## Stage 2: AI Content Generation Layer

This is where the "magic" happens — and where careful engineering separates a workable product from a demo.

The creator provides narration in plain text, scene by scene. Each scene description can be as short as "A market in Luang Prabang at sunset, a boy buys sticky rice from a vendor" or as long as a paragraph. The text is always in Lao or English — we build for Lao creators first.

**Step 2a — LLM Pipeline:**
The narration passes through a self-hosted LLM (Llama 3 via Ollama — sharing the same GPU as rendering, so inference costs near zero) with a structured prompt that outputs JSON:

```json
{
  "scene_id": "s03",
  "setting": "Luang Prabang morning market",
  "mood": "warm, bustling",
  "lighting": { "type": "golden_hour", "direction": [0.7, 0.3, 0.5], "intensity": 1.2 },
  "camera": { "type": "wide_establishing", "fov": 90, "position": [0, 150, 800] },
  "characters": [
    { "id": "boy_main", "pose": "standing", "expression": "curious", "position": [200, 0, 100] },
    { "id": "vendor", "pose": "offering_food", "expression": "friendly", "position": [250, 0, 150] }
  ],
  "background_elements": ["market_stalls", "baskets_rice", "morning_mist", "temple_distant"],
  "dialog": [
    { "speaker": "boy_main", "text": "How much for the sticky rice?", "emotion": "curious" }
  ]
}
```

The LLM is constrained to output only structural scene data — never the images themselves. This separation keeps the LLM call cheap and deterministic.

**Step 2b — Image Generation:**
Background elements, character sprites, and prop assets are generated via Stable Diffusion XL (self-hosted via ComfyUI on the same GPU, eliminating external API costs). Crucially, we maintain character consistency across scenes by:
- Generating a **reference character sheet** once per character — the creator approves it
- Using **IP-Adapter + ControlNet** to constrain subsequent generations to match the established character design, pose, and style
- Storing generated assets in a UE-compatible format (PNG textures, EXR for HDR environment lighting)

The LLM scene struct serves as the prompt engineering bridge — turning freeform narration into precisely parameterized image generation calls.

---

## Stage 3: UE Scene Assembly Engine

This is the core of Textweaver and the part that no other approach can replicate.

A headless UE5 process receives the structured scene data (JSON from Stage 2) and executes a fully automated assembly pipeline through Blueprints:

1. **Level Blueprint Orchestrator:** A master Blueprint script loads a pre-built "empty stage" level containing a CineCameraActor, a base lighting rig, and a post-process volume. The Blueprint reads the scene JSON and begins spawning.

2. **Asset Spawning:** AI-generated textures are loaded at runtime into existing skeletal meshes and static meshes via `Set Material` and `Create Dynamic Material Instance`. We maintain a library of ~50 base meshes (human figures, common objects, architectural primitives, vegetation) that serve as the geometry canvas — the AI provides the visual skin.

3. **Lighting:** The scene JSON's lighting parameters map directly to a `DirectionalLight`, `SkyLight`, and `ExponentialHeightFog` configuration. HDR environment maps generated by the AI are loaded into the SkyLight cubemap for ambient lighting. This is why we need UE — WebGL cannot approach this lighting fidelity at mobile-exportable quality.

4. **Camera Setup:** The CineCameraActor is positioned and configured from the JSON camera block. For interactive books, a second pass adds camera animation via Sequencer — the Blueprint programmatically creates Sequencer tracks with keyframes for gentle camera drift, focus pulls, or character-following movements that make the scene feel alive.

5. **Post-Process — The Comic Shader:** A custom post-process material applies a non-photorealistic rendering pass that gives every scene a consistent illustrated/comic-book aesthetic. Edge detection for outlines, cel-shaded color quantization, and halftone screen patterns are applied per-material via the post-process volume. This shader is a UE material graph asset — it runs at render time with zero performance cost on the output.

6. **Render:** The assembled scene is fed into the **Movie Render Queue** (MRQ), UE's high-quality offline render pipeline. MRQ outputs an image sequence with anti-aliasing, motion blur where appropriate, and render passes we can composite if needed. For interactive books, MRQ also renders Sequencer-driven animation clips as lightweight H.264 segments.

7. **Batch Processing:** A single GPU instance can assemble and render multiple scenes in sequence. The entire Stage 3 pipeline is driven by a Python script communicating with the UE instance via Remote Control API — no human clicks "render."

---

## Stage 4: Content Packaging & Distribution

The output of Stage 3 is a folder of PNG sequences (one per scene strip for comics, one per scene with optional video segments for interactive books), an audio track (TTS-generated narration, also AI-driven), and a metadata JSON describing the book structure.

**Packaging for low-bandwidth:**
- Images are run through a UE-powered batch compression pass (export size presets configured in MRQ) producing aggressively optimized PNG/WebP files — a full 20-page comic targets under 5MB total
- Interactive book scenes are packaged **per scene** — a user on an unstable 2G connection can download scene 1 first, start reading, while scene 2 queues in the background
- The metadata JSON includes a manifest of all chunks, their sizes, and download priority
- Video segments from Sequencer renders are transcoded to H.264 baseline profile at 360p — playable on virtually any Android device from 2015 onward

**Digital Library Backend:**
- A lightweight REST API serves content metadata, user library state, and download URLs
- User authentication via Lao phone number (no email requirement — critical for our audience)
- QR code payment integration bridges the Lao mobile money ecosystem (BCEL One, LDB Mobile Banking)
- Content is served from Cloudflare's CDN with edge nodes in Southeast Asia (Vientiane, Bangkok, Singapore) — zero egress fees

**Offline Mobile Client:**
- A Progressive Web App (PWA) wrapper provides the reading experience with full Service Worker offline caching
- Downloaded content persists in IndexedDB — the user's library is available whether they have internet or not
- Reading progress, bookmarks, and notes sync back to the server when connectivity returns
- For the eventual native mobile app (iOS/Android/Chinese app stores), we use UE's **mobile packaging pipeline** — the same rendering that produces the content can also package the reader app itself as a lightweight UE application with embedded media playback

---

## Technology Stack Summary

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Creator UI | React + WebRTC | Pixel Streaming client, accessible from any browser |
| UE Runtime | Unreal Engine 5.4+ (headless) | Scene assembly, rendering, Pixel Streaming host |
| AI — Text | Llama 3 (self-hosted via Ollama) | Structured scene extraction from Lao/English narration |
| AI — Image | Stable Diffusion XL + IP-Adapter + ControlNet (self-hosted via ComfyUI) | Consistent character generation across scenes |
| AI — Voice | ElevenLabs / Coqui TTS | Narration audio in Lao (fine-tuned) and English |
| Cloud GPU | RunPod A5000 (24GB VRAM) | Pixel Streaming host + batch rendering |
| Rendering | UE Movie Render Queue | Offline-quality output with comic post-process shader |
| Packaging | Custom Node.js pipeline + FFmpeg | Chunk content, optimize images, transcode video |
| CDN | Cloudflare R2 + CDN | Edge delivery in Southeast Asia, zero egress fees |
| Mobile Client | PWA (Service Worker + IndexedDB) initially; UE mobile build for native | Offline reading, low-end device support |
