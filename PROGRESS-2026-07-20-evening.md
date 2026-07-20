# Dawn — progress handoff (2026-07-20 evening)

Branch: `cursor/dawn-file-parsing-and-chat-e1a4`
App: `dawn-scaffold` (Next.js). Run with `npm run dev`, open http://localhost:3000

## Done today (uncommitted local changes — commit these to save)
1. **File-drop parsing** (`src/app/fileText.ts`): reads PDF, Excel/CSV, PowerPoint (.pptx), Word (.docx), text, and images (OCR). Drop a file on the app → Dawn suggests edits or offers to create a new hospital. Approval-first unchanged.
2. **Ask Dawn chat**: questions like "what are my priorities?" get an answer (no record change). Greetings ("hi", "thanks", "help") get a friendly reply, not a suggestion.
3. **Flicker fixes**: memoized the visible rows + guarded row drag so dragging a card is smooth; removed a mount-time setState.
4. **UI polish**: renamed priority "Very urgent" → "Critical"; more even column spacing; only the Priority pill is bold so it stands out.
5. **GPT integration (free)**: secure server route `src/app/api/parse/route.ts` calls an OpenAI-compatible endpoint. Defaults to **GitHub Models (free)**. Client (`aiInterpret` in `DawnApp.tsx`) uses it and **falls back to built-in rules** if no key/offline — so the app never breaks.
6. **Sample files**: `dawn-scaffold/sample-drops/` has `.txt` and `.csv` ready now. `node scripts/make-sample-files.mjs` generates real `.xlsx`, `.docx`, `.pptx`.

## To enable free GPT (manual, ~2 min)
1. Create a GitHub token with the **`models:read`** scope: https://github.com/settings/tokens
2. Create `dawn-scaffold/.env.local` (template in `.env.example`):
   ```
   AI_API_KEY=your_github_token_here
   AI_BASE_URL=https://models.github.ai/inference
   AI_MODEL=openai/gpt-4o-mini
   ```
3. Restart `npm run dev` (env only loads on restart).

## Not yet verified
- Build/lint was NOT run this session (agent terminal was frozen). Start `npm run dev` and watch for any red compile error; if present, share it.
- GPT path only tested by design/fallback, not live — try it after adding the token.

## Next steps (tonight)
- Verify `npm run dev` compiles cleanly; fix any error.
- Add the GitHub token, test a messy note + a dropped file with GPT on.
- Optional: let GPT also answer free-form questions more naturally.
- Commit + push, then update PR #4.
