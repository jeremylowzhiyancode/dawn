"use client";

import { ChangeEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import {
  AuditDrawer as EditableAuditDrawer,
  FileStorageDrawer as EditableFileStorageDrawer,
  HospitalDetail as EditableHospitalDetail,
  NewHospitalDrawer as EditableNewHospitalDrawer,
  SettingsDrawer as EditableSettingsDrawer,
} from "./Drawers";

export type Stage = "Interest" | "Kickoff" | "Pilot" | "Active";
export type Awaiting = "us" | "hospital";
export type Country = "Singapore" | "Malaysia" | "Indonesia" | "Thailand" | "Vietnam";
export type SortKey = "status" | "hospital" | "stage" | "nextStep" | "lastInteraction" | "awaiting" | "country";
export type SortDirection = "asc" | "desc";
type Signal = "critical" | "cold" | "warm" | "bright";
type Drawer = "hospital" | "settings" | "new" | "audit" | "files" | null;

export type Contact = {
  id: string;
  name: string;
  email: string;
  department: string;
  title: ContactTitle;
};

export type ContactTitle =
  | "Principal Investigator (PI)"
  | "Sub-Investigator"
  | "Clinical Research Coordinator (CRC)"
  | "Clinical Trials Manager / Clinical Operations Manager"
  | "Feasibility Manager / Feasibility Coordinator"
  | "Research Nurse"
  | "Regulatory Affairs Manager/Coordinator"
  | "IRB/Ethics Committee Coordinator"
  | "Quality Assurance (QA) Manager"
  | "Compliance Officer"
  | "Contracts Manager / Clinical Trial Agreement (CTA) Negotiator"
  | "Legal Counsel"
  | "Grants & Contracts Officer"
  | "IT Security Officer"
  | "Data Protection Officer (DPO)"
  | "Health Informatics / IT Systems Manager"
  | "Procurement Officer"
  | "Finance/Budget Officer"
  | "Pharmacy Director"
  | "Site Director / Site Manager"
  | "Department Head / Head of Department"
  | "Hospital Administrator"
  | "Business Development / Partnerships Officer";

export type AuditEntry = {
  id: string;
  at: string;
  by: string;
  action: string;
  source: string;
};

export type EvidenceItem = {
  id: string;
  label: string;
  text: string;
  at: string;
};

export type Hospital = {
  id: string;
  name: string;
  country: Country;
  stage: Stage;
  substage: string;
  nextStep: string;
  lastInteractionAt: string;
  lastInteraction: string;
  awaiting: Awaiting;
  awaitingContactId: string;
  notes: string;
  contacts: Contact[];
  evidence: EvidenceItem[];
  audit: AuditEntry[];
  stageHistory: string[];
};

export type DawnSettings = {
  aiModel: string;
  systemPrompt: string;
  fieldLabels: {
    status: string;
    hospital: string;
    stage: string;
    nextStep: string;
    lastInteraction: string;
    awaiting: string;
  };
  visibleColumns: string[];
  substageLabels: Record<Stage, string>;
};

type Suggestion = {
  id: string;
  hospitalId: string;
  hospitalName: string;
  field: "stage" | "nextStep" | "lastInteraction" | "awaiting" | "notes";
  currentValue: string;
  suggestedValue: string;
  confidence: number;
  evidence: string;
  conflict?: string;
};

const today = new Date("2026-07-18T12:00:00+08:00");
export const stages: Stage[] = ["Interest", "Kickoff", "Pilot", "Active"];
export const countries: Country[] = ["Singapore", "Malaysia", "Indonesia", "Thailand", "Vietnam"];
export const stageSubstages: Record<Stage, string[]> = {
  Interest: ["Agreements sent", "EAA signed", "LOI signed"],
  Kickoff: ["Kickoff invited", "Kickoff scheduled", "Kickoff completed"],
  Pilot: ["Pilot initiated", "Pilot completed"],
  Active: ["1 month check-in", "2 month check-in", "3 month check-in"],
};
export const nextStepOptions = [
  "Send EAA packet",
  "Schedule kickoff",
  "Send calendar holds",
  "Prepare kickoff deck",
  "Confirm pilot readiness",
  "Check feasibility completion",
  "Send polite reminder",
  "Schedule monthly check-in",
  "Collect usage feedback",
  "Other",
];
const stageThresholds: Record<Stage, number> = {
  Interest: 14,
  Kickoff: 7,
  Pilot: 45,
  Active: 30,
};

export const contactTitles: ContactTitle[] = [
  "Principal Investigator (PI)",
  "Sub-Investigator",
  "Clinical Research Coordinator (CRC)",
  "Clinical Trials Manager / Clinical Operations Manager",
  "Feasibility Manager / Feasibility Coordinator",
  "Research Nurse",
  "Regulatory Affairs Manager/Coordinator",
  "IRB/Ethics Committee Coordinator",
  "Quality Assurance (QA) Manager",
  "Compliance Officer",
  "Contracts Manager / Clinical Trial Agreement (CTA) Negotiator",
  "Legal Counsel",
  "Grants & Contracts Officer",
  "IT Security Officer",
  "Data Protection Officer (DPO)",
  "Health Informatics / IT Systems Manager",
  "Procurement Officer",
  "Finance/Budget Officer",
  "Pharmacy Director",
  "Site Director / Site Manager",
  "Department Head / Head of Department",
  "Hospital Administrator",
  "Business Development / Partnerships Officer",
];

const syntheticContactNames = [
  ["Maya Tan", "Dr. Aaron Lim", "Priya Menon"],
  ["Sofia Rahman", "Dr. Daniel Wong", "Kavita Rao"],
  ["Nadia Putri", "Dr. Leo Santoso", "Amelia Chua"],
  ["Chanya Srisai", "Dr. Arun Patel", "Mei Lin"],
  ["Linh Nguyen", "Dr. Ben Tran", "Anika Shah"],
];

const initialSettings: DawnSettings = {
  aiModel: "Budget small model",
  systemPrompt:
    "You are Dawn AI, a hospital site activation assistant for a tiny startup. Parse messy notes into suggested hospital, contact, stage, next-step, date, notes, and awaiting-who updates. Never update records automatically. Always show evidence, confidence, duplicate/conflict checks, and require human approval.",
  fieldLabels: {
    status: "Status",
    hospital: "Hospital",
    stage: "Stage",
    nextStep: "Next step",
    lastInteraction: "Last interaction",
    awaiting: "Awaiting",
  },
  visibleColumns: ["status", "hospital", "stage", "nextStep", "lastInteraction", "awaiting"],
  substageLabels: {
    Interest: "Agreements sent, EAA signed, LOI signed",
    Kickoff: "Kickoff invited, kickoff scheduled, kickoff completed",
    Pilot: "Pilot initiated, pilot completed",
    Active: "1 month check-in, 2 month check-in, 3 month check-in",
  },
};

const initialHospitals: Hospital[] = [
  createHospital("h01", "Northbridge University Hospital", "Singapore", "Interest", "EAA signed", "Schedule kickoff", "2026-06-12", "EAA signed by admin office", "us", "Waiting on Jeremy to propose kickoff dates"),
  createHospital("h02", "Cedar Bay Medical Center", "Malaysia", "Kickoff", "Kickoff invited", "Send calendar holds", "2026-06-24", "Coordinator asked for two date options", "us", "Calendar holds need sending"),
  createHospital("h03", "Harborview Clinical Institute", "Singapore", "Interest", "LOI signed", "Send EAA packet", "2026-06-29", "LOI returned by director", "us", "EAA packet not sent"),
  createHospital("h04", "Silverline General Hospital", "Indonesia", "Pilot", "Pilot initiated", "Check feasibility completion", "2026-06-02", "Pilot workspace opened", "hospital", "Waiting for first feasibility submission"),
  createHospital("h05", "East Ridge Health", "Thailand", "Kickoff", "Kickoff scheduled", "Prepare kickoff deck", "2026-07-05", "Kickoff booked for next week", "us", "Deck needs final review"),
  createHospital("h06", "Valley Research Hospital", "Vietnam", "Interest", "Agreements sent", "Send polite reminder", "2026-07-01", "EAA packet sent", "hospital", "Waiting for legal review"),
  createHospital("h07", "Maple Ward Medical", "Singapore", "Active", "1 month check-in", "Collect usage feedback", "2026-07-15", "Completed first check-in", "us", "No notes"),
  createHospital("h08", "Summit Point Hospital", "Malaysia", "Pilot", "Kickoff completed", "Confirm pilot readiness", "2026-07-03", "Kickoff completed with coordinator", "hospital", "Waiting for available feasibility"),
  createHospital("h09", "Lakeside Academic Health", "Indonesia", "Interest", "EAA signed", "Schedule kickoff", "2026-07-08", "Admin confirmed EAA completion", "us", "No kickoff slot proposed"),
  createHospital("h10", "Orchard Park Clinic", "Thailand", "Active", "2 month check-in", "Schedule monthly check-in", "2026-07-16", "Champion reported smooth usage", "us", "No notes"),
  createHospital("h11", "Pinecrest Hospital", "Vietnam", "Interest", "Agreements sent", "Send polite reminder", "2026-07-11", "Intro email sent to admin team", "hospital", "Unknown legal owner"),
  createHospital("h12", "Bluewater Medical Campus", "Singapore", "Kickoff", "Kickoff scheduled", "Prepare kickoff deck", "2026-07-09", "Kickoff confirmed by coordinator", "us", "Agenda not sent"),
  createHospital("h13", "Redwood Clinical Center", "Malaysia", "Pilot", "Pilot initiated", "Check feasibility completion", "2026-06-27", "PI asked about feasibility workflow", "hospital", "Waiting for PI response"),
  createHospital("h14", "Westhaven Health System", "Indonesia", "Interest", "LOI signed", "Send EAA packet", "2026-07-14", "Director returned signed LOI", "us", "No notes"),
  createHospital("h15", "Brightfield Hospital", "Thailand", "Kickoff", "Kickoff invited", "Send polite reminder", "2026-07-12", "Kickoff invite sent", "hospital", "Waiting for coordinator"),
  createHospital("h16", "Riverbend Research Site", "Vietnam", "Pilot", "Pilot completed", "Schedule monthly check-in", "2026-07-10", "First feasibility submitted", "us", "No notes"),
  createHospital("h17", "Horizon City Hospital", "Singapore", "Interest", "EAA signed", "Schedule kickoff", "2026-06-18", "EAA confirmed complete", "us", "Hospital has waited too long"),
  createHospital("h18", "Stonegate Medical", "Malaysia", "Active", "3 month check-in", "Collect usage feedback", "2026-07-13", "Second check-in completed", "us", "Minor training request"),
  createHospital("h19", "Meadowbrook Institute", "Indonesia", "Kickoff", "Kickoff completed", "Confirm pilot readiness", "2026-06-30", "Kickoff completed with ops team", "hospital", "Waiting for feasibility opportunity"),
  createHospital("h20", "Clearwater Regional", "Thailand", "Pilot", "Pilot initiated", "Check feasibility completion", "2026-07-06", "Pilot started with coordinator", "hospital", "Waiting for site update"),
];

function createHospital(
  id: string,
  name: string,
  country: Country,
  stage: Stage,
  substage: string,
  nextStep: string,
  lastInteractionAt: string,
  lastInteraction: string,
  awaiting: Awaiting,
  notes: string,
): Hospital {
  const index = Number(id.replace(/\D/g, "")) || 1;
  const names = syntheticContactNames[(index - 1) % syntheticContactNames.length];
  return {
    id,
    name,
    country,
    stage,
    substage,
    nextStep,
    lastInteractionAt,
    lastInteraction,
    awaiting,
    awaitingContactId: `${id}-c1`,
    notes,
    contacts: [
      {
        id: `${id}-c1`,
        name: names[0],
        email: `coordinator-${id}@example.org`,
        department: "Clinical research office",
        title: "Clinical Research Coordinator (CRC)",
      },
      {
        id: `${id}-c2`,
        name: names[1],
        email: `pi-${id}@example.org`,
        department: "Research department",
        title: "Principal Investigator (PI)",
      },
      {
        id: `${id}-c3`,
        name: names[2],
        email: `admin-${id}@example.org`,
        department: "Admin/legal",
        title: "Hospital Administrator",
      },
    ],
    evidence: [
      {
        id: `${id}-e1`,
        label: lastInteraction,
        text: `${name}: ${lastInteraction}. Next step: ${nextStep}.`,
        at: lastInteractionAt,
      },
    ],
    audit: [
      {
        id: `${id}-a1`,
        at: `${lastInteractionAt} 09:30`,
        by: "Demo user",
        action: `Recorded ${substage}`,
        source: lastInteraction,
      },
    ],
    stageHistory: [`${stage}: ${substage} on ${formatDate(lastInteractionAt)}`],
  };
}

export default function DawnApp() {
  const [hospitals, setHospitals] = useState(initialHospitals);
  const [activeStage, setActiveStage] = useState<Stage | "All">("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("High priority\n- Book kickoff for Northbridge\n- Send EAA packet to Harborview\n- Check pilot form at Redwood");
  const [composer, setComposer] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isReviewOpen, setReviewOpen] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<Hospital[] | null>(null);
  const [isListening, setListening] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return hospitals
      .filter((hospital) => activeStage === "All" || hospital.stage === activeStage)
      .filter((hospital) => {
        if (!search) return true;
        return [
          hospital.name,
          hospital.stage,
          hospital.substage,
          hospital.nextStep,
          hospital.awaiting,
          hospital.lastInteraction,
        ].some((value) => value.toLowerCase().includes(search));
      })
      .sort((a, b) => urgencyScore(b) - urgencyScore(a));
  }, [activeStage, hospitals, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const visibleHospitals = filtered.slice((page - 1) * 10, page * 10);
  const selectedHospital = hospitals.find((hospital) => hospital.id === selectedId) ?? null;

  function openHospital(hospital: Hospital) {
    setSelectedId(hospital.id);
    setDrawer("hospital");
  }

  function handleStage(stage: Stage | "All") {
    setActiveStage(stage);
    setPage(1);
  }

  function handleComposerSend() {
    const text = composer.trim();
    if (!text) return;

    if (/export|excel|download/i.test(text)) {
      exportCsv(hospitals);
      setComposer("");
      return;
    }

    setSuggestions(createSuggestions(text, hospitals));
    setReviewOpen(true);
    setComposer("");
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSuggestions(createSuggestions(`Uploaded file: ${file.name}`, hospitals, file.name));
    setReviewOpen(true);
    event.target.value = "";
  }

  function toggleMic() {
    if (isListening) {
      setListening(false);
      return;
    }

    const browserWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setComposer("Voice capture is not available in this browser. Type or drop a note instead.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setComposer(transcript);
      setSuggestions(createSuggestions(transcript, hospitals, "Voice note"));
      setReviewOpen(true);
    };
    recognition.start();
  }

  function updateSuggestion(id: string, value: string) {
    setSuggestions((current) =>
      current.map((suggestion) =>
        suggestion.id === id ? { ...suggestion, suggestedValue: value } : suggestion,
      ),
    );
  }

  function dismissSuggestion(id: string) {
    setSuggestions((current) => current.filter((suggestion) => suggestion.id !== id));
  }

  function approveSuggestion(suggestion: Suggestion) {
    setLastSnapshot(hospitals);
    setHospitals((current) => applySuggestion(current, suggestion));
    dismissSuggestion(suggestion.id);
  }

  function approveAll() {
    setLastSnapshot(hospitals);
    setHospitals((current) => suggestions.reduce(applySuggestion, current));
    setSuggestions([]);
    setReviewOpen(false);
  }

  function undoLastApproval() {
    if (!lastSnapshot) return;
    setHospitals(lastSnapshot);
    setLastSnapshot(null);
  }

  function saveHospital(nextHospital: Hospital) {
    const previous = hospitals.find((hospital) => hospital.id === nextHospital.id);
    const changes = previous ? describeHospitalChanges(previous, nextHospital) : ["Created hospital record"];
    const auditedHospital = {
      ...nextHospital,
      audit: changes.length
        ? [
            {
              id: `audit-${Date.now()}`,
              at: timestampNow(),
              by: "Demo user",
              action: changes.join("; "),
              source: "Manual save",
            },
            ...nextHospital.audit,
          ]
        : nextHospital.audit,
    };

    setHospitals((current) =>
      current.map((hospital) => (hospital.id === auditedHospital.id ? auditedHospital : hospital)),
    );
    setSelectedId(auditedHospital.id);
  }

  function createNewHospital(draft: Hospital) {
    const created = {
      ...draft,
      audit: [
        {
          id: `audit-${Date.now()}`,
          at: timestampNow(),
          by: "Demo user",
          action: "Created hospital record",
          source: "Manual new-org rail",
        },
        ...draft.audit,
      ],
    };
    setHospitals((current) => [created, ...current]);
    setSelectedId(created.id);
    setDrawer("hospital");
  }

  return (
    <main className={`dawn-app stage-${activeStage.toLowerCase()}`}>
      <div className="sunrise-field" aria-hidden="true">
        <span className="moving-sun" />
      </div>

      <header className="topbar">
        <button className="brand" aria-label="Dawn AI home" onClick={() => handleStage("All")}>
          <span className="brand-mark" aria-hidden="true" />
          <span>Dawn AI</span>
        </button>
        <div className="top-actions">
          {lastSnapshot ? (
            <button className="soft-action text-action" onClick={undoLastApproval}>
              Undo
            </button>
          ) : null}
          <button className="icon-button" aria-label="Audit trail" onClick={() => setDrawer("audit")}>
            <HistoryIcon />
          </button>
          <button className="icon-button" aria-label="File storage" onClick={() => setDrawer("files")}>
            <PaperclipIcon />
          </button>
          <button className="icon-button" aria-label="Settings" onClick={() => setDrawer("settings")}>
            <SettingsIcon />
          </button>
          <button className="icon-button" aria-label="Export to Excel" onClick={() => exportCsv(hospitals)}>
            <DownloadIcon />
          </button>
          <button className="icon-button" aria-label="Invite user">
            <UserPlusIcon />
          </button>
          <button className="icon-button" aria-label="Logout">
            <LogoutIcon />
          </button>
        </div>
      </header>

      <section className="command-panel" aria-label="Ask Dawn">
        <button className={`mic-button ${isListening ? "is-listening" : ""}`} aria-label="Talk to Dawn" onClick={toggleMic}>
          <MicIcon />
        </button>
        <input
          value={composer}
          onChange={(event) => setComposer(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter") handleComposerSend();
          }}
          placeholder="How can Dawn help you today?"
        />
        <input ref={fileInputRef} type="file" className="sr-only" onChange={handleFile} />
        <button className="composer-icon" aria-label="Attach file" onClick={() => fileInputRef.current?.click()}>
          <PaperclipIcon />
        </button>
        <button className="send-button" aria-label="Send to Dawn" onClick={handleComposerSend}>
          <ArrowUpIcon />
        </button>
      </section>

      <section className="workbench">
        <section className="main-panel" aria-label="Onboard dashboard">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Welcome back</p>
              <h1>What needs moving today?</h1>
            </div>
            <div className="search-shell">
              <input
                className="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search hospital, stage, awaiting..."
              />
              <button className="add-hospital" aria-label="New hospital" onClick={() => setDrawer("new")}>
                <PlusIcon />
              </button>
            </div>
          </div>

          <nav className="stage-tabs" aria-label="Activation stages">
            <button className={activeStage === "All" ? "active" : ""} onClick={() => handleStage("All")}>
              All <b>{hospitals.length}</b>
            </button>
            {stages.map((stage) => (
              <button key={stage} className={activeStage === stage ? "active" : ""} onClick={() => handleStage(stage)}>
                {stage} <b>{hospitals.filter((hospital) => hospital.stage === stage).length}</b>
              </button>
            ))}
          </nav>

          <div className="hospital-table" role="table">
            <div className="table-row table-head" role="row">
              <div role="columnheader" className="status-heading">
                {settings.fieldLabels.status}
                <span className="info-dot" tabIndex={0}>
                  ^
                  <span className="tooltip">
                    <b>Status sort</b>
                    <span>1. Waiting on us rises first.</span>
                    <span>2. Stage timing adjusts urgency.</span>
                    <span>3. Older last interaction cools faster.</span>
                  </span>
                </span>
              </div>
              <div role="columnheader">{settings.fieldLabels.hospital}</div>
              <div role="columnheader" className="status-heading">
                {settings.fieldLabels.stage}
                <span className="info-dot" tabIndex={0}>
                  ^
                  <span className="tooltip stage-tip">
                    <b>Stage flow</b>
                    <span>Interest: agreements sent, EAA signed, LOI signed.</span>
                    <span>Kickoff: invited, scheduled, completed.</span>
                    <span>Pilot: initiated, completed.</span>
                    <span>Active: 1, 2, and 3 month check-ins.</span>
                  </span>
                </span>
              </div>
              <div role="columnheader">{settings.fieldLabels.nextStep}</div>
              <div role="columnheader">{settings.fieldLabels.lastInteraction}</div>
              <div role="columnheader">{settings.fieldLabels.awaiting}</div>
            </div>
            {visibleHospitals.map((hospital) => (
              <button className="table-row data-row" role="row" key={hospital.id} onClick={() => openHospital(hospital)}>
                <div role="cell">
                  <SunSignal signal={signalFor(hospital)} />
                </div>
                <div role="cell" className="hospital-name">
                  {hospital.name}
                </div>
                <div role="cell">
                  <span className="stage-pill">{hospital.stage}</span>
                  <span className="substage">{hospital.substage}</span>
                </div>
                <div role="cell" className="next-step">
                  {hospital.nextStep}
                </div>
                <div role="cell">
                  <span>{formatDate(hospital.lastInteractionAt)}</span>
                  <small>{hospital.lastInteraction}</small>
                </div>
                <div role="cell">
                  <span className={`awaiting ${hospital.awaiting}`}>{hospital.awaiting === "us" ? "Us" : "Hospital"}</span>
                </div>
              </button>
            ))}
          </div>

          <footer className="pagination">
            <span>
              Page {page} of {totalPages}
            </span>
            <div>
              <button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Prev
              </button>
              <button disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                Next
              </button>
            </div>
          </footer>
        </section>

        <aside className="note-panel" aria-label="Quick note">
          <div className="note-toolbar">
            <button aria-label="Bold note text">B</button>
            <button aria-label="Italic note text">I</button>
            <button aria-label="Checklist">☑</button>
            <button aria-label="Bullets">•</button>
          </div>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </aside>
      </section>

      {isReviewOpen ? (
        <ReviewModal
          suggestions={suggestions}
          onApprove={approveSuggestion}
          onApproveAll={approveAll}
          onDismiss={dismissSuggestion}
          onClose={() => setReviewOpen(false)}
          onEdit={updateSuggestion}
        />
      ) : null}

      {drawer ? (
        <DrawerShell title={drawerTitle(drawer, selectedHospital)} onClose={() => setDrawer(null)}>
          {drawer === "hospital" && selectedHospital ? <EditableHospitalDetail hospital={selectedHospital} onSave={saveHospital} /> : null}
          {drawer === "settings" ? <EditableSettingsDrawer settings={settings} onSave={setSettings} /> : null}
          {drawer === "audit" ? <EditableAuditDrawer hospitals={hospitals} /> : null}
          {drawer === "files" ? <EditableFileStorageDrawer hospitals={hospitals} /> : null}
          {drawer === "new" ? <EditableNewHospitalDrawer onCreate={createNewHospital} /> : null}
        </DrawerShell>
      ) : null}
    </main>
  );
}

function createSuggestions(text: string, hospitals: Hospital[], source = "Messy note"): Suggestion[] {
  const lower = text.toLowerCase();
  const urgent = hospitals.find((hospital) => hospital.name.includes("Northbridge")) ?? hospitals[0];
  const legal = hospitals.find((hospital) => hospital.name.includes("Harborview")) ?? hospitals[2];
  const pilot = hospitals.find((hospital) => hospital.name.includes("Redwood")) ?? hospitals[12];
  const active = hospitals.find((hospital) => hospital.name.includes("Riverbend")) ?? hospitals[15];
  const maybeMentioned = hospitals.find((hospital) => lower.includes(hospital.name.toLowerCase().split(" ")[0]));

  const picked = maybeMentioned ?? urgent;
  return [
    buildSuggestion(picked, "nextStep", picked.nextStep, "Send two kickoff slots and ask coordinator to confirm", 92, source),
    buildSuggestion(picked, "awaiting", picked.awaiting, "us", 88, source),
    buildSuggestion(legal, "nextStep", legal.nextStep, "Send EAA packet with admin instructions", 84, source),
    buildSuggestion(pilot, "lastInteraction", pilot.lastInteraction, "PI asked whether first feasibility form was submitted", 81, source),
    buildSuggestion(active, "stage", active.stage, "Active", 76, source, active.stage === "Pilot" ? "This moves the site from Pilot to Active. Confirm pilot completion first." : undefined),
  ];
}

function buildSuggestion(
  hospital: Hospital,
  field: Suggestion["field"],
  currentValue: string,
  suggestedValue: string,
  confidence: number,
  source: string,
  conflict?: string,
): Suggestion {
  return {
    id: `${hospital.id}-${field}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    field,
    currentValue,
    suggestedValue,
    confidence,
    evidence: source,
    conflict,
  };
}

function applySuggestion(hospitals: Hospital[], suggestion: Suggestion) {
  return hospitals.map((hospital) => {
    if (hospital.id !== suggestion.hospitalId) return hospital;
    const next = { ...hospital };
    if (suggestion.field === "stage" && isStage(suggestion.suggestedValue)) next.stage = suggestion.suggestedValue;
    if (suggestion.field === "nextStep") next.nextStep = suggestion.suggestedValue;
    if (suggestion.field === "lastInteraction") {
      next.lastInteraction = suggestion.suggestedValue;
      next.lastInteractionAt = "2026-07-18";
    }
    if (suggestion.field === "awaiting") next.awaiting = suggestion.suggestedValue.toLowerCase().includes("hospital") ? "hospital" : "us";
    if (suggestion.field === "notes") next.notes = suggestion.suggestedValue;

    next.evidence = [
      {
        id: `${suggestion.id}-evidence`,
        label: suggestion.evidence,
        text: `${suggestion.field}: ${suggestion.currentValue} -> ${suggestion.suggestedValue}`,
        at: "2026-07-18",
      },
      ...next.evidence,
    ];
    next.audit = [
      {
        id: `${suggestion.id}-audit`,
        at: "2026-07-18 20:45",
        by: "Demo user",
        action: `Approved ${suggestion.field} update`,
        source: suggestion.evidence,
      },
      ...next.audit,
    ];
    next.stageHistory = suggestion.field === "stage" ? [`${next.stage}: approved on 18 Jul`, ...next.stageHistory] : next.stageHistory;
    return next;
  });
}

function ReviewModal({
  suggestions,
  onApprove,
  onApproveAll,
  onDismiss,
  onEdit,
  onClose,
}: {
  suggestions: Suggestion[];
  onApprove: (suggestion: Suggestion) => void;
  onApproveAll: () => void;
  onDismiss: (id: string) => void;
  onEdit: (id: string, value: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Suggested changes">
      <section className="review-modal">
        <header>
          <div>
            <p className="eyebrow">Human review required</p>
            <h2>Dawn found {suggestions.length} suggested changes</h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="suggestion-list">
          {suggestions.map((suggestion) => (
            <article className="suggestion" key={suggestion.id}>
              <div>
                <b>{suggestion.hospitalName}</b>
                <span>{suggestion.field}</span>
              </div>
              <input value={suggestion.suggestedValue} onChange={(event) => onEdit(suggestion.id, event.target.value)} />
              <small>
                {suggestion.confidence}% confidence · source: {suggestion.evidence}
              </small>
              {suggestion.conflict ? <p className="conflict">{suggestion.conflict}</p> : null}
              <div className="suggestion-actions">
                <button onClick={() => onApprove(suggestion)}>Accept</button>
                <button onClick={() => onDismiss(suggestion.id)}>Dismiss</button>
              </div>
            </article>
          ))}
        </div>
        <footer>
          <button className="soft-action" onClick={onClose}>
            Later
          </button>
          <button className="primary-action" disabled={!suggestions.length} onClick={onApproveAll}>
            Accept all
          </button>
        </footer>
      </section>
    </div>
  );
}

function DrawerShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close drawer" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </aside>
    </div>
  );
}

function HospitalDetail({ hospital }: { hospital: Hospital }) {
  return (
    <div className="drawer-stack">
      <section>
        <h3>Hidden detail</h3>
        <p>{hospital.notes}</p>
      </section>
      <section>
        <h3>Contacts</h3>
        {hospital.contacts.map((contact) => (
          <div className="detail-row" key={contact.id}>
            <b>{contact.title}</b>
            <span>{contact.name}</span>
            <small>{contact.email}</small>
          </div>
        ))}
      </section>
      <section>
        <h3>Evidence</h3>
        {hospital.evidence.map((item) => (
          <div className="detail-row" key={item.id}>
            <b>{item.label}</b>
            <span>{item.text}</span>
            <small>{formatDate(item.at)}</small>
          </div>
        ))}
      </section>
      <section>
        <h3>Audit trail</h3>
        {hospital.audit.map((entry) => (
          <div className="detail-row" key={entry.id}>
            <b>{entry.action}</b>
            <span>{entry.source}</span>
            <small>
              {entry.by} · {entry.at}
            </small>
          </div>
        ))}
      </section>
      <section>
        <h3>Stage history</h3>
        {hospital.stageHistory.map((item) => (
          <p className="history-line" key={item}>
            {item}
          </p>
        ))}
      </section>
    </div>
  );
}

function SettingsDrawer() {
  return (
    <div className="drawer-stack">
      <section>
        <h3>Columns</h3>
        {["Status", "Hospital", "Stage", "Next step", "Last interaction", "Awaiting"].map((label) => (
          <label className="setting-row" key={label}>
            <input type="checkbox" defaultChecked />
            <span>{label}</span>
          </label>
        ))}
      </section>
      <section>
        <h3>Stages</h3>
        {stages.map((stage) => (
          <label className="setting-row" key={stage}>
            <input defaultValue={stage} />
          </label>
        ))}
      </section>
      <section>
        <h3>Status timing</h3>
        <p>Waiting on us is urgent first. Stage timing then controls how quickly a site cools.</p>
      </section>
    </div>
  );
}

function AuditDrawer({ hospitals }: { hospitals: Hospital[] }) {
  const audit = hospitals.flatMap((hospital) => hospital.audit.map((entry) => ({ ...entry, hospital: hospital.name }))).slice(0, 24);
  return (
    <div className="drawer-stack">
      {audit.map((entry) => (
        <section className="detail-row" key={entry.id}>
          <b>{entry.hospital}</b>
          <span>{entry.action}</span>
          <small>
            {entry.by} · {entry.at}
          </small>
        </section>
      ))}
    </div>
  );
}

function NewHospitalDrawer({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="drawer-stack">
      <section>
        <h3>Manual fallback</h3>
        <p>Use this only when there is no messy note, email, file, or voice update to parse.</p>
        <button className="primary-action" onClick={onCreate}>
          Create hospital
        </button>
      </section>
    </div>
  );
}

function SunSignal({ signal }: { signal: Signal }) {
  return <span className={`sun-signal ${signal}`} aria-label={`${signal} activation status`} />;
}

function urgencyScore(hospital: Hospital) {
  const days = daysSince(hospital.lastInteractionAt);
  const threshold = stageThresholds[hospital.stage];
  const overdueRatio = days / threshold;
  const waitingBoost = hospital.awaiting === "us" ? 200 : 0;
  return waitingBoost + overdueRatio * 100 + days;
}

function signalFor(hospital: Hospital): Signal {
  const ratio = daysSince(hospital.lastInteractionAt) / stageThresholds[hospital.stage];
  if (hospital.awaiting === "us" && ratio >= 1.4) return "critical";
  if (ratio >= 1.1) return "cold";
  if (ratio >= 0.55) return "warm";
  return "bright";
}

function daysSince(date: string) {
  return Math.max(0, Math.floor((today.getTime() - new Date(`${date}T12:00:00+08:00`).getTime()) / 86400000));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00+08:00`));
}

function isStage(value: string): value is Stage {
  return stages.includes(value as Stage);
}

function drawerTitle(drawer: Drawer, hospital: Hospital | null) {
  if (drawer === "hospital") return hospital?.name ?? "Hospital detail";
  if (drawer === "settings") return "Settings";
  if (drawer === "audit") return "Audit trail";
  if (drawer === "files") return "File storage";
  if (drawer === "new") return "New hospital";
  return "";
}

function timestampNow() {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
}

function describeHospitalChanges(previous: Hospital, next: Hospital) {
  const changes: string[] = [];
  const fields: Array<[keyof Hospital, string]> = [
    ["name", "hospital"],
    ["stage", "stage"],
    ["substage", "substage"],
    ["nextStep", "next step"],
    ["lastInteractionAt", "last interaction date"],
    ["lastInteraction", "last interaction"],
    ["awaiting", "awaiting"],
    ["notes", "notes"],
  ];

  fields.forEach(([field, label]) => {
    if (previous[field] !== next[field]) {
      changes.push(`${label}: ${String(previous[field])} -> ${String(next[field])}`);
    }
  });

  const contactSnapshot = (contacts: Contact[]) =>
    contacts.map((contact) => `${contact.id}:${contact.name}:${contact.email}:${contact.department}:${contact.title}`).join("|");

  if (contactSnapshot(previous.contacts) !== contactSnapshot(next.contacts)) {
    changes.push("contacts updated");
  }

  return changes;
}

function exportCsv(hospitals: Hospital[]) {
  const header = ["Hospital", "Country", "Stage", "Substage", "Next step", "Last interaction", "Awaiting", "Notes"];
  const rows = hospitals.map((hospital) => [
    hospital.name,
    hospital.country,
    hospital.stage,
    hospital.substage,
    hospital.nextStep,
    hospital.lastInteraction,
    hospital.awaiting,
    hospital.notes,
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dawn-hospital-activation.csv";
  link.click();
  URL.revokeObjectURL(url);
}

type SpeechRecognitionEventLike = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: () => void;
  onend: () => void;
  onerror: () => void;
  onresult: (event: SpeechRecognitionEventLike) => void;
  start: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </Icon>
  );
}

function MicIcon() {
  return (
    <Icon>
      <path d="M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v3M9 20h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  );
}

function PaperclipIcon() {
  return (
    <Icon>
      <path d="m9 13 5.8-5.8a3 3 0 0 1 4.2 4.2l-7.2 7.2a5 5 0 0 1-7.1-7.1l7.6-7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  );
}

function ArrowUpIcon() {
  return (
    <Icon>
      <path d="M12 19V5m0 0-6 6m6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

function HistoryIcon() {
  return (
    <Icon>
      <path d="M4 12a8 8 0 1 0 2.3-5.6M4 5v5h5M12 8v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

function SettingsIcon() {
  return (
    <Icon>
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4m-8.6 8.6-1.4 1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  );
}

function DownloadIcon() {
  return (
    <Icon>
      <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

function UserPlusIcon() {
  return (
    <Icon>
      <path d="M15 19a6 6 0 0 0-12 0M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6m-3-3h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  );
}

function LogoutIcon() {
  return (
    <Icon>
      <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M18 12H9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}
