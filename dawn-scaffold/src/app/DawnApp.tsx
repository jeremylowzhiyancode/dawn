"use client";

import { ChangeEvent, KeyboardEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
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
export type SortKey = "priority" | "hospital" | "stage" | "nextStep" | "lastInteraction" | "awaiting" | "country";
export type SortDirection = "asc" | "desc";
type Priority = "Low" | "Med" | "High" | "Urgent";
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

export type StoredFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  source: "Dawn AI";
  hospitalId: string;
  hospitalName: string;
};

export type EvidenceItem = {
  id: string;
  label: string;
  text: string;
  at: string;
  kind?: "note" | "voice" | "file" | "image";
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
  priorityAdjustment: number;
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
    priority: string;
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

type ChatMessage = {
  id: string;
  content: string;
};

const today = new Date("2026-07-18T12:00:00+08:00");
export const stages: Stage[] = ["Interest", "Kickoff", "Pilot", "Active"];
export const countries: Country[] = ["Singapore", "Malaysia", "Indonesia", "Thailand", "Vietnam"];
export const stageSubstages: Record<Stage, string[]> = {
  Interest: ["Agreements sent", "LOI signed", "EAA signed"],
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
  "Other, please specify",
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
  aiModel: "Demo mode — no API cost",
  systemPrompt:
    "You are Dawn AI, a hospital site activation assistant for a tiny startup. Parse messy notes into suggested hospital, contact, stage, next-step, date, notes, and awaiting-who updates. Never update records automatically. Always show evidence, confidence, duplicate/conflict checks, and require human approval.",
  fieldLabels: {
    priority: "Priority",
    hospital: "Hospital",
    stage: "Stage",
    nextStep: "Next step",
    lastInteraction: "Last interaction",
    awaiting: "Awaiting",
  },
  visibleColumns: ["priority", "hospital", "stage", "nextStep", "lastInteraction", "awaiting"],
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
].map(addDemoInteractions);

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
    priorityAdjustment: 0,
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
  const [note, setNote] = useState("<strong>High priority</strong><br>☐ Book kickoff for Northbridge<br>☐ Send EAA packet to Harborview<br>☐ Check pilot form at Redwood");
  const [composer, setComposer] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isReviewOpen, setReviewOpen] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<Hospital[] | null>(null);
  const [isListening, setListening] = useState(false);
  const [isDawnExpanded, setDawnExpanded] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState(initialSettings);
  const [uploadedFiles, setUploadedFiles] = useState<StoredFile[]>([]);
  const [draggedHospitalId, setDraggedHospitalId] = useState<string | null>(null);
  const [dragOverHospitalId, setDragOverHospitalId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const previousRowPositions = useRef(new Map<string, DOMRect>());

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
      .sort((a, b) => priorityScore(b) - priorityScore(a));
  }, [activeStage, hospitals, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const visibleHospitals = filtered.slice((page - 1) * 10, page * 10);
  const selectedHospital = hospitals.find((hospital) => hospital.id === selectedId) ?? null;

  useLayoutEffect(() => {
    const nextPositions = new Map<string, DOMRect>();
    rowRefs.current.forEach((element, id) => {
      const nextPosition = element.getBoundingClientRect();
      const previousPosition = previousRowPositions.current.get(id);
      if (previousPosition) {
        const distance = previousPosition.top - nextPosition.top;
        if (Math.abs(distance) > 2) {
          element.animate(
            [
              { transform: `translateY(${distance}px)`, boxShadow: "0 20px 44px rgba(240, 100, 61, 0.28)" },
              { transform: "translateY(0)", boxShadow: "0 0 0 rgba(240, 100, 61, 0)" },
            ],
            { duration: 460, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
          );
        }
      }
      nextPositions.set(id, nextPosition);
    });
    previousRowPositions.current = nextPositions;
  }, [visibleHospitals]);

  function openHospital(hospital: Hospital) {
    setSelectedId(hospital.id);
    setDrawer("hospital");
  }

  function renameHospital(id: string, name: string) {
    setHospitals((current) =>
      current.map((hospital) => (hospital.id === id ? { ...hospital, name } : hospital)),
    );
  }

  function updateNoteFromEditor() {
    if (noteEditorRef.current) setNote(noteEditorRef.current.innerHTML);
  }

  function formatNote(command: "bold" | "italic" | "insertUnorderedList") {
    noteEditorRef.current?.focus();
    document.execCommand(command);
    updateNoteFromEditor();
  }

  function insertChecklistItem() {
    noteEditorRef.current?.focus();
    document.execCommand("insertText", false, "☐ ");
    updateNoteFromEditor();
  }

  function handleStage(stage: Stage | "All") {
    setActiveStage(stage);
    setPage(1);
  }

  function adjustPriority(hospital: Hospital, direction: 1 | -1) {
    setHospitals((current) =>
      current.map((item) =>
        item.id === hospital.id
          ? {
              ...item,
              priorityAdjustment: Math.max(-60, Math.min(60, item.priorityAdjustment + direction * 20)),
              audit: [
                {
                  id: `audit-${Date.now()}`,
                  at: timestampNow(),
                  by: "Demo user",
                  action: `Moved priority ${direction === 1 ? "up" : "down"}`,
                  source: "Manual priority control",
                },
                ...item.audit,
              ],
            }
          : item,
      ),
    );
  }

  function placeBelow(hospitalId: string) {
    if (!draggedHospitalId || draggedHospitalId === hospitalId) return;

    setHospitals((current) => {
      const draggedHospital = current.find((hospital) => hospital.id === draggedHospitalId);
      const targetHospital = current.find((hospital) => hospital.id === hospitalId);
      if (!draggedHospital || !targetHospital) return current;

      const nextAdjustment = priorityScore(targetHospital) - 1 - suggestedPriorityScore(draggedHospital);
      return current.map((hospital) =>
        hospital.id === draggedHospital.id
          ? {
              ...hospital,
              priorityAdjustment: nextAdjustment,
              audit: [
                {
                  id: `audit-${Date.now()}`,
                  at: timestampNow(),
                  by: "Demo user",
                  action: `Placed below ${targetHospital.name} in priority order`,
                  source: "Manual drag priority",
                },
                ...hospital.audit,
              ],
            }
          : hospital,
      );
    });
    setDraggedHospitalId(null);
    setDragOverHospitalId(null);
  }

  function handleComposerSend() {
    const text = composer.trim();
    if (!text) return;

    recordChatMessage(text);
    setDawnExpanded(true);

    if (/export|excel|download/i.test(text)) {
      exportCsv(hospitals);
      setComposer("");
      return;
    }

    setSuggestions(createSuggestions(text, hospitals));
    setComposer("");
  }

  function recordChatMessage(content: string) {
    setChatMessages((current) => {
      if (current[current.length - 1]?.content === content) return current;
      return [...current, { id: `chat-${Date.now()}`, content }];
    });
  }

  function inferAttachmentHospital(signal: string) {
    const selectedHospital = hospitals.find((hospital) => hospital.id === selectedId);
    if (selectedHospital) return selectedHospital;

    const normalizedSignal = signal.toLowerCase();
    const namedHospital = hospitals.find((hospital) =>
      hospital.name
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((word) => word.length >= 5)
        .some((word) => normalizedSignal.includes(word)),
    );
    return namedHospital ?? [...hospitals].sort((a, b) => priorityScore(b) - priorityScore(a))[0];
  }

  function attachInteraction(hospitalId: string, interaction: EvidenceItem) {
    setHospitals((current) =>
      current.map((hospital) =>
        hospital.id === hospitalId
          ? {
              ...hospital,
              evidence: [interaction, ...hospital.evidence],
              audit: [
                {
                  id: `audit-${interaction.id}`,
                  at: timestampNow(),
                  by: "Demo user",
                  action: `Attached ${interaction.kind === "voice" ? "voice note" : interaction.label}`,
                  source: "Dawn AI",
                },
                ...hospital.audit,
              ],
            }
          : hospital,
      ),
    );
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const hospital = inferAttachmentHospital(file.name);
    if (!hospital) return;
    const kind = file.type.startsWith("image/") ? "image" : "file";
    const interaction: EvidenceItem = {
      id: `interaction-${Date.now()}`,
      label: file.name,
      text: `Attached through Dawn AI and linked to ${hospital.name}.`,
      at: today.toISOString().slice(0, 10),
      kind,
    };
    attachInteraction(hospital.id, interaction);
    setUploadedFiles((current) => [
      {
        id: `file-${Date.now()}`,
        name: file.name,
        type: file.type || "Unknown file type",
        size: file.size,
        uploadedAt: timestampNow(),
        source: "Dawn AI",
        hospitalId: hospital.id,
        hospitalName: hospital.name,
      },
      ...current,
    ]);
    recordChatMessage(`Attached ${file.name} to ${hospital.name}.`);
    setDawnExpanded(true);
    setSuggestions(createSuggestions(`Uploaded file: ${file.name} for ${hospital.name}`, hospitals, file.name));
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
      const message = "Voice capture is not available in this browser. Type or drop a note instead.";
      setComposer(message);
      recordChatMessage(message);
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
      recordChatMessage(transcript);
      setDawnExpanded(true);
      const hospital = inferAttachmentHospital(transcript);
      if (hospital) {
        attachInteraction(hospital.id, {
          id: `voice-${Date.now()}`,
          label: "Voice note from Jeremy",
          text: transcript,
          at: today.toISOString().slice(0, 10),
          kind: "voice",
        });
      }
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
    recordChatMessage(`Approved: ${suggestion.hospitalName} — ${suggestion.field} updated.`);
  }

  function approveAll() {
    setLastSnapshot(hospitals);
    setHospitals((current) => suggestions.reduce(applySuggestion, current));
    recordChatMessage(`Approved ${suggestions.length} suggested update${suggestions.length === 1 ? "" : "s"}.`);
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
          <DawnLogo />
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
          <button className="icon-button" aria-label="Logout">
            <LogoutIcon />
          </button>
        </div>
      </header>

      <section className="workbench">
        <section className="main-panel" aria-label="Onboard dashboard">
          <div className="panel-header">
            <div>
              <h1>Hospital onboarding</h1>
            </div>
          </div>

          <div className="filter-row">
            <nav className="stage-tabs" aria-label="Activation stages">
              <button className={activeStage === "All" ? "active" : ""} onClick={() => handleStage("All")}>
                <span className="filter-label">All</span>
                <span className="filter-count">{hospitals.length}</span>
              </button>
              {stages.map((stage) => (
                <button key={stage} className={activeStage === stage ? "active" : ""} onClick={() => handleStage(stage)}>
                  <span className="filter-label">{stage}</span>
                  <span className="filter-count">{hospitals.filter((hospital) => hospital.stage === stage).length}</span>
                </button>
              ))}
            </nav>
            <div className="search-shell">
              <input
                className="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search for anything"
              />
              <button className="add-hospital" aria-label="New hospital" onClick={() => setDrawer("new")}>
                <PlusIcon />
              </button>
            </div>
          </div>

          <div className="hospital-table" role="table">
            <div className="table-row table-head" role="row">
              <div role="columnheader" className="status-heading">
                {settings.fieldLabels.priority}
                <span className="info-dot" tabIndex={0}>
                  ^
                  <span className="tooltip">
                    <b>Dawn&apos;s priority suggestion</b>
                    <span>Waiting on Jeremy is weighted first.</span>
                    <span>Older interactions and stage timing raise urgency.</span>
                    <span>Use the arrows to apply your own judgement.</span>
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
                    <StageFlow label="Interest" steps={["Agreements sent", "LOI signed", "EAA signed"]} />
                    <StageFlow label="Kickoff" steps={["Invited", "Scheduled", "Completed"]} />
                    <StageFlow label="Pilot" steps={["Initiated", "Completed"]} />
                    <StageFlow label="Active" steps={["1 month", "2 month", "3 month"]} />
                  </span>
                </span>
              </div>
              <div role="columnheader">{settings.fieldLabels.nextStep}</div>
              <div role="columnheader">{settings.fieldLabels.lastInteraction}</div>
              <div role="columnheader">{settings.fieldLabels.awaiting}</div>
            </div>
            {visibleHospitals.map((hospital) => {
              const priority = priorityFor(hospital);
              const awaitingContact = hospital.awaiting === "hospital" ? contactAwaiting(hospital) : null;
              return (
              <div
                className={`table-row data-row ${dragOverHospitalId === hospital.id ? "is-drag-target" : ""}`}
                role="row"
                key={hospital.id}
                onClick={() => openHospital(hospital)}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  setDraggedHospitalId(hospital.id);
                }}
                onDragEnd={() => {
                  setDraggedHospitalId(null);
                  setDragOverHospitalId(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverHospitalId(hospital.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  placeBelow(hospital.id);
                }}
                ref={(element) => {
                  if (element) rowRefs.current.set(hospital.id, element);
                  else rowRefs.current.delete(hospital.id);
                }}
              >
                <div role="cell" className="priority-cell">
                  <span
                    className={`priority-pill ${priority.toLowerCase()}`}
                    style={{ "--priority-hue": priorityHue(hospital) } as React.CSSProperties}
                  >
                    {priority}
                  </span>
                  <div className="priority-controls" aria-label={`Adjust priority for ${hospital.name}`}>
                    <button
                      className="priority-up"
                      type="button"
                      aria-label={`Move ${hospital.name} priority up`}
                      onClick={(event) => {
                        event.stopPropagation();
                        adjustPriority(hospital, 1);
                      }}
                    >
                      ^
                    </button>
                    <button
                      className="priority-down"
                      type="button"
                      aria-label={`Move ${hospital.name} priority down`}
                      onClick={(event) => {
                        event.stopPropagation();
                        adjustPriority(hospital, -1);
                      }}
                    >
                      ^
                    </button>
                  </div>
                </div>
                <div role="cell">
                  <button className="hospital-name" type="button">
                    {hospital.name}
                  </button>
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
                  <span className={`awaiting ${hospital.awaiting}`}>{hospital.awaiting === "us" ? "Jeremy" : awaitingContact?.name}</span>
                  {awaitingContact ? <small className="awaiting-title">{awaitingContact.title}</small> : null}
                </div>
              </div>
              );
            })}
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

        <aside className="right-rail" aria-label="Notes and Dawn">
          <section className="note-panel" aria-label="Quick note">
          <div className="note-toolbar">
            <button type="button" aria-label="Bold note text" onMouseDown={(event) => event.preventDefault()} onClick={() => formatNote("bold")}>B</button>
            <button type="button" aria-label="Italic note text" onMouseDown={(event) => event.preventDefault()} onClick={() => formatNote("italic")}>I</button>
            <button type="button" aria-label="Checklist" onMouseDown={(event) => event.preventDefault()} onClick={insertChecklistItem}>☑</button>
            <button type="button" aria-label="Bullets" onMouseDown={(event) => event.preventDefault()} onClick={() => formatNote("insertUnorderedList")}>•</button>
          </div>
            <div
              ref={noteEditorRef}
              className="note-editor"
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-label="Quick note editor"
              onInput={updateNoteFromEditor}
              dangerouslySetInnerHTML={{ __html: note }}
            />
          </section>

          <section className={`dawn-sidecar ${isDawnExpanded ? "is-expanded" : ""}`} aria-label="Ask Dawn">
            {isDawnExpanded ? (
              <>
                <header>
                  <div className="chat-title">
                    <DawnLogo />
                    <div>
                      <h2>Ask Dawn</h2>
                      <span>Voice notes, files, and updates stay here.</span>
                    </div>
                  </div>
                </header>
                <div className="chat-thread" aria-live="polite">
                  {chatMessages.length ? (
                    chatMessages.map((message) => <p className="chat-message" key={message.id}>{message.content}</p>)
                  ) : (
                    <p className="chat-empty">Use the microphone for a voice note, or type a quick update.</p>
                  )}
                </div>
                {suggestions.length ? (
                  <section className="chat-suggestions" aria-label="Dawn suggested changes">
                    <header>
                      <div>
                        <b>Dawn suggests {suggestions.length} change{suggestions.length === 1 ? "" : "s"}</b>
                        <small>Review each one before it updates Onboard.</small>
                      </div>
                      <button className="chat-approve-all" onClick={approveAll}>Approve all</button>
                    </header>
                    {suggestions.map((suggestion) => (
                      <article key={suggestion.id}>
                        <div className="chat-suggestion-title">
                          <b>{suggestion.hospitalName}</b>
                          <span>{suggestion.field}</span>
                        </div>
                        <input
                          aria-label={`Suggested ${suggestion.field} for ${suggestion.hospitalName}`}
                          value={suggestion.suggestedValue}
                          onChange={(event) => updateSuggestion(suggestion.id, event.target.value)}
                        />
                        <small>{suggestion.confidence}% confidence · from this update</small>
                        {suggestion.conflict ? <p className="conflict">{suggestion.conflict}</p> : null}
                        <div>
                          <button className="chat-approve" onClick={() => approveSuggestion(suggestion)}>Approve</button>
                          <button className="chat-dismiss" onClick={() => dismissSuggestion(suggestion.id)}>Dismiss</button>
                        </div>
                      </article>
                    ))}
                  </section>
                ) : null}
                <section className="chat-composer" aria-label="Message Dawn">
                  <button className={`mic-button ${isListening ? "is-listening" : ""}`} aria-label="Talk to Dawn" onClick={toggleMic}>
                    <MicIcon />
                  </button>
                  <input
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                      if (event.key === "Enter") handleComposerSend();
                    }}
                    placeholder="Speak or type an update"
                  />
                  <input ref={fileInputRef} type="file" className="sr-only" onChange={handleFile} />
                  <button className="composer-icon" aria-label="Attach file" onClick={() => fileInputRef.current?.click()}>
                    <PaperclipIcon />
                  </button>
                  <button className="send-button" aria-label="Send to Dawn" onClick={handleComposerSend}>
                    <ArrowUpIcon />
                  </button>
                </section>
              </>
            ) : (
              <button className="dawn-prompt" type="button" onClick={() => setDawnExpanded(true)} aria-expanded={false}>
                <span className="dawn-prompt-mic" aria-hidden="true"><MicIcon /></span>
                <span>
                  <b>How can Dawn help?</b>
                </span>
              </button>
            )}
          </section>
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
        <DrawerShell
          title={drawerTitle(drawer, selectedHospital)}
          onClose={() => setDrawer(null)}
          onTitleChange={drawer === "hospital" && selectedHospital ? (name) => renameHospital(selectedHospital.id, name) : undefined}
        >
          {drawer === "hospital" && selectedHospital ? (
            <EditableHospitalDetail
              hospital={selectedHospital}
              onSave={(nextHospital) => {
                saveHospital(nextHospital);
                setDrawer(null);
              }}
            />
          ) : null}
          {drawer === "settings" ? <EditableSettingsDrawer settings={settings} onSave={setSettings} /> : null}
          {drawer === "audit" ? <EditableAuditDrawer hospitals={hospitals} /> : null}
          {drawer === "files" ? <EditableFileStorageDrawer files={uploadedFiles} /> : null}
          {drawer === "new" ? <EditableNewHospitalDrawer onCreate={createNewHospital} /> : null}
        </DrawerShell>
      ) : null}
    </main>
  );
}

function createSuggestions(text: string, hospitals: Hospital[], source = "Messy note"): Suggestion[] {
  const lower = text.toLowerCase();
  const mentioned = hospitals.find((hospital) => {
    const name = hospital.name.toLowerCase();
    const distinctiveWord = name.split(/[^a-z]+/).find((word) => word.length >= 6);
    return lower.includes(name) || Boolean(distinctiveWord && lower.includes(distinctiveWord));
  });
  const target = mentioned ?? [...hospitals].sort((a, b) => priorityScore(b) - priorityScore(a))[0];
  if (!target) return [];

  const updates: Suggestion[] = [];
  const conciseUpdate = text.replace(/\s+/g, " ").trim().slice(0, 180);
  updates.push(buildSuggestion(target, "lastInteraction", target.lastInteraction, conciseUpdate, mentioned ? 94 : 62, source, mentioned ? undefined : "No organisation was named, so Dawn selected the highest-priority site. Confirm before approving."));

  if (/\b(eaa|loi|agreement|data agreement)\b.*\b(signed|complete|approved)\b/.test(lower)) {
    updates.push(buildSuggestion(target, "nextStep", target.nextStep, "Schedule kickoff", mentioned ? 90 : 58, source));
  } else if (/\bkickoff\b.*\b(scheduled|booked|confirmed)\b/.test(lower)) {
    updates.push(buildSuggestion(target, "stage", target.stage, "Kickoff", mentioned ? 89 : 58, source));
  } else if (/\bpilot\b.*\b(completed|complete)\b/.test(lower)) {
    updates.push(buildSuggestion(target, "stage", target.stage, "Active", mentioned ? 86 : 56, source, "Confirm the site has completed its pilot exit criteria before approving."));
  } else if (/\bpilot\b/.test(lower)) {
    updates.push(buildSuggestion(target, "stage", target.stage, "Pilot", mentioned ? 84 : 55, source));
  }

  if (/\b(waiting on us|waiting on jeremy|we need to|our team)\b/.test(lower)) {
    updates.push(buildSuggestion(target, "awaiting", target.awaiting, "us", mentioned ? 88 : 58, source));
  } else if (/\b(waiting on|awaiting|pending with)\b/.test(lower)) {
    updates.push(buildSuggestion(target, "awaiting", target.awaiting, "hospital", mentioned ? 84 : 56, source));
  }

  return updates.slice(0, 3);
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

function DrawerShell({
  title,
  children,
  onClose,
  onTitleChange,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onTitleChange?: (value: string) => void;
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <header>
          {onTitleChange ? (
            <input
              className="drawer-title-input"
              aria-label="Hospital name"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          ) : (
            <h2>{title}</h2>
          )}
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

function suggestedPriorityScore(hospital: Hospital) {
  const days = daysSince(hospital.lastInteractionAt);
  const threshold = stageThresholds[hospital.stage];
  const timingScore = Math.min(45, (days / threshold) * 32 + Math.min(days, 14));
  const awaitingScore = hospital.awaiting === "us" ? 40 : 0;
  return 10 + timingScore + awaitingScore;
}

function addDemoInteractions(hospital: Hospital) {
  const examples: Record<string, EvidenceItem[]> = {
    h01: [
      {
        id: "h01-voice-demo",
        label: "Voice note from Jeremy",
        text: "Please offer two kickoff slots next week and confirm the EAA is on file.",
        at: "2026-07-17",
        kind: "voice",
      },
    ],
    h03: [
      {
        id: "h03-pdf-demo",
        label: "LOI-signed.pdf",
        text: "PDF attached through Dawn AI and linked to Harborview Clinical Institute.",
        at: "2026-07-16",
        kind: "file",
      },
    ],
    h04: [
      {
        id: "h04-image-demo",
        label: "pilot-workspace.png",
        text: "Image attached through Dawn AI and linked to Silverline General Hospital.",
        at: "2026-07-15",
        kind: "image",
      },
    ],
  };

  const interactions = examples[hospital.id] ?? [];
  return interactions.length ? { ...hospital, evidence: [...interactions, ...hospital.evidence] } : hospital;
}

function priorityScore(hospital: Hospital) {
  return suggestedPriorityScore(hospital) + hospital.priorityAdjustment;
}

function priorityFor(hospital: Hospital): Priority {
  const score = priorityScore(hospital);
  if (score >= 78) return "Urgent";
  if (score >= 57) return "High";
  if (score >= 34) return "Med";
  return "Low";
}

function priorityHue(hospital: Hospital) {
  const intensity = Math.max(0, Math.min(1, (priorityScore(hospital) - 10) / 80));
  return String(Math.round(150 - intensity * 150));
}

function contactAwaiting(hospital: Hospital) {
  return hospital.contacts.find((contact) => contact.id === hospital.awaitingContactId) ?? hospital.contacts[0];
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

function DawnLogo() {
  return (
    <svg className="dawn-logo" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="7" fill="#e64a2f" />
      <circle cx="12" cy="10.2" r="3.4" fill="#ffd55a" />
      <path d="M4 14.4h16" stroke="#9f2131" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 16.2h6l-.8 5h-4.4z" fill="#ff762d" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <Icon>
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </Icon>
  );
}

function StageFlow({ label, steps }: { label: string; steps: string[] }) {
  return (
    <span className="stage-flow">
      <b>{label}</b>
      <span className="stage-flow-steps">
        {steps.map((step, index) => (
          <span className="stage-flow-step" key={step}>
            {index > 0 ? <FlowArrowIcon /> : null}
            {step}
          </span>
        ))}
      </span>
    </span>
  );
}

function FlowArrowIcon() {
  return (
    <Icon>
      <path d="M4 12h15m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
