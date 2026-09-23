# Textweaver Project — File Map

> Read this to find the right file. Each section file is < 150 lines for token efficiency.

```
Textweaver/
├── DASHBOARD.md                     # 🔴 Read first — all actions sorted by deadline
├── idea.md                          # Core project idea (39 lines)
├── .agent/
│   ├── SKILL.md                     # Project context (compact)
│   └── FILE_MAP.md                  # This file
├── docs/
│   ├── grants/
│   │   ├── index.md                 # Master index — links to all grant proposals
│   │   ├── template/                # 8-section template + checklist for new grants
│   │   │   ├── index.md             # Structure + token-saving rules
│   │   │   ├── 01-problem.md       # Problem statement template
│   │   │   ├── 02-solution.md      # Solution & hypothesis template
│   │   │   ├── 03-innovation.md    # Innovation argument template
│   │   │   ├── 04-team.md          # Team & HR template
│   │   │   ├── 05-budget.md        # Budget template
│   │   │   ├── 06-timeline.md      # Milestone template
│   │   │   ├── 07-sustainability.md # Sustainability template
│   │   │   ├── 08-appendix.md      # Data & sources template
│   │   │   └── checklist.md        # Pre-submission checklist
│   │   ├── epic-megagrants/         # ✅ Complete — ready to submit
│   │   │   ├── index.md             # Landing page + submission checklist
│   │   │   ├── application.md       # Epic portal application form
│   │   │   ├── 01-problem-and-why-unreal.md  # Problem + why UE
│   │   │   ├── 02-technical-architecture.md  # Architecture (~180 lines)
│   │   │   ├── 03-team.md           # ADMAIS US + Laos + educators
│   │   │   ├── 04-competitive-landscape.md   # Competitive analysis
│   │   │   ├── 05-budget-and-milestones.md   # Budget + timeline
│   │   │   ├── 06-sustainability.md # Post-grant plan
│   │   │   └── 07-appendix.md       # Statistics & sources
│   │   ├── isif-asia/               # 🟡 Preparing for 2027
│   │   │   ├── index.md             # Landing page + section links
│   │   │   ├── 01-alignment.md     # ISIF alignment
│   │   │   ├── 02-problem.md       # Problem statement
│   │   │   ├── 03-solution.md      # Solution & hypothesis
│   │   │   ├── 04-innovation.md    # Innovation argument
│   │   │   ├── 05-team.md          # Team
│   │   │   ├── 06-budget.md        # 3-tier budget ($20K/$50K/$75K)
│   │   │   ├── 07-gender-inclusion.md  # ⬜ Needs writing
│   │   │   ├── 08-monitoring.md    # ⬜ M&E framework
│   │   │   ├── 09-appendix.md      # 🟡 Needs data
│   │   │   └── actions.md          # TODO list
│   │   ├── pcf/                     # 🟡 Inquiring about next cycle
│   │   │   ├── index.md             # Landing page + contact info
│   │   │   ├── 01-requirements.md  # Raw PCF template questions
│   │   │   ├── 02-problem.md       # Problem statement
│   │   │   ├── 03-solution.md      # Solution & design thinking
│   │   │   ├── 04-innovation.md    # Innovation argument
│   │   │   ├── 05-team.md          # Team
│   │   │   ├── 06-budget.md        # 🟡 Needs figures
│   │   │   └── actions.md          # TODO list
│   │   ├── usaid-div/               # 🔵 Waiting on prototype
│   │   │   ├── index.md             # Landing page + DIV model + fit analysis
│   │   │   ├── actions.md           # Stage 1 concept note TODO
│   │   │   ├── application-prep.md  # 15-question prep notes
│   │   │   ├── div-rfp.md           # RFP extracted to markdown
│   │   │   └── div-application.md   # Application form extracted
│   │   ├── unesco-pp/               # 🔵 Tracking — 2028–2029 cycle
│   │   │   └── index.md             # Research + alignment + Lao NatCom path
│   │   └── future/                   # Research archive
│   │       ├── research-plan.md     # 8-grant batch research (complete ✅)
│   │       └── pursuit-plan.md      # Compiled pursuit plan
│   └── plans/
│       ├── ARCHITECTURE.md          # 🔴 Master architecture: providers, costs, integration
│       ├── sequential-plan.md       # Grant execution plan
│       ├── build-plan.md            # 15-step build plan with status
│       ├── backend-architecture.md  # Workers gateway + DB functions + RunPod backend
│       ├── ai-architecture.md       # Self-hosted Llama 3 + SDXL on GPU
│       ├── gpu-costs.md             # GPU price comparison
│       └── dev-workflow.md          # Local development + Docker
```

## Quick Find

| What you need | Start with |
|---------------|-----------|
| What to do right now | `DASHBOARD.md` |
| Find a grant section | `docs/grants/<grant>/index.md` |
| Start a new grant | `docs/grants/template/index.md` |
| Architecture | `docs/plans/ARCHITECTURE.md` |
| Build plan | `docs/plans/build-plan.md` |
| Core idea | `idea.md` |
