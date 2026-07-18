# Dawn Product Requirements

## Positioning

Dawn is a hospital site activation tool for a busy, lean startup team. It is built for the messy reality of hospital site activation and should feel healthcare-specific, not like a generic assistant, CRM, or task planner.

Default marketing line: **Dawn: Hospital Activation Made Clear**.

Core promise: nothing important slips. The nightmare scenario Dawn prevents is a hospital agreeing to sign off, then waiting months for kickoff because the startup forgot, lost the thread, or missed the next activation step.

## Phase 1 Workflow

- Primary input: messy CEO notes, especially real mic-recorded voice notes.
- Also support messy written notes and email notes.
- Secondary input: file/drop upload.
- The fastest way to use Dawn is talking to it through a persistent one-click mic or Ask Dawn control.
- Real mic magic is required for MVP, not only simulated voice, but clicks must stay extremely low.
- AI reads messy inputs and suggests hospital/contact/stage/followup/status/date changes.
- AI never updates records automatically.
- Every suggestion can be accepted, edited, or discarded.
- If a suggestion is mostly accurate, the user can tweak one or two fields before approving.
- Every approved update stores timestamp, source evidence, and approved-by demo user.
- Add undo for any approval.
- If a new suggestion conflicts with existing data, Dawn flags the conflict and asks the user to confirm replacement.
- If a date is uncertain or relative, Dawn asks a clarifying question or shows an easy date picker. Keep source date, event date, due date, and approval timestamp conceptually distinct.

## Core Views

- **Snapshot** is the default landing page after login and answers: where are we?
- **Followup** is the practical action queue and answers: what cannot slip?
- Add a simple top-right default view selector: Snapshot or Followup. Do not build a complex settings page.

Followup shows who needs emailing, what documents need sending, what kickoff needs scheduling, who has waited too long, and what next action cannot slip.

## Healthcare-Specific Requirements

- Keep hospital activation stages central: Signed LOI, Signed EAA, Kickoff invited, Kickoff scheduled, Kickoff completed, Pilot initiated, Pilot completed, 1 month check-in, 2 month check-in, 3 month check-in.
- Include hospital roles: PI, coordinator, director, admin/legal, feasibility manager, clinical operations.
- Detect agreement-to-kickoff delay, especially signed LOI/EAA without scheduled kickoff.
- Distinguish **waiting on us** from **waiting on hospital**.
- **Waiting on us** should be highlighted urgently/ASAP.
- **Waiting on hospital** is softer, but after a stage-dependent period, default around one week, Dawn should suggest a polite reminder.
- Preserve evidence trails for messy inputs, suggested updates, human approvals, and audit history.
- Keep post-pilot check-ins visible without making the product feel like project-management theatre.
- CEO owns hospital communications, emails, and meeting scheduling for MVP. Do not over-model other internal roles.

## Stage Timing

- After LOI is sent or signed: allow about 2 weeks for hospital/legal to figure out requirements and sign off on EAA.
- After EAA is signed: maximum 1 week followup window to keep the hospital warm and schedule kickoff. If no kickoff is scheduled after 1 week, highlight ASAP, especially if waiting on us.
- After kickoff completed: pilot can take 1-2 months because it depends on the hospital receiving a feasibility from CRO/sponsor on the platform, or using a feasibility PDF from a CRO and completing/submitting a form in the platform. Pilot completion means the hospital completes one feasibility through either route.
- After pilot completed: keep future scope light. Monthly check-ins are periodic issue checks only; do not overbuild post-pilot for MVP.

## Sun Mood Signal

Use time-based sun mood for MVP:

- 0-7 days: bright and healthy.
- 8-14 days: light haze.
- 15-21 days: amber/cloudy.
- 22-30 days: dim/worried.
- 30+ days: dark/sad/critical.

The sun mood is a professional activation-health signal, not childish decoration. It should quickly tell the CEO when a site is getting colder and needs activation or followup soon.

Use purely date-based warmth/cooling for MVP. Do not use sentiment analysis yet; sentiment can remain a future consideration.

## Demo And QA Notes

- Browser/Chrome testing is for QA and demo polish only: page loads, buttons work, UI fits, no overlaps, no console errors, responsive layout, and clean screenshots.
- Demo data must be anonymous and must not include company names, patient data, vendor data, or identifying hospital/customer names.
