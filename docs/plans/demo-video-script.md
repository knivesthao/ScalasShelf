# Demo Video — Narration Script

> Written 2026-09-24 for the four clips made by `npm run record` (`./recordings/`, 860×1864 portrait).
> Timing assumes a calm pace of about **2.3 words per second** (140 words per minute), easy to follow for
> reviewers who aren't native English speakers. Rehearse with a stopwatch; if you run long, cut the words in *[brackets]*.

**Buffer rule:** every clip starts and ends with at least **1 second of silence**. Narration only happens inside
the "speak" window. When clips are joined, the buffers leave about 2 seconds of quiet between lines, which reads as
natural pauses.

**Honesty rule:** the Studio's illustration step is switched off right now. The narration never says AI makes the art,
only that stories are illustrated, and the outro names illustration as what comes next.

---

## Core demo (≈ 40 seconds, footage only)

| Clip | Length | Speak window | On screen | Narration | Words |
|---|---|---|---|---|---|
| 1. Read | 18.5 s | 1.0–17.5 s | Library → book page | **(at 1.0 s)** "Textweaver is a free library of illustrated English comics for students in Laos." | 13 |
| | | | Tap "market" → meaning pops up (≈ 7.5 s) | **(at 7.5 s)** "Tap any word to see what it means." | 8 |
| | | | Scroll panels → quiz (≈ 11–17 s) | **(at 11.5 s)** "Every story ends with a quick quiz on the new words." | 10 |
| 2. Offline | 5.6 s | 1.0–4.6 s | Download → My Library | **(at 1.0 s)** "Download once. Read anywhere, even offline." | 7 |
| 3. Studio: write | 8.2 s | 1.0–7.2 s | Typing a new line; hard words get flagged | **(at 1.0 s)** "In the Studio, writers build stories, and words above the student's level are flagged." | 14 |
| 4. Studio: teach | 7.2 s | 1.0–6.2 s | Starring words → quiz drafts itself | **(at 1.0 s)** "Pick the words to teach, and the quiz writes itself." | 10 |

Total: 62 words ≈ 27 seconds of speech over ≈ 40 seconds of video. Clip 3 is the tightest (its line ends at ≈ 7.1 s
against a 7.2 s window); if you speak slowly, drop "the student's" → "words above the level are flagged".

**Cue check for clip 1** (from the recording script's pauses): the library shows for about 1.5 s, the book page about
2 s, the first panel about 3 s, the word popup about 2 s, the next two panels about 3 s each, and the quiz for the last
2 s. The first line spans the library and book page; if it runs into the reader, that's fine.

---

## Optional intro and outro (for a 60- or 90-second version)

Use a title card or a still (the library screen or the "Morning Market" cover) behind these, with the same 1-second
buffers at the start and end of the whole video.

**Intro, 60-second version (≈ 7 s):**
> "Students in Laos have few books for learning English, and the internet is often slow."
> *(15 words)*

**Intro, 90-second version (≈ 14 s, or ≈ 10 s without the bracketed line), use instead of the above:**
> "Students in Laos have very few books for learning English. Many live where the internet is slow or expensive,
> and they read on low-cost phones. *[We're ADMAIS, and we built Textweaver to change that.]*"
> *(32 words; 22 without the bracketed line)*

**Outro, 60-second version (≈ 7.5 s):**
> "It's free and works offline. Next: illustrations from the writer's words, and a pilot in Lao schools."
> *(17 words)*

**Outro, 90-second version (≈ 15 s, or ≈ 13 s without the bracketed line), use instead of the above:**
> "Textweaver is free and works offline, on the phones students already have. Next, we're adding illustrations made
> from the writer's words, reading aloud, and a pilot with partner schools in Laos. *[Try it today at the link below.]*"
> *(35 words; 29 without the bracketed line)*

| Version | Sections | Approx. length |
|---|---|---|
| 40 s | Core demo only | 40 s |
| 60 s | 1 s + intro (7 s) + core (40 s) + outro (7.5 s) + 1 s | ≈ 57 s |
| 90 s | 1 s + intro (14 s) + core (40 s) + outro (15 s) + 1 s = 71 s; fill the rest by holding on the title and last frame, or a short music intro | ≈ 71–90 s |

---

## Recording tips

- Record the voice separately and line it up to the cue times in an editor; it's easier than narrating live.
- Leave the 1-second buffers silent. Background music can run under them, faded low.
- Show the live link on the last frame: **textweaver.knives-thao.workers.dev**
- If a grant specifies a length, fill the extra time with the intro/outro lines above, not by speeding up the narration.
- To re-record the footage: delete `.data/`, run `npm run dev`, then `npm run record`. Clip lengths can change slightly;
  re-check them against this table.
