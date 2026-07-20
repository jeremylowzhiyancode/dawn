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
5. Drop a PDF / Excel / Word / image → Dawn reads text locally (OCR for images / scanned first page) → suggestions for approval.  
6. Export zip (spreadsheet + attachments) as the “reviewable and exportable” close.

Demo scripts live at: `../outputs/dawn-hackathon-demo-scripts.md`  
Bundled demo files: `dawn-scaffold/public/demo-files/`

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
| Branch | `cursor/dawn-doc-extraction-7f72` (continues from `agent/dawn-ui-polish` / `eb160b2`) |

---

## Architecture (current demo)

- **Client-side rule / regex “AI”** in `dawn-scaffold/src/app/DawnApp.tsx` — free local demo, **no paid LLM API**.  
- File text extraction in `dawn-scaffold/src/app/fileExtraction.ts` (pdf.js + tesseract.js OCR, plus Excel/Word/PPT/text).  
- Suggestions are approval-first: accept / edit / dismiss only.  
- UI drawers and panels in `dawn-scaffold/src/app/Drawers.tsx`.  
- Styling in `dawn-scaffold/src/app/globals.css`.  
- Entry: `page.tsx` → `DawnApp`.  
- Timestamps use Singapore time (`Asia/Singapore`, `en-SG`).  
- Data is in-browser / local demo state (not a production DB yet).  
- Static export (`output: "export"`) — keep extraction in the browser.

Key types/concepts: hospitals, contacts, stages (`Interest` → `Kickoff` → `Pilot` → `Active`), awaiting (us / hospital), priorities, audit entries, stored files, evidence.

---

## Feature inventory

### Working

- Priority dashboard  
- Ask Dawn focused ChatGPT-style chat  
- Approve / edit / dismiss suggestions  
- New hospital and new contact from notes  
- Update existing contact  
- Multi-hospital note splitting  
- Drag-to-rank (priority)  
- File storage / attachments for traceability  
- Export zip (xlsx + attachments)  
- Local document text extraction (PDF / Excel / Word / PPT / text / CSV)  
- On-device OCR for images and scanned PDF first page  
- Singapore timezone formatting  
- Synthetic demo hospitals and voice/note demos  

### Incomplete / next

- Demo readiness / polish for hackathon presentation (run the 2-minute script end-to-end)  
- Deeper OCR quality tuning if scanned demos are hard to read  
- **Do not deploy** until database, auth, and real AI choices are decided  

---

## Test assets

| Asset | Purpose |
|-------|---------|
| `dawn-scaffold/public/demo-files/*.pdf` | PDF extraction demos |
| `dawn-scaffold/public/demo-files/northbridge-eaa-demo.txt` | Sample note for Northbridge |
| `dawn-scaffold/public/demo-files/lakeside-pilot-tracker-demo.csv` | Sample tracker data |
| `../outputs/dawn-hackathon-demo-scripts.md` | Voice/paste demo scripts + 2-minute pitch sequence (if present locally) |

---

## Known limitations (session)

- “AI” is pattern matching for demos—not a real model. Edge cases and messy language can miss.  
- OCR can be slow the first time and may misread messy handwriting.  
- No production auth / shared database yet.  
- Do not treat deploy as in scope until those decisions are made.  

---

## Recommended next steps (hackathon)

1. Run localhost and attach `public/demo-files/03-stage-and-next-step-update.pdf` through Ask Dawn.  
2. Run the 2-minute demo sequence end-to-end.  
3. Polish UI only where it helps the live demo; avoid big refactors.  
4. Keep session ID ready for submission.  
5. Defer deploy / paid AI / auth until after the hackathon demo path is solid.

---

## User preference

Explain in simple, non-technical language. Jeremy is a beginner with this stack.

---

## How to resume in a new chat

Ask: “What’s the Dawn context?” or “Where did we leave off?”  
Short memory is also in the Cursor personal rule **Dawn hackathon project context**.
