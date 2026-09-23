# Textweaver Project Page

A self-contained, static project page for **Textweaver (Textweaver)**, built for the ADMAIS company site.

## What's here

```
website/
├── index.html      ← the full project page (open this)
├── PROMPTS.md      ← AI image prompts to generate the artwork
└── images/
    └── README.md   ← where to drop the generated images
```

## How to use

1. **Copy the whole `website/` folder** into your ADMAIS project (or serve it anywhere static).
2. **Point to the folder** — `index.html` is the entry page. It works immediately with styled placeholders.
3. **Generate the images** using the prompts in `PROMPTS.md`.
4. **Drop the images into `images/`** using the filenames listed in `PROMPTS.md` (e.g. `hero.jpg`, `problem.jpg`, `pipeline.jpg`, `team.jpg`).
5. **Swap the placeholders** — replace each `<div class="img-placeholder">…</div>` in `index.html` with:
   ```html
   <img src="images/hero.jpg" alt="Hero" style="width:100%;height:100%;object-fit:cover;display:block;" />
   ```
   (or wire it up however your site renders images).

## Notes

- Single HTML file, all CSS inline — no build step, no dependencies.
- Dark theme matches the Textweaver app palette (`#0f0f23`, `#ff6b6b`, `#4ecdc4`, `#ffb347`).
- Fully responsive, mobile-first.
- Content is grant-ready: problem, solution, pipeline, features, stack, team, impact, and the $41,671 / 12-month Epic MegaGrant request.
