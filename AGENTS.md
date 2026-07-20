# Dawn Codex Rules

- Product name: Dawn.
- Use `https://github.com/jeremylowzhiyancode/dawn` as the canonical GitHub repository URL for Dawn.
- Default marketing line: Dawn: Hospital Activation Made Clear.
- Product/design north star: Dawn must be easy enough that any kid could use it, polished enough that a CEO trusts it, and beautiful enough that a busy lean team wants to come back.
- Keep Dawn idiotproof first: no complicated setup, no dense menus, no hidden important actions.
- Max clarity: every screen answers one question only.
- Dawn-themed UI: warm sunrise progress, soft morning gradients, clean white space, and bright but calm energy.
- Busy-team friendly interactions: one-click mic, max-two-click edits, tiny priority list, and an obvious next action.
- Make it reusable and inviting, not admin homework.
- Sunrise visuals must communicate hospital activation progress, not act as decoration.
- Design specifically for a busy, lean startup team with very limited time and resources.
- Worst-case scenario to prevent: a hospital signs off or agrees to move forward, then waits months for kickoff because the startup forgot or lost the thread.
- Status must distinguish "waiting on us" from "waiting on hospital"; "waiting on us" is the critical failure mode.
- Phase 1 inputs are voice notes, messy written notes, and email notes; file upload is secondary.
- AI must suggest changes only. A human must be able to accept, edit, or discard every suggestion before records change.
- Default post-login view is Snapshot, with a simple top-right Default view selector for Snapshot or Followup.
- Use simple demo login for MVP and record the demo user in audit trails.
- Before major product or implementation decisions, check recent related side chats for updated user answers and constraints.
- Make periodic Git saves at stable checkpoints.
- Do not commit unless security checks pass first.
- Security checks must include at minimum:
  - `git status --short --branch`
  - scan staged and unstaged files for likely secrets, API keys, tokens, and private data
  - confirm `.env`, local logs, generated secrets, and private user data are not staged
  - run available project checks or tests when they exist
- If a security check cannot be run, say so before committing.

## Cursor Cloud specific instructions

- The app is a single Next.js 16 (Turbopack, React 19) project living in `dawn-scaffold/`. All commands run from there, not the repo root.
- Standard scripts are in `dawn-scaffold/package.json`: `npm run dev` (dev server on http://localhost:3000), `npm run build`, `npm run start`, `npm run lint`.
- No login/auth screen and no backend/database — the app loads straight into the workspace and all state (hospitals, notes, suggestions) is in-memory in the browser. The demo AI is local rules/regex in `src/app/DawnApp.tsx`; there is no paid API key or env var required to run it.
- `npm run lint` currently exits non-zero due to a pre-existing `react-hooks/set-state-in-effect` error in `src/app/DawnApp.tsx` (plus unused-var warnings). This is a known code issue, not an environment problem; lint itself works.
- Core demo flow to sanity-check the app: open the "Ask Dawn" panel, type a messy update mentioning a hospital, submit, then Approve the suggested change (approval-first; an Undo appears after).
