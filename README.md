# Dawn AI — Hospital Activation Made Clear

**Dawn AI** helps lean health-tech teams track hospital onboarding — from first interest through kickoff, pilot, and active use — without losing the thread when things get messy.

- **Live demo:** https://dawn-scaffold.vercel.app  
- **Demo video:** https://www.youtube.com/watch?v=OcC_V1DlsHA  
- **Codex session ID:** `019f7a05-eae8-7851-993f-013d83357327`

---

## The problem

When a hospital says yes, kickoff can still slip by months if a small team loses track of the next step. Spreadsheets and generic CRMs do not fit how we actually work: voice notes, quick emails, partner CSVs, and call notes — not clean forms.

Dawn is built for that reality. One dashboard shows what is **waiting on us** vs **waiting on the hospital**, every hospital has a clear next step, and nothing updates until a human approves it.

---

## What it does

- **Priority dashboard** — stages from Interest → Kickoff → Pilot → Active, with urgency at a glance  
- **Ask Dawn** — chat or voice: *“what are my priorities today?”*, *“open Cedar Bay”*, *“Harborview signed the LOI”*  
- **File drop** — drop CSV or notes; GPT suggests new hospitals, updates, and contacts  
- **Approve-first AI** — every suggestion can be approved, edited, or dismissed before anything saves  
- **Audit trail** — approved changes logged under the demo user  
- **Export** — download all Dawn data and files as a zip  

---

## Quick start (local)

```bash
cd dawn-scaffold
npm install
npm run dev
```

Open http://127.0.0.1:3000

### Try the demo files

Sample files are in `dawn-scaffold/sample-drops/`:

- `new-hospital-leads-mixed.csv` — main demo drop; approve one new hospital and one update  
- `existing-update-harborview.docx` — Harborview LOI update (includes intentional decoy noise to test parsing)  

### AI setup (optional for local GPT)

Copy `dawn-scaffold/.env.example` to `dawn-scaffold/.env.local` and pick a provider (Ollama, OpenAI, or GitHub Models). Restart `npm run dev` after changes.

Core flows still work without GPT: priorities use local rules, and CSV parsing has structured fallbacks.

---

## How we built it with Codex and GPT-5.6

This project was built for **OpenAI Build Week**. **Codex** (GPT-5.6) was the primary development partner — spec-driven from our onboarding plan through to deploy.

**Ask Dawn at runtime** uses **GPT-4.1 mini** (via GitHub Models) through `/api/parse` for chat and file parsing. Local rules back up the model when it is offline or unconfigured.

### Where Codex accelerated the workflow

- **Spec-driven start** — We gave Codex our hospital onboarding plan and business context so the product matched real process stages, not a generic task app.  
- **End-to-end implementation** — Codex scaffolded the Next.js app, built the dashboard, drawers, chat panel, file ingest, and `/api/parse` route in rapid iteration sessions.  
- **Bug fixes under deadline** — Layout overlap (chat vs notepad), hospital names wrongly detected as contacts, decoy rows in CSVs, LOI vs EAA confusion, and TypeScript build errors were diagnosed and fixed with Codex in the same session.  
- **Demo readiness** — Codex helped trim the demo to reliable paths (CSV + chat), polish copy, and deploy to Vercel with production env vars.  

### Key product decisions (human + Codex)

| Decision | Why |
|----------|-----|
| **Approve-first AI** | Messy real-world input must never auto-write records. Trust and auditability come first. |
| **“Waiting on us” vs hospital** | The worst failure mode is a hospital ready to move and our team forgetting the next step. |
| **Sunrise progress UI** | Stage progress should communicate activation status, not act as decoration. |
| **One question per screen** | Busy lean team — no dense menus or hidden critical actions. |
| **Local rules + GPT** | GPT suggests; local parsing backs up flaky model output so demos stay reliable. |

### Key engineering decisions

- **Next.js App Router** with a server route at `/api/parse` so GPT runs server-side (API keys stay off the client).  
- **Structured parsers first** for CSV and known formats; GPT enriches and handles free-text notes.  
- **Browser demo data** for the hackathon MVP — no database setup required for judges to run it.  
- **Deployed on Vercel** at https://dawn-scaffold.vercel.app with AI env vars for live GPT.  

### How GPT-4.1 mini contributed (runtime)

GPT-4.1 mini (via `/api/parse`) handles:

- **Ask Dawn Q&A** — priorities, hospital lookup, and natural-language updates  
- **File parsing** — reading messy CSV rows and notes into structured suggestions (hospital, stage, next step, contacts, country)  
- **Prompt guardrails** — no hospital names as contacts; distinguish LOI vs EAA; ignore decoy sections in noisy files  

Every GPT output flows through the same **approve / edit / dismiss** UI. Codex implemented both the API integration and the client-side suggestion pipeline.

### Design collaboration

Codex helped translate “idiotproof for a busy team, polished enough for a CEO” into concrete UI: warm sunrise gradients, priority table, expandable Ask Dawn panel, one-click mic, and max-two-click edits. Business deck and onboarding materials informed stage labels and copy.

---

## Built with

**Codex** · **GPT-5.6** *(build)* · **GPT-4.1 mini** *(Ask Dawn)* · **Next.js** · **React** · **TypeScript** · **Tailwind CSS** · **Vercel** · Cursor *(final edits)*

Libraries: `xlsx` (spreadsheets), `jszip` (export), Web Speech API (voice)

---

## Project structure

```
dawn/
└── dawn-scaffold/          # Next.js app (run from here)
    ├── src/app/            # DawnApp, Drawers, API routes
    └── sample-drops/       # Demo CSV and Word files
```

---

## License

See repository license file. Hackathon submission: https://github.com/jeremylowzhiyancode/dawn
