// Server-side AI parsing for Dawn. Keys stay here, never in the browser.
//
// Providers (set AI_PROVIDER or auto-detect from AI_BASE_URL):
//   ollama  — free local AI (recommended tonight). Run: ollama pull llama3.2
//   openai  — paid OpenAI GPT. Set AI_API_KEY + AI_BASE_URL=https://api.openai.com/v1
//   github  — GitHub Models (being retired Jul 2026; many accounts get 403 no_access)
//
// If AI is missing or fails, the client falls back to Dawn's built-in free rules.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParseRequest = {
  text?: string;
  chatHistory?: string[];
  inputKind?: "voice" | "text" | "file" | "spreadsheet";
  hospitalNames?: string[];
  hospitalContacts?: Array<{
    hospitalName?: string;
    contactId?: string;
    name?: string;
    title?: string;
    email?: string;
    department?: string;
  }>;
};

type Provider = "ollama" | "openai" | "github";

const SYSTEM_PROMPT = `You are Dawn AI, a hospital site activation assistant for a tiny startup. Parse messy notes into suggested hospital, contact, stage, next-step, date, notes, and awaiting-who updates. Never update records automatically. Always show evidence, confidence, duplicate/conflict checks, and require human approval. You never invent facts.

Return ONLY strict JSON with this shape:
{
  "answer": string | null,
  "hospitalName": string | null,
  "isNewHospital": boolean,
  "country": string | null,
  "changes": [
    {
      "field": "stage" | "nextStep" | "awaiting" | "lastInteraction" | "notes",
      "value": string,
      "confidence": number
    }
  ],
  "contacts": [
    {
      "action": "create" | "update",
      "matchName": string | null,
      "contactId": string | null,
      "name": string,
      "email": string | null,
      "department": string | null,
      "title": string | null,
      "confidence": number
    }
  ],
  "summary": string,
  "items": [
    {
      "hospitalName": string,
      "isNewHospital": boolean,
      "country": string | null,
      "skip": boolean,
      "skipReason": string | null,
      "changes": [{ "field": "...", "value": "...", "confidence": number }],
      "contacts": [],
      "summary": string
    }
  ]
}

Rules:
- "waiting on us" means our team must act; "waiting on hospital" means they must act.
- Use contacts[] for new or updated people. action=create for someone new at the site; action=update when matching an existing contact by matchName or contactId from the known list.
- If the note mentions a person's name with an email address and/or role/title (CRC, PI, etc.), you MUST include a contacts[] item — do not leave contact details only in lastInteraction or notes.
- NEVER use a hospital or site name as a contact person name (e.g. "Brightwater Regional" is NOT a person — it is part of "Brightwater Regional Hospital").
- Duplicate spreadsheet rows for the same hospital are one site update — never turn a duplicate row into a contact.
- "Signed the LOI" and "send the EAA packet" in the same note means LOI was signed, EAA was NOT signed yet — lastInteraction should say LOI signed; nextStep should be Send EAA packet.
- When a document says "Next step:" include a nextStep change with that value (normalize to Send EAA packet or Schedule kickoff when appropriate).
- Voice notes are messy speech-to-text: strip filler words (okay, um, like), fix obvious transcription errors, and extract "called X hospital" as hospital name X Hospital — never include words like "called", "with the", or "new" in the hospital name.
- When the user describes a NEW hospital and a contact in the same message, set isNewHospital=true and include the contact in contacts[] for that new site.
- Prefer matching an existing known hospital name. Only set isNewHospital=true when it is clearly a different site.
- Never match a hospital just because the user said the generic word "hospital". Require a distinctive site name (e.g. Maya, Harborview, Brightwater).
- Keep it minimal: only propose changes the text actually supports. Use confidence 0–100 per change.
- Flag possible duplicates or conflicts in summary when a note might match the wrong hospital or contradict existing context.
- For small talk or vague one-word messages, set answer to a friendly reply and leave changes and contacts empty.
- When recent chat is provided, treat follow-ups like "actually they signed the LOI" or "it's Harborview" as corrections to the earlier update — keep the same hospital and revise the suggested change.
- SPREADSHEETS (CSV/Excel with multiple rows): use items[] — one item per real data row. Leave top-level hospitalName null when items[] is used.
- For each spreadsheet row: match to Known hospitals when the name is the same or a close typo. isNewHospital=true only if the site is NOT in Known hospitals.
- Skip decoy rows (Notes mention DECOY/gibberish, or names like Moonbase/Zorpington/Atlantis) — set skip:true and skipReason.
- Do NOT duplicate the same hospital twice in items[]. Merge duplicate rows into one item.
- Per spreadsheet row item: prefer ONE clear lastInteraction change using the Update column text, plus nextStep if the row has it. Only add awaiting if Waiting on column is present.
- Use the hospital name FROM EACH SPREADSHEET ROW exactly. Never swap in a similar Known hospital (Summit Crest ≠ Summit Point, Northridge ≠ Northbridge).
- If a name matches a Known hospital exactly, set isNewHospital=false and propose an update — never create a duplicate.
- Always include country from the spreadsheet Country column for new hospitals. Use Singapore, Malaysia, Indonesia, or Thailand when the row says so; otherwise use the exact country name from the row (e.g. Vietnam, Philippines).
- For single voice/text notes (not multi-row files), use top-level hospitalName/changes and leave items[] empty.`;

const GITHUB_MODEL_FALLBACKS = [
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
  "openai/gpt-4o",
  "Meta-Llama-3.1-8B-Instruct",
];

function parseModelJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1].trim());
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("non-JSON");
  }
}

function resolveProvider(baseUrl: string): Provider {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === "ollama" || explicit === "openai" || explicit === "github") return explicit;
  if (baseUrl.includes("11434") || baseUrl.includes("localhost") && baseUrl.includes("ollama")) return "ollama";
  if (baseUrl.includes("api.openai.com")) return "openai";
  if (baseUrl.includes("models.github.ai")) return "github";
  return process.env.AI_API_KEY?.startsWith("sk-") ? "openai" : "github";
}

function isConfigured(provider: Provider, apiKey: string | undefined): boolean {
  if (provider === "ollama") return true;
  return Boolean(apiKey);
}

function buildHeaders(provider: Provider, apiKey: string | undefined, baseUrl: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "github") {
    headers.Accept = "application/vnd.github+json";
    headers["X-GitHub-Api-Version"] = "2026-03-10";
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  } else if (provider === "openai" && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (provider === "ollama" && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

async function callModel(
  baseUrl: string,
  provider: Provider,
  model: string,
  apiKey: string | undefined,
  userContent: string,
): Promise<{ ok: true; parsed: unknown; modelUsed: string } | { ok: false; status: number; detail: string }> {
  const headers = buildHeaders(provider, apiKey, baseUrl);
  const payload: Record<string, unknown> = {
    model,
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  };
  if (provider === "openai") {
    payload.response_format = { type: "json_object" };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { ok: false, status: response.status, detail: (await response.text()).slice(0, 500) };
    }

    const data = await response.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    try {
      return { ok: true, parsed: parseModelJson(content), modelUsed: model };
    } catch {
      return { ok: false, status: 502, detail: `non-JSON from ${model}: ${content.slice(0, 200)}` };
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "fetch failed";
    return { ok: false, status: 502, detail };
  }
}

function hintForError(provider: Provider, status: number, detail: string): string {
  if (provider === "ollama") {
    if (status === 404 || detail.includes("not found")) {
      return "Ollama model not found. Run: ollama pull llama3.2 (then restart npm run dev).";
    }
    return "Is Ollama running? Start the Ollama app, then try again.";
  }
  if (provider === "github" && (status === 403 || detail.includes("no_access"))) {
    return "GitHub Models blocked this model (service retires Jul 30, 2026). Switch to Ollama (free) or OpenAI in .env.local — see .env.example.";
  }
  if (status === 401 || status === 403) return "Check your API key / token and restart npm run dev.";
  if (status === 429) return "Rate limit hit — wait a minute and try again.";
  if (provider === "github" && detail.includes("certificate")) {
    return "GitHub Models SSL error on Windows. Restart with: npm run dev (uses system certificates). Or switch to OpenAI in .env.local.";
  }
  if (detail.includes("fetch failed") || detail.includes("certificate")) {
    return "Network/SSL error reaching the AI provider. Restart npm run dev, or try OpenAI in .env.local.";
  }
  return "See terminal for [Dawn /api/parse] details.";
}

export async function POST(request: Request) {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = (process.env.AI_BASE_URL ?? "http://127.0.0.1:11434/v1").replace(/\/$/, "");
  const provider = resolveProvider(baseUrl);

  if (!isConfigured(provider, apiKey)) {
    return Response.json({ configured: false });
  }

  let body: ParseRequest;
  try {
    body = (await request.json()) as ParseRequest;
  } catch {
    return Response.json({ configured: true, error: "bad request" }, { status: 400 });
  }

  const text = (body.text ?? "").slice(0, 8000);
  if (!text.trim()) {
    return Response.json({ configured: true, error: "empty text" }, { status: 400 });
  }

  const lower = text.trim().toLowerCase();
  if (
    /\bpriorit(y|ies)?\b/.test(lower) ||
    (/\b(today|right now)\b/.test(lower) && /\b(what|my|our|focus|should|important)\b/.test(lower))
  ) {
    if (!/\b(met|spoke|signed|sent|called|emailed|updated)\b/.test(lower)) {
      return Response.json({
        configured: true,
        localOnly: true,
        result: {
          answer: null,
          hospitalName: null,
          isNewHospital: false,
          country: null,
          changes: [],
          contacts: [],
          summary: "Dashboard priority question — answered locally in Dawn, not by GPT.",
          items: [],
        },
        provider,
        model: undefined,
      });
    }
  }

  const primaryModel =
    process.env.AI_MODEL ??
    (provider === "ollama" ? "llama3.2" : provider === "openai" ? "gpt-4.1-nano" : "openai/gpt-4.1-mini");

  const modelsToTry =
    provider === "github"
      ? [primaryModel, ...GITHUB_MODEL_FALLBACKS.filter((model) => model !== primaryModel)]
      : [primaryModel];

  const contactLines = (body.hospitalContacts ?? [])
    .slice(0, 120)
    .map((contact) => `${contact.hospitalName}: ${contact.contactId} · ${contact.name} · ${contact.title} · ${contact.email ?? ""}`)
    .join("\n");

  const historyBlock = (body.chatHistory ?? []).slice(-8).join("\n");
  const inputKind = body.inputKind ?? "text";
  const voicePreamble =
    inputKind === "voice"
      ? "INPUT TYPE: voice note (messy browser speech-to-text). Clean up filler words, infer the intended hospital and contact names, and ignore generic words like 'hospital' unless part of a site name.\n\n"
      : inputKind === "spreadsheet"
        ? "INPUT TYPE: spreadsheet with MULTIPLE ROWS. Return items[] with one entry per real row. Skip decoy rows. Match existing Known hospitals; create new ones only when not listed.\n\n"
        : inputKind === "file"
          ? "INPUT TYPE: extracted file text. Use ONLY the real update section. Sections marked DECOY, NOISE, FOOTER, or 'ignore for hospital records' must be skipped entirely — never create Moonbase, Zorpington, or Atlantis. Match existing Known hospitals when the file is about them.\n\n"
          : "";

  const userContent = `${voicePreamble}Known hospitals: ${(body.hospitalNames ?? []).slice(0, 60).join(", ") || "(none)"}
Known contacts:
${contactLines || "(none)"}

Recent chat (use this for corrections and follow-ups — latest message is what the user just sent):
${historyBlock || "(none)"}

Latest message to interpret:
${text}`;

  let lastError = { status: 502, detail: "unknown" };

  try {
    for (const model of modelsToTry) {
      const result = await callModel(baseUrl, provider, model, apiKey, userContent);
      if (result.ok) {
        console.info(`[Dawn /api/parse] ok via ${provider} / ${result.modelUsed}`);
        return Response.json({ configured: true, result: result.parsed, provider, model: result.modelUsed });
      }
      lastError = { status: result.status, detail: result.detail };
      console.warn(`[Dawn /api/parse] ${provider} ${model} failed`, result.status, result.detail.slice(0, 200));
      if (provider !== "github" || result.status !== 403) break;
    }

    console.error("[Dawn /api/parse] all attempts failed", lastError.status, lastError.detail.slice(0, 500));
    return Response.json(
      {
        configured: true,
        error: `model error ${lastError.status}`,
        detail: lastError.detail.slice(0, 400),
        hint: hintForError(provider, lastError.status, lastError.detail),
        provider,
      },
      { status: 502 },
    );
  } catch (error) {
    console.error("[Dawn /api/parse]", error);
    return Response.json(
      {
        configured: true,
        error: error instanceof Error ? error.message : "unknown error",
        hint: provider === "ollama" ? "Is Ollama running on your machine?" : undefined,
        provider,
      },
      { status: 502 },
    );
  }
}

export async function GET() {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = (process.env.AI_BASE_URL ?? "http://127.0.0.1:11434/v1").replace(/\/$/, "");
  const provider = resolveProvider(baseUrl);
  const configured = isConfigured(provider, apiKey);
  const primaryModel =
    process.env.AI_MODEL ??
    (provider === "ollama" ? "llama3.2" : provider === "openai" ? "gpt-4.1-nano" : "openai/gpt-4.1-mini");

  return Response.json({
    configured,
    provider: configured ? provider : undefined,
    model: configured ? primaryModel.replace(/^openai\//, "") : undefined,
  });
}
