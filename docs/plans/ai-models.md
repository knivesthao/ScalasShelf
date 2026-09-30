# Scala’s Shelf — AI models: which model does which job

> Written 2026-09-30. Prices checked the same day on each provider’s official page (links at the end).
> Prices change, so check them again before a funding report. The cost estimates in the admin view
> use `PRICES_PER_MILLION` in `api/src/services/admin.ts`; keep it in step with this file.

## Rules we follow

1. **No AI where rules or a dedicated API work.** Level checks, quiz drafting, spelling, image
   prompts and translation don’t use a language model.
2. **The cheapest model that does the job well.** Small Workers AI models for short, simple text.
   Claude only for writing a story, where quality really matters.
3. **Pay once.** Word meanings and translations are cached and reused across books.
4. **A person always approves.** AI output is a draft; a moderator checks every book.
5. **Every call is recorded** in `ai_usage` (task, model, book, tokens, time), so the admin view
   shows the real cost per book.

## Every API call that uses AI

These are the only endpoints that call an AI model. Everything else in the API is plain code.

| API call | What it does | Model | Status |
|---|---|---|---|
| **`POST /api/v1/studio/suggest/idea`** | "+ New" popup: tidies the writer’s idea into the book’s description, and picks a level for learning books | **Workers AI `@cf/meta/llama-3.1-8b-instruct`** (JSON mode) | Built. Uses this model today |
| **`POST /api/v1/studio/suggest/description`** | Details tab: "Ask Scala to write it" — a one-sentence blurb from the story | **Workers AI `@cf/meta/llama-3.1-8b-instruct-fp8-fast`** | Built. Today it uses `llama-3.1-8b-instruct`; switch to fp8-fast |
| **`POST /api/v1/studio/projects/:id/finish`** | Scala Finish: writes the rest of the story (scenes, lines, new words) as a background job | **Claude Haiku 4.5 (`claude-haiku-4-5`)**; retry on **Claude Sonnet 5.5 (`claude-sonnet-5-5`)** if Haiku’s answer fails validation twice | Built. Today it uses `llama-3.1-8b-instruct`; switch to Haiku |
| **`POST /api/v1/studio/projects/:id/meanings`** | Simple meanings for a book’s new words: the shared dictionary first, then **one request for the whole book** as a numbered list | **Workers AI `@cf/meta/llama-3.1-8b-instruct`** (JSON mode) | Built (Review → “Ask Scala for the meanings”) |
| **`POST /api/v1/studio/suggest/simplify`** *(planned)* | Rewrites a line the level check flagged, in simpler words; the word lists check the result | **Workers AI `@cf/meta/llama-3.1-8b-instruct-fp8-fast`** | Planned |
| **`POST /api/v1/render`** (jobs `scene`, `layer`) *(planned for real art)* | Draws characters and places, and re-rolls one picture | Drafts: **Workers AI `@cf/black-forest-labs/flux-1-schnell`**. Final art: **Workers AI `@cf/black-forest-labs/flux-2-dev`** | Built with demo art only; illustrations are switched off |
| **Safety check** inside `POST /api/v1/studio/projects/:id/submit` *(planned)* | Screens the book’s text before it reaches a moderator | **Workers AI `@cf/meta/llama-guard-3-8b`** | Planned |

### Jobs that use a dedicated API instead of AI

| API call | Job | Service | Why not AI |
|---|---|---|---|
| `POST /api/v1/studio/projects/:id/check` and `/submit` | Spelling | **LanguageTool public API** (built) | Built for exactly this, free, no key |
| `POST /api/v1/studio/projects/:id/translations` (queue) and `GET …/translations` (status) | Lao ↔ English translation | **Google Cloud Translation (NMT)** | A translation service, with Lao support and a free monthly allowance; cheaper and more predictable than an LLM. Built; needs `GOOGLE_TRANSLATE_KEY` |

### Jobs that use no AI at all

| Job | How |
|---|---|
| Level check and level suggestion | Word lists (`src/lib/levels.ts`) |
| Quiz drafting | Built from the book’s new words (`draftQuiz` in `src/lib/format.ts`) |
| Image prompts | Filled in from a template: style guide + place description + character descriptions from the Cast tab |
| Placing characters in a scene | `composeScene` lays out the cast’s pictures (`src/lib/cast.ts`) |
| Review checks (pages, lines, art, new words, quiz) | `src/lib/checklist.ts` |
| Voice audio | Recorded by people in the Studio. No speech service we checked supports Lao. |

## Why each model

**Workers AI Llama 3.1 8B** (`@cf/meta/llama-3.1-8b-instruct`, $0.282 in / $0.827 out per million tokens).
The smallest model that supports Workers AI’s **JSON mode**, which the idea and meanings jobs need
(a description plus a level; a list of words with meanings). The cheaper fp8 variants don’t support
JSON mode. It runs inside our Worker, so there’s no extra account or key. The free allowance is
10,000 neurons a day.

**Workers AI Llama 3.1 8B fp8-fast** (`@cf/meta/llama-3.1-8b-instruct-fp8-fast`, $0.045 in / $0.384 out).
The same model, quantized: about a sixth of the input price. It’s for jobs that return one plain
sentence (a description, a simpler line), where JSON mode isn’t needed. Cheaper still are
`llama-3.2-1b` and `granite-4.0-h-micro`, but they’re weaker at natural children’s English. Try
them later against the same prompts if cost matters.

**Claude Haiku 4.5** (`claude-haiku-4-5`, $1 in / $5 out).
Scala Finish writes whole scenes that children will read. It needs a good story, natural simple
English at the right level, and a long, valid JSON answer. Small open models often break the JSON
or write flat stories. Haiku is Anthropic’s cheapest model and does this reliably. One run is roughly
2,500 tokens in and 1,500 out: **about $0.01 per book**. If Haiku’s answer fails our checks twice,
the job retries once on **Claude Sonnet 5.5** (`claude-sonnet-5-5`, $2 / $10), about $0.02 for that
run. Anthropic’s default model is Claude Opus 5.5 ($4 / $20). It writes better stories but costs about
4 times more than Haiku for this job; we chose Haiku to save cost, with Sonnet as the fallback.

**FLUX.1 schnell on Workers AI** (`@cf/black-forest-labs/flux-1-schnell`, $0.0000528 per 512×512 tile
+ $0.0001056 per step). Very cheap, fast drafts while the writer is working: a 1024×1024 image at 4
steps is about **$0.0006**. Drafts can be re-rolled freely.

**FLUX.2 dev on Workers AI** (`@cf/black-forest-labs/flux-2-dev`, $0.00041 per output tile per step).
Better quality for final art, drawn once a writer is happy with a draft. At 1024×1024 and 20 steps,
about **$0.03 per image**. Same account as everything else. If characters don’t look the same across
scenes, the alternative is **FLUX.1 Kontext [pro] on Together AI** ($0.04 per megapixel), which edits
from a reference picture of the character.

**Llama Guard 3 8B on Workers AI** (`@cf/meta/llama-guard-3-8b`, $0.484 in / $0.030 out).
A safety classifier, not a writer. The answer is one word, so the output cost is almost nothing. It
screens the text before a moderator sees it; images still need the moderator’s eyes.

**Google Cloud Translation (NMT)** ($20 per million characters, first 500,000 characters a month free).
Supports Lao. A book is roughly 3,000 characters, so about 160 books a month fit in the free allowance.
DeepL doesn’t support Lao. **Microsoft Translator** also supports Lao and has a bigger free tier
(2 million characters a month), but its paid price wasn’t shown without choosing a region. It’s a good
alternative if our Azure credits come through. Every translation is a draft a Lao speaker checks.

## Estimated AI cost per book

| Job | Estimate per book |
|---|---|
| Idea + description (Llama 8B) | under $0.001 |
| Scala Finish, one run (Haiku 4.5) | about $0.01 |
| Word meanings (Llama 8B, cached words free) | under $0.001 |
| Lao translation (Google NMT) | free within 500K chars a month, else about $0.06 |
| Illustrations: ~10 drafts + 6 finals (FLUX schnell + FLUX.2 dev) | about $0.20 |
| Safety check (Llama Guard) | under $0.001 |
| **Total** | **about $0.20–0.27**, almost all of it final art |

These are estimates from list prices. The admin view shows the measured cost once books are made.

## What to sign up for

| Service | Needed for | Account | What to do |
|---|---|---|---|
| **Cloudflare Workers AI** | Idea, description, meanings, simplify, safety, illustrations | ✅ Already have it (the `AI` binding is live on the `scalas-shelf` Worker) | Nothing yet. The free plan gives 10,000 neurons a day; going past that needs the **Workers Paid** plan, then $0.011 per 1,000 neurons. Cloudflare for Startups credits apply |
| **Anthropic API (Claude)** | Scala Finish (Haiku 4.5, Sonnet 5.5 fallback) | ❌ Needed | Create an account at console.anthropic.com, add billing or credits, create an API key, then set it as a Worker secret: from `api/`, `npx wrangler secret put ANTHROPIC_API_KEY` |
| **Google Cloud Translation** | Lao ↔ English | ❌ Needed | In a Google Cloud project, enable the Cloud Translation API and create an API key restricted to it: `npx wrangler secret put GOOGLE_TRANSLATE_KEY`. Google for Startups credits apply |
| **LanguageTool** | Spelling | ✅ No account needed | Free public API: 20 requests a minute and 20KB per request per IP. Workers share IPs, so if checks start failing, move to a paid LanguageTool plan |
| **Together AI** | Only if FLUX.2 dev’s characters aren’t consistent enough | Optional | Startup credits applied for. Would add `TOGETHER_API_KEY` |
| **Microsoft Translator** | Only as an alternative to Google Translation | Optional | Free tier 2 million characters a month |

## How translation and word meanings save money

- **Translation queue** (`api/src/services/translation.ts`): a book’s text is queued, and the queue is
  sent in batches: up to 128 texts and about 5,000 characters per request (Google’s limits). Google
  takes a list and returns the translations in the same order, so there are no dividers to get
  mistranslated. Google charges per character, so batching cuts requests, not price; **the cache**
  cuts price: every translated text is stored once and reused by every book. The queue is sent in
  the background right away, and a 5-minute Cron Trigger picks up anything left.
- **Word meanings** (`api/src/services/meanings.ts`): meanings writers type go into a shared
  dictionary (`word_meanings`, by word and level). Missing meanings are looked up there first; only
  the rest go to Scala, all in one request with the instructions sent once. Scala’s answers are
  saved, so a word is paid for once per level.
- Both show in the admin view (translation as characters, task “Translation”).

## What the code needs next

Routing is built (`api/src/services/ai-routes.ts`). Still to do:

1. ~~A routing table~~ done.
2. A Claude provider (the official `@anthropic-ai/sdk`) beside the Workers AI one, behind the same
   `TextModel` interface, so `metered()` records its tokens too.
3. Structured outputs for Scala Finish on Haiku, so the answer always matches our JSON shape.
4. ~~Prices for the new models~~ done (`PRICES_PER_MILLION`).

## Known gaps

- **Lao spelling:** LanguageTool doesn’t support Lao. Lao text needs a Lao-speaking reviewer until
  we find a Lao spell checker.
- **Lao audio:** none of the speech services checked (Google Text-to-Speech, Workers AI MeloTTS and
  Aura) list Lao. Lao audio is recorded by people.
- **Unconfirmed:** Microsoft Translator’s paid price, LanguageTool’s paid price, and Lao support in
  Workers AI’s Whisper and speech models.

## Sources (checked 2026-09-30)

- Workers AI pricing and free allowance: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Workers AI JSON mode (which models support it): https://developers.cloudflare.com/workers-ai/features/json-mode/
- m2m100 languages (Lao supported, not used): https://huggingface.co/facebook/m2m100_1.2B
- Claude models and prices: Anthropic API reference (models overview), cached 2026-09-25
- Together AI pricing: https://www.together.ai/pricing
- Google Cloud Translation pricing: https://cloud.google.com/translate/pricing · languages: https://docs.cloud.google.com/translate/docs/languages
- DeepL languages (no Lao): https://developers.deepl.com/docs/getting-started/supported-languages
- Microsoft Translator pricing: https://azure.microsoft.com/en-us/pricing/details/translator/ · languages: https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support
- LanguageTool public API limits: https://dev.languagetool.org/public-http-api · languages: https://dev.languagetool.org/languages
- Google Text-to-Speech voices (no Lao): https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types
