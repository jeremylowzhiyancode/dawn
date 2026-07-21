# OpenAI Build Week — submission master checklist

**This is the don't-miss deadline doc.** Keep it open until Devpost shows **Submitted** in green.

| | |
|---|---|
| **Hackathon** | [OpenAI Build Week](https://openai.devpost.com/) |
| **Deadline** | **Tuesday July 21, 2026, 5:00 PM PT** |
| **Singapore (UTC+8)** | **Wednesday July 22, 2026, 8:00 AM** |
| **Buffer goal** | Submit **~3 hours early**; you can polish until the last second after that |
| **Codex Session ID** | `019f7a05-eae8-7851-993f-013d83357327` |
| **GitHub repo** | https://github.com/jeremylowzhiyancode/dawn |
| **Local app** | `cd dawn-scaffold && npm run dev` → http://127.0.0.1:3000 |
| **App test checklist** | `TEST-CHECKLIST-2026-07-21.md` |

---

## Build requirement

You must build with **both Codex and GPT-5.6**. This does **not** require the API or paid API credits.

---

## Do tonight (before you sleep) 🤿

These are **multi-step** — do not start at 4:50 PM PT.

### ⬆️ Demo video (YouTube)

1. Record screencast + **required voiceover**
2. Upload to YouTube (public or unlisted)
3. **Wait** for YouTube to finish processing
4. Copy the link
5. Paste into Devpost submission form

**Voiceover must cover:**
- What you built
- **How you used Codex**
- **How you used GPT-5.6**  
(not vague "we used AI")

**Video rules:** ≤3 minutes; judges may stop watching after 3 min. Trim loading/typing; speed up if needed.

### 👨‍💻 Code repo permissions

- [ ] Repo link in submission
- [ ] If **public:** relevant open-source license attached
- [ ] If **private:** shared with **both**:
  - `testing@devpost.com`
  - `build-week-event@openai.com`  
  **Unshared private repo = disqualification risk**

### 📋 Project description

- [ ] Read it **out loud**
- [ ] If it sounds like AI wrote it, **rewrite in your voice**

### 🎥 Watch your own video

- [ ] Audio clear?
- [ ] Voiceover actually mentions Codex + GPT-5.6?

### 📝 Save vs submit

- [ ] Click through to **My Projects** on Devpost nav
- [ ] Project tagged **Submitted** in **green** — not draft

---

## Full submission checklist

- [ ] Project **runs and works** as described (test fresh)
- [ ] Demo video on YouTube; link in form
- [ ] Voiceover covers build + Codex + GPT-5.6
- [ ] **`/feedback` Codex Session ID** in form (`019f7a05-eae8-7851-993f-013d83357327` — re-run `/feedback` in Codex on Dawn repo to confirm)
- [ ] Code repo link; private repos shared with both emails above
- [ ] **README:** setup instructions, sample data if needed, documents Codex + GPT-5.6 usage
- [ ] (Plugin/tool only) install instructions, platforms, way to test without rebuild
- [ ] Team members added **and invitations accepted**
- [ ] Status = **Submitted**, not draft

---

## `/feedback` Session ID — easy fix

1. Open Dawn codebase in **Codex Desktop or CLI**
2. Type **`/feedback`** from the `/` menu
3. Copy the session ID where **most of your core work** happened
4. Paste into Devpost form

Same trick works for `/status`.

---

## Devpost Hackathons Plugin (optional but helpful)

Install: https://chatgpt.com/apps/devpost-hackathons/asdk_app_6a330a7730c081919892632d5baaec58

Useful commands: `$start-hackathon`, `$prepare-submission`, `$submit-project`

**After plugin submit:** still check **My Projects** shows **Submitted**.

---

## After deadline — locked

At **5:00 PM PT Tuesday July 21**, submissions lock. No late entries. No changes without eligibility risk.

---

## Questions

- OpenAI Discord: `#build-week-chat`
- Devpost hackathon page: https://openai.devpost.com/

---

## Dawn demo script (3 min max)

### Phase 1 — core (~2 min)

Judges need to see: messy input → clear suggestions → human approves → audit trail.

1. **Dashboard** — Ask Dawn: *"what are my priorities today?"*  
   → Shows real hospitals waiting on you (local answer, not GPT guessing).
2. **File drop** — `sample-drops/new-hospital-leads-mixed.csv`  
   → Approve one **new** hospital (e.g. Brightwater, Thailand) + one **update** (e.g. Harborview).
3. **Hospital panel** — Open the new record; show **country** field filled in.
4. **Chat update** — *"Harborview signed the LOI"* → Approve suggestion.
5. **Audit** — Show approved changes logged under demo user.

**Voiceover beat:** "Dawn reads messy files and notes, suggests changes, and nothing updates until I approve."

---

### Phase 2 — differentiators (~1 min, if time)

Shows Dawn feels fast and idiotproof for a lean team.

6. **Open by name** — Say or type **`Cedar Bay`** → correct panel opens; next step matches the dashboard row.
7. **Open contact** — *"open Dr Aaron Lim"* or mic *"pen up Dr Aaron Lim"* → Contacts tab at Northbridge, Aaron expanded.
8. **Priority at a glance** — Point at **waiting on us** vs **waiting on hospital** on the dashboard (or drag one hospital up in priority).

**Voiceover beat:** "I can ask what's urgent, open any site or contact by name — even by voice — and the dashboard stays in sync."

---

### Backup if GPT/file hiccups

- Priorities question always works (local rules).
- CSV drop is the reliable file demo; skip PDF/PPTX on stage if flaky.
- Text instead of mic if browser blocks microphone.

You’ve got this. 💪
