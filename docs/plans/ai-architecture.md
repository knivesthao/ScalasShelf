# Textweaver — AI Architecture: What Do We Actually Need AI For?

> **Principle:** Use the minimum AI necessary. Self-host everything on the RunPod GPU that we're already paying for. Zero external AI API costs.

---

## What UE5 Can Do Natively (No AI Needed)

| Task | How it happens | AI? |
|------|---------------|-----|
| Place 3D meshes in a scene | Blueprint spawns them from JSON data | ❌ No |
| Configure lighting + camera | Blueprint reads JSON, sets parameters | ❌ No |
| Apply materials to meshes | Blueprint loads textures and assigns them | ❌ No |
| Render via Movie Render Queue | Blueprint triggers MRQ | ❌ No |
| Compress output to WebP | Python script (Pillow/FFmpeg) | ❌ No |

**Almost everything in the rendering pipeline is just UE5 Blueprint scripting.** The developer writes Blueprint logic that reads structured data and executes it. This is normal UE development.

## What We Actually Need AI For

There are exactly **two** AI tasks:

### 1. Narration → Scene JSON (a small LLM)

A creator writes: *"A boy walks through a rice field at sunset with his water buffalo."*

We need that parsed into: characters present, their positions, background elements, lighting mood, camera angle — as structured JSON that the Blueprint can read.

**This is a tiny job for any LLM.** A well-crafted system prompt is more important than the model quality. It's not a complex reasoning task — it's extraction and formatting.

### 2. Text prompts → PNG textures (image generation)

For characters and backgrounds, we need to generate images from text descriptions. Stable Diffusion can do this.

**This is optional for the prototype.** We can use UE5's built-in materials (solid colors, simple patterns, procedural textures) for the first version and only add AI image gen when we need original art.

---

## UE5 AI Assistance — What's Real vs. What's Not

UE5 does **not** have a "type a prompt and it builds a 3D scene" feature. Here's what UE5 actually offers:

| Feature | What it does | Relevant? |
|---------|-------------|-----------|
| **Blueprint Assist** (UE 5.4+) | Copilot-like suggestions while writing Blueprints — autocompletes nodes | Helps developer code faster, but doesn't generate scenes |
| **AI Controller / Behavior Tree** | Game AI — NPC pathfinding, combat decisions | ❌ Not relevant |
| **MetaHuman Animator** | AI for facial animation from video | ❌ Not relevant |
| **Procedural Content Generation (PCG)** | Spawns vegetation, rocks, buildings based on rules | Partially — could place background elements, but doesn't understand narration |

**Bottom line:** UE5 can't read "a boy walks through a rice field" and turn it into a scene. We still need the LLM step, but it can be a tiny, cheap one.

---

## Recommended Approach: Self-Host on the RunPod GPU

The RunPod A5000 (24GB VRAM) is already running 24/7 during development. Between UE5 renders, it sits idle. We use that idle time for AI inference.

### What runs on the GPU:

| Task | Model | VRAM | Cost |
|------|-------|------|------|
| **UE5 rendering** | Unreal Engine 5 | ~4–6GB (while rendering) | $0.29/hr (on-demand) |
| **LLM (narration → JSON)** | Llama 3.1 8B (quantized, Q4) | ~6GB | $0 (same GPU, idle time) |
| **Image generation** | Stable Diffusion XL | ~8GB | $0 (same GPU, idle time) |

The GPU switches between rendering and inference. While no one is rendering, it serves the LLM + SD. While rendering, the AI jobs queue and wait.

**Total AI cost: $0.** Everything runs on the same RunPod machine.

### Comparison:

| Approach | Monthly AI Cost | Management |
|----------|----------------|------------|
| OpenAI + Replicate (was going to do) | ~$250/mo | Zero management |
| **Self-host on RunPod GPU (recommended)** | **$0** | Must install Llama + SD once |
| DeepSeek API (cheapest alternative) | ~$10/mo | Pay-per-call, no management |

---

## How Self-Hosting Works

**Setting up Llama 3 on RunPod (once):**
```
1. Install Ollama (simple: curl -fsSL https://ollama.com/install.sh | sh)
2. Pull the model: ollama pull llama3.1:8b
3. Run as API: ollama serve
4. Call from Python: POST /api/chat with the narration + system prompt → get JSON
```

**Setting up Stable Diffusion on RunPod (once):**
```
1. Install ComfyUI (popular SD interface)
2. Load SDXL model + IP-Adapter for character consistency
3. Run as API: ComfyUI has a built-in HTTP endpoint
4. Call from Python: POST scene descriptions → get generated PNGs
```

Both run alongside UE5 on the same GPU, taking turns based on demand.

---

## What This Means for the Total Budget

**Previous budget (external APIs):** OpenAI $1,500 + Replicate $1,500 = $3,000 in API costs
**New budget (self-hosted):** $0 in API costs. RunPod GPU covers everything.

We can drop the OpenAI and Replicate line items from the grant budget entirely. The total drops from ~$65K to ~$62K.
