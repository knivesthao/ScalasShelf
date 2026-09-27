# Pilot build plan: from live design to a pilot-ready app

> Written 2026-09-27. Goal: finish Textweaver for the 12-month pilot in 1–3 months, matching what
> the funding documents promise (ADMAIS repo: `public/decks/textweaver-save-the-children.html`,
> the supplement, and `docs/funding/applications.md`).
> Architecture background: `backend-architecture.md`. This plan replaces the self-hosted GPU idea in
> `ai-architecture.md` with a routed, multi-provider AI layer.

## What the pilot needs

| # | Gap | Promised in | Weeks |
|---|---|---|---|
| 1 | **Staff sign-in** and saving Studio projects to the server | Creator workflow; two paid content creators | 1–2 |
| 2 | **Review before publishing**: the program director approves every book | Safeguarding (§4.4), the published child safeguarding policy | 1–2 |
| 3 | **Reader-only app** for the shared pilot phones (no Studio) | "Read-only pilot app" (§4.4) | 1–2 |
| 4 | **AI illustration** (currently switched off; screens use demo art) | "A book in under a day" | 3–5 |
| 5 | **AI usage and cost tracking per book** | §5.2; progress plan (monthly AI cost per book) | 3–5 |
| 6 | **Translation and writing help** (Lao ↔ English) | Creator workflow | 3–5 |
| 7 | **Lao interface and a Lao level check** | Lao and English books | 6–8 |
| 8 | **Anonymous usage counts** (books opened and finished per phone) | Monthly measurement (§6.2) | 6–8 |
| 9 | **Google Play package** of the reader-only app | Month-3 milestone | 6–8 |

Order: sign-in and review first because they need **no paid services**, while AI credits (Cloudflare,
Together AI, Microsoft, Claude) are still being approved.

---

## Weeks 1–2: staff sign-in, review, reader-only app

### Who signs in

Only **staff**: content creators, the program director (reviewer) and admins. Readers never sign
in. That respects the constraint in `backend-architecture.md` that many people in Laos don't use
email: it applies to readers, and readers have no accounts. Staff are hired and all have email.

- **Method:** passwordless email link, the same design as the ADMAIS dashboard: a one-time link,
  valid 15 minutes, swapped for a session cookie. Only SHA-256 hashes of links and sessions are
  stored. There's no password hashing, so it fits the free Workers plan's CPU limit.
- **Allowlist:** a `staff` table (email, name, role). Only listed emails can sign in. Roles:
  - `creator`: writes books and submits them for review
  - `reviewer`: approves books or sends them back with a note (the program director)
  - `admin`: everything, plus managing staff
- **Email:** sent through Resend from `noreply@admais.xyz` (the domain is already verified for
  ADMAIS). Locally, links print to the terminal.

### Review workflow

```
draft ──submit──▶ in_review ──approve──▶ published (in the library)
  ▲                    │
  └──request changes───┘ (with a note to the writer)
```

- Creators **submit** a book (its package is stored with the project). They can no longer publish
  directly.
- Reviewers see a **review queue**, read the book exactly as a child would, then **approve**
  (publish to the library) or **request changes** with a note.
- Every decision records who reviewed it and when, for the safeguarding audit trail.

### Reader-only app

A separate build (`npm run build:reader`) with the Studio removed entirely: no Studio links, no
Studio routes. This is the version for the shared pilot phones and, later, Google Play. Creators use
the full web app.

---

## Weeks 3–5: the AI layer

### Principles

1. **No AI where rules work.** Reading-level checks, quiz drafting from chosen words, and packaging
   are deterministic code. AI is for the jobs rules can't do.
2. **The cheapest model that passes the quality bar,** per task. Escalate to a stronger model only
   when the cheap one fails a check, or for final output.
3. **Never pay twice.** Cache results: word meanings in a shared dictionary, translations by
   sentence, image prompts by scene.
4. **Humans approve.** Every book passes the reviewer; AI output is always a draft.
5. **Track every call.** Tokens, model and cost per call, rolled up per book, so the estimate in
   the budget becomes a measured cost per book.
6. **Provider-independent.** One interface; each task maps to a provider and model in config, so
   whichever credits arrive (Cloudflare Workers AI, Together AI, Microsoft Azure, Anthropic) can be
   used without code changes.

### Task → model routing

| Task | Why AI | Default model (cheap) | Escalation / final | Cached by |
|---|---|---|---|---|
| **Scene → image instructions** (turn a writer's scene description into a precise, consistent image prompt with character notes) | Needs language understanding and structured output | Small, fast model, e.g. **Claude Haiku 4.5** or an open 8B model on Workers AI / Together | Retry once on invalid JSON; no bigger model needed | Scene text + character sheet |
| **Illustration** | Original art | **FLUX.1 schnell** (Workers AI or Together) for drafts, a few cents or less per image | A higher-quality FLUX model for the final approved art | Image prompt + seed |
| **Translation** Lao ↔ English | Lao is low-resource; quality matters | **Claude Sonnet 5**: strong multilingual quality at a mid-tier price | Human edit plus reviewer | Sentence + direction |
| **Simplify for a level** (rewrite a flagged line more simply) | Rewriting | **Claude Haiku 4.5** | Sonnet 5 if the rewrite still fails the level check | Line + level |
| **Word meanings** (simple definitions for taught words) | Short definitions for children | **Claude Haiku 4.5** | None | Shared dictionary: word + language + level. Most words are paid for once, ever |
| **Quiz distractors** (wrong answers for the auto-drafted quiz) | Plausible wrong answers | **Claude Haiku 4.5** | None | Word set |
| **Safety check** of text and images before review | Catch unsafe content early | **Llama Guard** (Workers AI, very cheap) | Flags go to the reviewer | Content hash |
| Reading-level check, quiz structure, packaging | — | **No AI** (rules and word lists) | — | — |

Model IDs are Anthropic's current names (`claude-haiku-4-5`, `claude-sonnet-5`). Open-model IDs
depend on the provider (Workers AI `@cf/...`, Together `black-forest-labs/...`) and live in one
config file.

### Cost controls

- **Batching:** word meanings and quiz distractors for a whole book go in one request.
- **Prompt caching** for the long, fixed system prompts (style guide, character sheets).
- **Per-book budget:** a soft cap (for example US$0.50 a book) with a warning in the Studio.
- **Draft vs final:** cheap image drafts while writing; the expensive final render only after the
  writer is happy.

### Usage tracking (`ai_usage` table)

One row per AI call: book, task, provider, model, input and output tokens (or image count), cost in
US cents, whether it was a cache hit, and when. The Studio shows cost per book, and the admin view
shows monthly totals by task and model. That feeds the quarterly financial reports and the "measured
cost per book" promised to funders.

---

## Weeks 6–8: pilot-ready

- **Lao interface:** all reader and Studio text in Lao and English, with a language switch.
- **Lao level check:** a Lao word-frequency list for the reading levels (replacing AI for this).
- **Anonymous usage counts:** books opened and finished, per shared phone, with no personal data.
  Stored locally and sent in batches when online.
- **Google Play:** package the reader-only build (Trusted Web Activity), with the one-time
  US$25 developer account.
- **Test on a real low-cost Android phone,** offline.

## Status

- [x] Plan written (2026-09-27)
- [x] Weeks 1–2: staff sign-in, review workflow, reader-only build (built and tested 2026-09-27; not deployed)
  - To go live: from `api/`, `npx wrangler d1 migrations apply textweaver --remote`; `npx wrangler secret put RESEND_API_KEY`; add staff at `/studio/staff`; deploy
  - Reader-only build for Google Play: `npm run build:reader` (output in `dist-reader/`)
- [ ] Weeks 3–5: AI layer, illustration, usage tracking, translation
- [ ] Weeks 6–8: Lao interface and level check, usage counts, Google Play, device testing
