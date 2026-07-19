# Dawn Codex context (handoff)

Compressed memory from the long Codex session so Cursor can pick up without replaying the full chat log.

**Hackathon due:** Tuesday  
**Codex session ID (for submission):** `019f7a05-eae8-7851-993f-013d83357327`  
Also stored in `CODEX_SESSION_ID.md` and a Cursor personal rule titled “Dawn Codex session ID”.

---

## Product positioning

- **Name / line:** Dawn: Hospital Activation Made Clear  
- **What it is:** A hospital site-activation tool for a lean startup team (CEO + one support user).  
- **Problem it solves:** Important hospital onboarding steps get lost in messy notes, voice, WhatsApp, and email—so kickoffs stall.  
- **Core promise:** Nothing important slips. Dawn suggests updates; people always approve.  
- **Not:** A generic CRM, task planner, or auto-updating AI that writes data without review.

### Demo “wow” moments

1. Paste or speak a messy note → Dawn shows clear Current → Suggested changes → edit → approve → hospital updates + audit trail.  
2. Human-in-control: propose Pilot → Active but warn when confirmation is needed; dismiss or edit.  
3. New hospital / contact from unstructured text.  
4. Multi-hospital notes split into the right hospitals.  
5. Export zip (spreadsheet + attachments) as the “reviewable and exportable” close.

Demo scripts live at: `../outputs/dawn-hackathon-demo-scripts.md`

---

## Active project paths

| What | Path |
|------|------|
| **Use this clone** | `C:\Users\Jeremy\Documents\Codex\2026-07-19\iw-an\dawn` |
| Older / stale clone | `C:\Users\Jeremy\Documents\Codex\dawn` (prefer the path above) |
| Parent Codex folder | `C:\Users\Jeremy\Documents\Codex\2026-07-19\iw-an` |
| App (Next.js) | `dawn-scaffold\` |
| Local URL | http://127.0.0.1:3000 |
| GitHub | `jeremylowzhiyancode/dawn` |
| Branch | `agent/dawn-ui-polish` (last known push ~`4929b84`; local uncommitted polish may exist) |

---

## Architecture (current demo)

- **Client-side rule / regex “AI”** in `dawn-scaffold/src/app/DawnApp.tsx` — free local demo, **no paid LLM API**.  
- Suggestions are approval-first: accept / edit / dismiss only.  
- UI drawers and panels in `dawn-scaffold/src/app/Drawers.tsx`.  
- Styling in `dawn-scaffold/src/app/globals.css`.  
- Entry: `page.tsx` → `DawnApp`.  
- Demo date anchor in code is around Singapore (+08:00).  
- Data is in-browser / local demo state (not a production DB yet).

Key types/concepts: hospitals, contacts, stages (`Interest` → `Kickoff` → `Pilot` → `Active`), awaiting (us / hospital), priorities, audit entries, stored files, evidence.

---

## Feature inventory

### Working (from Codex session)

- Priority dashboard  
- Ask Dawn focused ChatGPT-style chat  
- Approve / edit / dismiss suggestions  
- New hospital and new contact from notes  
- Update existing contact  
- Multi-hospital note splitting  
- Drag-to-rank (priority)  
- File storage / attachments for traceability  
- Export zip (xlsx + attachments)  
- Synthetic demo hospitals and voice/note demos  

### Incomplete / next

- PDF / Excel / Word / PPT / image **text extraction** (+ OCR)  
- Singapore timezone polish if still unfinished  
- Demo readiness / polish for hackathon presentation  
- **Do not deploy** until database, auth, and real AI choices are decided  

---

## Test assets (`../outputs/`)

| Asset | Purpose |
|-------|---------|
| `dawn-hackathon-demo-scripts.md` | Voice/paste demo scripts + 2-minute pitch sequence |
| `dawn-ai-test-pack.md` | AI behavior test cases |
| `northbridge-eaa-demo.txt` | Sample note for Northbridge |
| `lakeside-pilot-tracker-demo.csv` | Sample tracker data |
| `dawn-pdf-tests/01-new-hospital-and-contact.pdf` | PDF extraction test |
| `dawn-pdf-tests/02-existing-contact-correction.pdf` | PDF extraction test |
| `dawn-pdf-tests/03-stage-and-next-step-update.pdf` | PDF extraction test |
| `dawn-pdf-tests/04-multi-hospital-mixed-signals.pdf` | PDF extraction test |

---

## Known limitations (session)

- “AI” is pattern matching for demos—not a real model. Edge cases and messy language can miss.  
- File **upload/storage** works better than deep document **content extraction** (PDF etc. still TODO).  
- No production auth / shared database yet.  
- Do not treat deploy as in scope until those decisions are made.  
- Prefer the `2026-07-19\iw-an\dawn` tree; the older `Documents\Codex\dawn` copy can confuse work.

---

## Recommended next steps (hackathon)

1. Finish or clearly scope document extraction (at least PDF demo path using `outputs/dawn-pdf-tests`).  
2. Run the 2-minute demo sequence from `dawn-hackathon-demo-scripts.md` end-to-end on localhost.  
3. Fix any Singapore timezone / “today” display quirks if they show in the demo.  
4. Polish UI only where it helps the live demo; avoid big refactors.  
5. Keep session ID ready for submission; push UI polish branch when ready.  
6. Defer deploy / paid AI / auth until after the hackathon demo path is solid.

---

## User preference

Explain in simple, non-technical language. Jeremy is a beginner with this stack.

---

## How to resume in a new chat

Ask: “What’s the Dawn context?” or “Where did we leave off?”  
Short memory is also in the Cursor personal rule **Dawn hackathon project context**.
