# Textweaver Project Context

> AI-generated comics & interactive books platform for Laos
> Reading materials for English + Lao language learners
> Audiences: Admin | Users (Lao citizens) | Publishers/Creators
> Companies: ADMAIS US + ADMAIS Laos

## Model Rules

| Model | Use For |
|-------|---------|
| **@flash** | Reads, writes, grep, formatting, budget tables, spell-check, list generation, simple terminal |
| **@pro** | Persuasive narrative, technical architecture, strategy, competitive analysis, critical review |

## Quick Reference

- **Dashboard** → `DASHBOARD.md` (read this first — all actions, sorted by deadline)
- **File map** → `.agent/FILE_MAP.md` (find any file)
- **Sequential plan** → `docs/plans/sequential-plan.md` (phase-by-phase execution)
- **Grants index** → `docs/grants/index.md` (master list + links)
- **Grant template** → `docs/grants/template/` (copy for new grants)
- **Token recovery** → `@token-saver` (when you hit the 1M limit)

## Token-Saving Rules

1. Read `DASHBOARD.md` — current priorities and deadlines
2. Read only the section file you need (each < 150 lines)
3. Never read full proposals — use `index.md` to find the right section
4. Set `max_tokens` to 4K-16K (not 384K default)
5. Start a fresh conversation when switching models

## Session End

Summarize: "Changes made. Next step. Flag @pro or @flash."
