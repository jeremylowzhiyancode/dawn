"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { extractFileContent } from "./fileText";
import { playDawnReceiveSound, playDawnSendSound } from "./dawnSounds";
import {
  AuditDrawer as EditableAuditDrawer,
  FileStorageDrawer as EditableFileStorageDrawer,
  HospitalDetail as EditableHospitalDetail,
  NewHospitalDrawer as EditableNewHospitalDrawer,
  SettingsDrawer as EditableSettingsDrawer,
} from "./Drawers";

export type Stage = "Interest" | "Kickoff" | "Pilot" | "Active";
export type Awaiting = "us" | "hospital";
export type CountryPreset = "Singapore" | "Malaysia" | "Indonesia" | "Thailand";
export type Country = string;
export type SortKey = "priority" | "hospital" | "stage" | "nextStep" | "lastInteraction" | "awaiting" | "country";
export type SortDirection = "asc" | "desc";
type Priority = "Low" | "Med" | "High" | "Very high" | "Urgent" | "Critical";
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
  content?: string;
  data?: ArrayBuffer;
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
  substageOptions: Record<Stage, string[]>;
};

type Suggestion = {
  id: string;
  hospitalId: string;
  hospitalName: string;
  field: "stage" | "nextStep" | "lastInteraction" | "awaiting" | "notes" | "create" | "createContact" | "updateContact";
  currentValue: string;
  suggestedValue: string;
  confidence: number;
  evidence: string;
  conflict?: string;
  createCountry?: string;
  createNextStep?: string;
  createSummary?: string;
  contactId?: string;
  contactEmail?: string;
  contactDepartment?: string;
  contactTitle?: ContactTitle;
  contactCurrentEmail?: string;
  contactCurrentDepartment?: string;
  contactCurrentTitle?: ContactTitle;
};

type SuggestionPatch = Partial<
  Pick<Suggestion, "suggestedValue" | "contactEmail" | "contactDepartment" | "contactTitle" | "createCountry" | "createNextStep">
>;

function suggestionFieldLabel(field: Suggestion["field"]): string {
  switch (field) {
    case "create":
      return "New hospital";
    case "createContact":
      return "New contact";
    case "updateContact":
      return "Update contact";
    case "lastInteraction":
      return "Last interaction";
    case "nextStep":
      return "Next step";
    case "awaiting":
      return "Awaiting";
    case "notes":
      return "Notes";
    case "stage":
      return "Stage";
    default:
      return field;
  }
}

function suggestionFieldPhrase(field: Suggestion["field"]): string {
  switch (field) {
    case "create":
      return "a new hospital record";
    case "createContact":
      return "a new contact";
    case "updateContact":
      return "contact";
    case "lastInteraction":
      return "last interaction";
    case "nextStep":
      return "next step";
    case "awaiting":
      return "who it's waiting on";
    case "notes":
      return "notes";
    case "stage":
      return "stage";
    default:
      return field;
  }
}

function joinNaturalList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function describeAssistantPlanIntro(suggestions: Suggestion[]): string {
  if (suggestions.length === 1 && suggestions[0]?.field === "create") {
    return `Okay, noted. It sounds like you want to add ${suggestions[0].suggestedValue} as a new hospital. I’ve prepared the change below for your approval.`;
  }
  return `Okay, noted. It sounds like you want to update ${describeSuggestionPlan(suggestions)}. I’ve prepared ${suggestions.length === 1 ? "the change" : "the changes"} below for your approval.`;
}

function describeSuggestionPlan(suggestions: Suggestion[]): string {
  const byHospital = new Map<string, Suggestion[]>();
  for (const suggestion of suggestions) {
    const current = byHospital.get(suggestion.hospitalName) ?? [];
    current.push(suggestion);
    byHospital.set(suggestion.hospitalName, current);
  }

  const hospitalPhrases = [...byHospital.entries()].map(([hospitalName, items]) => {
    if (items.length === 1 && items[0]?.field === "create") {
      return `add ${hospitalName} as a new hospital`;
    }
    const parts = joinNaturalList(items.map((item) => suggestionFieldPhrase(item.field)));
    return `${hospitalName}'s ${parts}`;
  });

  return joinNaturalList(hospitalPhrases);
}

function formatContactLine(contact: Contact): string {
  return `${contact.name} · ${contact.title} · ${contact.email || "no email"}`;
}

function normalizeContactTitle(value: string | undefined | null): ContactTitle {
  if (!value) return "Clinical Research Coordinator (CRC)";
  const exact = contactTitles.find((title) => title.toLowerCase() === value.trim().toLowerCase());
  if (exact) return exact;
  const lower = value.toLowerCase();
  if (/principal investigator|\bpi\b/.test(lower)) return "Principal Investigator (PI)";
  if (/crc|clinical research coordinator|coordinator/.test(lower)) return "Clinical Research Coordinator (CRC)";
  if (/feasibility/.test(lower)) return "Feasibility Manager / Feasibility Coordinator";
  if (/regulatory/.test(lower)) return "Regulatory Affairs Manager/Coordinator";
  if (/administrator|admin/.test(lower)) return "Hospital Administrator";
  if (/legal|counsel/.test(lower)) return "Legal Counsel";
  return "Clinical Research Coordinator (CRC)";
}

function findContactOnHospital(hospital: Hospital, hint: string, contactId?: string | null): Contact | undefined {
  if (contactId) return hospital.contacts.find((contact) => contact.id === contactId);
  const needle = hint.trim().toLowerCase();
  if (!needle) return undefined;
  const needleFirst = needle.split(/\s+/)[0] ?? needle;
  return hospital.contacts.find((contact) => {
    const name = contact.name.toLowerCase();
    const first = name.split(/\s+/)[0] ?? name;
    return name === needle || name.includes(needle) || needle.includes(name) || first === needleFirst;
  });
}

type ChatMessage = {
  id: string;
  content: string;
  role: "user" | "assistant";
  aiLabel?: string;
};

const today = new Date("2026-07-18T12:00:00+08:00");
const dawnPrompts = [
  "What's cooking?",
  "Got a quick update?",
  "Busy day? I've got you.",
  "Tell me the tea.",
  "Need a hand?",
  "Let's make this easy.",
  "What are we tackling?",
  "Drop me a note.",
];
const DEFAULT_NOTE_HTML =
  '<strong>High priority</strong><br><label><input type="checkbox" /> Book kickoff for Northbridge</label><label><input type="checkbox" /> Send EAA packet to Harborview</label><label><input type="checkbox" /> Check pilot form at Redwood</label>';
const dashboardGreetings = [
  "A clearer day ahead.",
  "Welcome back — let’s keep this going.",
  "You’ve got this. One good move at a time.",
  "Let’s make today feel lighter.",
  "Small wins add up. You’re on it.",
  "Ready when you are.",
];

function findChecklistLabel(node: Node | null, editor: HTMLElement): HTMLLabelElement | null {
  let current: Node | null = node;
  if (current?.nodeType === Node.TEXT_NODE) current = current.parentNode;
  while (current && current !== editor) {
    if (current instanceof HTMLLabelElement && current.querySelector('input[type="checkbox"]')) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function createChecklistLabel(): HTMLLabelElement {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  label.append(checkbox, document.createTextNode(" "));
  return label;
}

function getChecklistTextNode(label: HTMLLabelElement): Text {
  const checkbox = label.querySelector('input[type="checkbox"]');
  let textNode = checkbox?.nextSibling ?? null;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    textNode = document.createTextNode(" ");
    label.appendChild(textNode);
  }
  return textNode as Text;
}

function placeCaretInChecklistLabel(label: HTMLLabelElement, editor: HTMLElement) {
  const textNode = getChecklistTextNode(label);
  const range = document.createRange();
  range.setStart(textNode, textNode.textContent?.length ?? 0);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  editor.focus();
  label.scrollIntoView({ block: "nearest" });
}

function insertChecklistRow(editor: HTMLDivElement, after?: HTMLLabelElement | null) {
  const row = createChecklistLabel();
  if (after) {
    after.after(row);
  } else {
    editor.appendChild(row);
  }
  placeCaretInChecklistLabel(row, editor);
  return row;
}
export const stages: Stage[] = ["Interest", "Kickoff", "Pilot", "Active"];
export const countryPresets: CountryPreset[] = ["Singapore", "Malaysia", "Indonesia", "Thailand"];
export const countryOtherOption = "Others, please specify";
/** @deprecated use countryPresets */
export const countries: CountryPreset[] = countryPresets;

export function isCountryPreset(value: string): value is CountryPreset {
  return countryPresets.includes(value as CountryPreset);
}

export function normalizeCountryValue(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  const preset = countryPresets.find((country) => country.toLowerCase() === trimmed.toLowerCase());
  return preset ?? trimmed;
}

export function CountryField({ value, onChange }: { value: string; onChange: (country: string) => void }) {
  const [isCustomCountry, setCustomCountry] = useState(!isCountryPreset(value));

  function selectCountry(option: string) {
    if (option === countryOtherOption) {
      setCustomCountry(true);
      if (isCountryPreset(value)) onChange("");
      return;
    }
    setCustomCountry(false);
    onChange(option);
  }

  if (isCustomCountry) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type the country"
        aria-label="Custom country"
      />
    );
  }

  return (
    <select value={value} onChange={(event) => selectCountry(event.target.value)}>
      {countryPresets.map((country) => (
        <option key={country} value={country}>
          {country}
        </option>
      ))}
      <option value={countryOtherOption}>{countryOtherOption}</option>
    </select>
  );
}
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
  substageOptions: {
    Interest: ["Agreements sent", "LOI signed", "EAA signed"],
    Kickoff: ["Kickoff invited", "Kickoff scheduled", "Kickoff completed"],
    Pilot: ["Pilot initiated", "Pilot completed"],
    Active: ["1 month check-in", "2 month check-in", "3 month check-in"],
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
  const [note, setNote] = useState(DEFAULT_NOTE_HTML);
  const [composer, setComposer] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isReviewOpen, setReviewOpen] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<Hospital[] | null>(null);
  const [isListening, setListening] = useState(false);
  const [isDawnExpanded, setDawnExpanded] = useState(false);
  const [isChatFocused, setChatFocused] = useState(false);
  const [chatThreadOverflows, setChatThreadOverflows] = useState(false);
  const [hospitalDrawerFocus, setHospitalDrawerFocus] = useState<{ tab?: "details" | "contacts" | "activity"; contactId?: string } | null>(null);
  const [isDrawerOverChat, setDrawerOverChat] = useState(false);
  const [dawnPromptIndex, setDawnPromptIndex] = useState(0);
  const [dashboardGreetingIndex, setDashboardGreetingIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState(initialSettings);
  const [uploadedFiles, setUploadedFiles] = useState<StoredFile[]>([
    {
      id: "demo-kickoff-note",
      name: "Northbridge kickoff notes.txt",
      type: "text/plain",
      size: 184,
      uploadedAt: "Jul 18, 2026, 3:10 PM",
      source: "Dawn AI",
      hospitalId: "h01",
      hospitalName: "Northbridge University Hospital",
      content: "Northbridge kickoff notes\n\n- EAA confirmed\n- Offer two kickoff slots next week\n- Confirm IT attendee\n",
    },
  ]);
  const [isFileDragging, setFileDragging] = useState(false);
  const [isReadingFile, setReadingFile] = useState(false);
  const [draggedHospitalId, setDraggedHospitalId] = useState<string | null>(null);
  const [dragOverHospitalId, setDragOverHospitalId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const skipNoteSyncRef = useRef(false);
  const dawnPanelRef = useRef<HTMLElement>(null);
  const ignoreDawnDismissRef = useRef(false);
  const chatThreadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const previousRowPositions = useRef(new Map<string, DOMRect>());

  const hasChatActivity = chatMessages.length > 0;
  const hasLongChatContent = useMemo(
    () => chatMessages.some((message) => message.content.length > 140 || message.content.split("\n").length > 4),
    [chatMessages],
  );
  const showChatExpand =
    isDawnExpanded &&
    !isChatFocused &&
    (chatThreadOverflows || hasLongChatContent || suggestions.length >= 2);

  useEffect(() => {
    const thread = chatThreadRef.current;
    if (!thread) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
  }, [chatMessages, isReadingFile, suggestions.length, isChatFocused]);

  useLayoutEffect(() => {
    const thread = chatThreadRef.current;
    if (!thread || isChatFocused) {
      setChatThreadOverflows(false);
      return;
    }
    const measure = () => setChatThreadOverflows(thread.scrollHeight > thread.clientHeight + 2);
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(thread);
    return () => observer?.disconnect();
  }, [chatMessages, isReadingFile, suggestions.length, isDawnExpanded, isChatFocused]);

  useLayoutEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = isChatFocused ? 94 : 64;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [composer, isChatFocused, suggestions.length]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDawnPromptIndex((current) => {
        const next = Math.floor(Math.random() * (dawnPrompts.length - 1));
        return next >= current ? next + 1 : next;
      });
    }, 10000);
    return () => window.clearInterval(interval);
  }, []);

  useLayoutEffect(() => {
    if (skipNoteSyncRef.current) {
      skipNoteSyncRef.current = false;
      return;
    }
    const editor = noteEditorRef.current;
    if (editor && editor.innerHTML !== note) {
      editor.innerHTML = note;
    }
  }, [note]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDashboardGreetingIndex((current) => {
        const next = Math.floor(Math.random() * (dashboardGreetings.length - 1));
        return next >= current ? next + 1 : next;
      });
    }, 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function collapseUntouchedDawn(event: MouseEvent) {
      if (ignoreDawnDismissRef.current) return;
      const target = event.target as Node;
      if (isChatFocused) return;
      if (dawnPanelRef.current?.contains(target)) return;
      if (isDawnExpanded && !chatMessages.length && !composer.trim()) {
        setDawnExpanded(false);
      }
    }
    document.addEventListener("click", collapseUntouchedDawn);
    return () => document.removeEventListener("click", collapseUntouchedDawn);
  }, [chatMessages.length, composer, isChatFocused, isDawnExpanded]);

  useEffect(() => {
    if (!isChatFocused) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setChatFocused(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isChatFocused]);

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
  const visibleHospitals = useMemo(
    () => filtered.slice((page - 1) * 10, page * 10),
    [filtered, page],
  );
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

  function openHospital(
    hospital: Hospital,
    focus?: { tab?: "details" | "contacts" | "activity"; contactId?: string },
    fromChat = false,
  ) {
    setSelectedId(hospital.id);
    setHospitalDrawerFocus(focus ?? null);
    setDrawerOverChat(fromChat || isChatFocused || isDawnExpanded);
    setDrawer("hospital");
  }

  function openHospitalFromChat(hospitalId: string) {
    const hospital = hospitals.find((item) => item.id === hospitalId);
    if (hospital) openHospital(hospital, undefined, true);
  }

  function openSuggestionTarget(suggestion: Suggestion) {
    const hospital = hospitals.find((item) => item.id === suggestion.hospitalId);
    if (!hospital) return;

    if (suggestion.field === "createContact" || suggestion.field === "updateContact") {
      const contactId =
        suggestion.contactId ??
        hospital.contacts.find((contact) => contact.name.toLowerCase() === suggestion.suggestedValue.trim().toLowerCase())?.id ??
        hospital.contacts.find((contact) => {
          const name = suggestion.suggestedValue.trim().toLowerCase();
          const full = contact.name.toLowerCase();
          return full.includes(name) || name.includes(full.split(/\s+/)[0] ?? "");
        })?.id;
      openHospital(hospital, { tab: "contacts", contactId }, true);
      return;
    }

    openHospital(hospital, undefined, true);
  }

  function renameHospital(id: string, name: string) {
    setHospitals((current) =>
      current.map((hospital) => (hospital.id === id ? { ...hospital, name } : hospital)),
    );
  }

  function updateNoteFromEditor() {
    if (!noteEditorRef.current) return;
    skipNoteSyncRef.current = true;
    setNote(noteEditorRef.current.innerHTML);
  }

  function addChecklistItem() {
    const editor = noteEditorRef.current;
    if (!editor) return;
    editor.focus();
    const currentLabel = findChecklistLabel(window.getSelection()?.anchorNode ?? null, editor);
    insertChecklistRow(editor, currentLabel);
    updateNoteFromEditor();
  }

  function handleNoteEnter(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter") return;
    const editor = noteEditorRef.current;
    if (!editor) return;
    const currentLabel = findChecklistLabel(window.getSelection()?.anchorNode ?? null, editor);
    if (!currentLabel) return;
    event.preventDefault();
    addChecklistItem();
  }

  function focusChatComposer() {
    window.requestAnimationFrame(() => {
      const composer = composerRef.current;
      if (!composer) return;
      composer.focus({ preventScroll: true });
      composer.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  function openDawnChat() {
    ignoreDawnDismissRef.current = true;
    setChatFocused(false);
    setDawnExpanded(true);
    window.setTimeout(() => {
      ignoreDawnDismissRef.current = false;
      focusChatComposer();
    }, 0);
  }

  function handleStage(stage: Stage | "All") {
    setActiveStage(stage);
    setPage(1);
  }

  function adjustPriority(hospital: Hospital, direction: 1 | -1) {
    setLastSnapshot(hospitals);
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

    setLastSnapshot(hospitals);

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

  async function handleComposerSend(options?: { fromVoice?: boolean; textOverride?: string }) {
    const fromVoice = options?.fromVoice ?? false;
    const text = (options?.textOverride ?? composer).trim();
    if (!text) return;

    recordChatMessage(text, "user");
    setDawnExpanded(true);

    if (/export|excel|download/i.test(text)) {
      void exportAllArchive(hospitals, uploadedFiles);
      recordChatMessage("I prepared the export. Your hospital records have not been changed.", "assistant");
      setComposer("");
      return;
    }

    const smallTalk = fromVoice ? null : smallTalkReply(text);
    if (smallTalk) {
      setSuggestions([]);
      recordChatMessage(smallTalk, "assistant");
      setComposer("");
      return;
    }

    const metaReply = fromVoice ? null : await dawnMetaReply(text);
    if (metaReply) {
      setSuggestions([]);
      recordChatMessage(metaReply, "assistant");
      setComposer("");
      return;
    }

    const looksLikeUpdate = looksLikeHospitalUpdate(text, hospitals) || fromVoice;

    if (!looksLikeUpdate && !fromVoice && isHospitalDashboardQuestion(text)) {
      setSuggestions([]);
      recordChatMessage(buildDawnAnswer(text, hospitals), "assistant");
      setComposer("");
      return;
    }

    if (!looksLikeUpdate && !fromVoice && isGeneralQuestion(text)) {
      setComposer("");
      setReadingFile(true);
      const ai = await aiInterpret(text, hospitals);
      setReadingFile(false);
      if (ai?.answer) {
        recordChatMessage(ai.answer, "assistant", formatAiAttribution(ai.provider, ai.model));
      } else {
        recordChatMessage(
          "I can answer questions about your hospitals — like \"what are my priorities?\" or \"what's waiting on us?\" For site updates, tell me what happened and I'll suggest a change for you to approve.",
          "assistant",
        );
      }
      return;
    }

    const updateContext = resolveConversationUpdateContext(
      [...chatMessages, { id: "pending", content: text, role: "user" }],
      text,
      hospitals,
      suggestions,
    );

    if (!fromVoice && isTooVagueForUpdate(text, hospitals, updateContext.hospital)) {
      setSuggestions([]);
      recordChatMessage(
        "I'm not sure that's an update yet. Mention a hospital and what happened, drop a file, or ask me something like \"what are my priorities?\"",
        "assistant",
      );
      setComposer("");
      return;
    }

    setComposer("");
    setReadingFile(true);
    const chatHistory = [...chatMessages, { id: "pending", content: text, role: "user" as const }]
      .slice(-8)
      .map((message) => `${message.role}: ${message.content}`);
    const ai = await aiInterpret(updateContext.combinedText, hospitals, chatHistory, { voice: fromVoice });
    setReadingFile(false);
    const gptLabel = ai ? formatAiAttribution(ai.provider, ai.model) : undefined;
    const preferGptOnly = fromVoice || ai?.configured === true;

    if (ai?.answer && !ai.suggestions?.length) {
      setSuggestions([]);
      recordChatMessage(ai.answer, "assistant", gptLabel);
      return;
    }

    const fromGpt = Boolean(ai?.suggestions?.length);
    if (fromGpt) {
      const nextSuggestions = ai!.suggestions!;
      setSuggestions(nextSuggestions);
      recordChatMessage(describeAssistantPlanIntro(nextSuggestions), "assistant", gptLabel);
      return;
    }

    if (preferGptOnly) {
      setSuggestions([]);
      recordChatMessage(
        fromVoice
          ? ai?.error
            ? `Voice needs GPT, but it failed: ${ai.error} Check .env.local and restart npm run dev.`
            : ai?.configured === false
              ? "Voice needs GPT connected. Add AI settings in .env.local (see .env.example) and restart npm run dev."
              : "GPT couldn't find a clear update in that voice note. Try again with the hospital name and what happened."
          : ai?.error
            ? `GPT failed: ${ai.error} Check .env.local and restart npm run dev.`
            : "GPT didn't find a clear update to suggest. Try naming the hospital and what changed.",
        "assistant",
      );
      return;
    }

    const rawSuggestions = createSuggestions(text, hospitals, "Messy note", {
      combinedText: updateContext.combinedText,
      hospital: updateContext.hospital,
      fromConversation: chatMessages.some((message) => message.role === "user"),
    });
    const nextSuggestions = mergeContactSuggestions(text, hospitals, rawSuggestions, "Messy note");
    setSuggestions(nextSuggestions);
    if (!nextSuggestions.length) {
      recordChatMessage(
        "Got it — I couldn't spot a specific hospital update in that, so I haven't changed anything. Mention a hospital and what happened (or drop a file) and I'll suggest an update.",
        "assistant",
      );
    } else {
      recordChatMessage(describeAssistantPlanIntro(nextSuggestions), "assistant");
    }
  }

  function recordChatMessage(content: string, role: ChatMessage["role"] = "user", aiLabel?: string) {
    setChatMessages((current) => {
      if (current[current.length - 1]?.content === content && current[current.length - 1]?.role === role) return current;
      return [...current, { id: `chat-${Date.now()}-${role}-${current.length}`, content, role, aiLabel }];
    });
    if (role === "user") {
      playDawnSendSound();
    } else if (!/^(Reading|Dawn is thinking)/i.test(content.trim())) {
      playDawnReceiveSound();
    }
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

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) await ingestFile(file);
    event.target.value = "";
  }

  async function ingestFile(file: File) {
    setDawnExpanded(true);
    setReadingFile(true);
    recordChatMessage(`Reading ${file.name}…`, "assistant");

    const extracted = await extractFileContent(file);
    const basis = extracted.ok ? `${file.name}\n${extracted.text}` : file.name;
    const mentioned = findMentionedHospital(basis, hospitals);
    const evidenceKind: EvidenceItem["kind"] = extracted.kind === "image" ? "image" : "file";
    const snippet = extracted.ok ? extracted.text.replace(/\s+/g, " ").trim().slice(0, 600) : "";
    const data = await file.arrayBuffer();

    const fileHospitalId = mentioned?.id ?? "unfiled";
    const fileHospitalName = mentioned?.name ?? detectNewHospitalName(basis, hospitals) ?? "Unfiled lead";

    if (mentioned) {
      attachInteraction(mentioned.id, {
        id: `interaction-${Date.now()}`,
        label: file.name,
        text: snippet ? `${extracted.method}: ${snippet}` : `Attached through Dawn AI and linked to ${mentioned.name}.`,
        at: today.toISOString().slice(0, 10),
        kind: evidenceKind,
      });
    }

    setUploadedFiles((current) => [
      {
        id: `file-${Date.now()}`,
        name: file.name,
        type: file.type || "Unknown file type",
        size: file.size,
        uploadedAt: timestampNow(),
        source: "Dawn AI",
        hospitalId: fileHospitalId,
        hospitalName: fileHospitalName,
        content: snippet || undefined,
        data,
      },
      ...current,
    ]);

    const spreadsheetSuggestions =
      extracted.kind === "spreadsheet" && extracted.ok
        ? createSuggestionsFromSpreadsheet(extracted.text, hospitals, file.name)
        : [];

    const ai = extracted.ok
      ? await aiInterpret(extracted.text, hospitals, [], {
          inputKind: extracted.kind === "spreadsheet" ? "spreadsheet" : "file",
        })
      : null;
    const preferGptOnly = ai?.configured === true;
    const fromGpt = Boolean(ai?.suggestions?.length);
    const rawSuggestions = fromGpt
      ? ai!.suggestions!
      : spreadsheetSuggestions.length
        ? spreadsheetSuggestions
        : preferGptOnly
          ? []
          : createSuggestions(basis, hospitals, file.name);
    const nextSuggestions = fromGpt ? rawSuggestions : mergeContactSuggestions(basis, hospitals, rawSuggestions, file.name);
    setSuggestions(nextSuggestions);

    let summary: string;
    if (extracted.ok) {
      const readable = extracted.method.charAt(0).toLowerCase() + extracted.method.slice(1);
      if (nextSuggestions.length) {
        const count = nextSuggestions.length === 1 ? "1 suggested change" : `${nextSuggestions.length} suggested changes`;
        summary = fromGpt
          ? `I read ${file.name} with GPT and prepared ${count} below for your approval.`
          : spreadsheetSuggestions.length
            ? `I read every row in ${file.name} and prepared ${count} below for your approval.`
            : `I ${readable} in ${file.name} and prepared ${count} below for your approval.`;
      } else if (preferGptOnly && ai?.error) {
        summary = `I ${readable} in ${file.name}, but GPT failed: ${ai.error}`;
      } else if (preferGptOnly) {
        summary = `I ${readable} in ${file.name}, but GPT didn't find a clear change to suggest.`;
      } else {
        summary = `I ${readable} in ${file.name} but couldn't find a clear change to suggest, so nothing was updated.`;
      }
    } else if (extracted.kind === "image") {
      summary = `I saved ${file.name}, but couldn't read the image text automatically (OCR needs an internet connection). You can still open the record and add details.`;
    } else {
      summary = `I saved ${file.name}, but couldn't read its contents automatically. You can still open the record and add details.`;
    }
    recordChatMessage(
      summary,
      "assistant",
      fromGpt ? formatAiAttribution(ai?.provider, ai?.model) : spreadsheetSuggestions.length ? "Parsed from spreadsheet rows" : undefined,
    );
    setReadingFile(false);
  }

  function downloadStoredFile(file: StoredFile) {
    downloadBlob(new Blob([file.data ?? file.content ?? `File: ${file.name}\nStored in Dawn for ${file.hospitalName}.`], { type: file.type || "text/plain" }), file.name);
  }

  async function downloadAllFiles() {
    const zip = new JSZip();
    uploadedFiles.forEach((file) => {
      zip.folder(safeFileName(file.hospitalName))?.file(file.name, file.data ?? file.content ?? `File: ${file.name}\nStored in Dawn for ${file.hospitalName}.`);
    });
    downloadBlob(await zip.generateAsync({ type: "blob" }), "dawn-file-archive.zip");
  }

  function deleteStoredFile(id: string) {
    setUploadedFiles((current) => current.filter((file) => file.id !== id));
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
      if (!transcript.trim()) return;
      setComposer("");
      setDawnExpanded(true);
      void handleComposerSend({ fromVoice: true, textOverride: transcript });
    };
    recognition.start();
  }

  function patchSuggestion(id: string, patch: SuggestionPatch) {
    setSuggestions((current) =>
      current.map((suggestion) => (suggestion.id === id ? { ...suggestion, ...patch } : suggestion)),
    );
  }

  function updateSuggestion(id: string, value: string) {
    patchSuggestion(id, { suggestedValue: value });
  }

  function dismissSuggestion(id: string) {
    setSuggestions((current) => current.filter((suggestion) => suggestion.id !== id));
  }

  function openHospitalAfterCreate(suggestion: Suggestion, nextHospitals: Hospital[], previousHospitals: Hospital[]) {
    if (suggestion.field !== "create") return;
    const name = suggestion.suggestedValue.trim().toLowerCase();
    const created = nextHospitals.find(
      (hospital) =>
        hospital.name.toLowerCase() === name &&
        !previousHospitals.some((existing) => existing.id === hospital.id),
    );
    if (created) openHospital(created, { tab: "details" }, true);
  }

  function approveSuggestion(suggestion: Suggestion) {
    setLastSnapshot(hospitals);
    const nextHospitals = applySuggestion(hospitals, suggestion);
    setHospitals(nextHospitals);
    dismissSuggestion(suggestion.id);
    openHospitalAfterCreate(suggestion, nextHospitals, hospitals);
    recordChatMessage(
      suggestion.field === "create"
        ? `Done — I added ${suggestion.suggestedValue} as a new hospital.`
        : suggestion.field === "createContact"
          ? `Done — I added ${suggestion.suggestedValue} as a new contact at ${suggestion.hospitalName}.`
          : suggestion.field === "updateContact"
            ? `Done — I updated ${suggestion.suggestedValue}'s contact details at ${suggestion.hospitalName}.`
            : `Done — ${suggestion.hospitalName}'s ${suggestionFieldLabel(suggestion.field)} is now updated.`,
      "assistant",
    );
  }

  function approveAll() {
    setLastSnapshot(hospitals);
    const nextHospitals = suggestions.reduce(applySuggestion, hospitals);
    setHospitals(nextHospitals);
    const createSuggestions = suggestions.filter((item) => item.field === "create");
    if (createSuggestions.length === 1) {
      openHospitalAfterCreate(createSuggestions[0], nextHospitals, hospitals);
    }
    recordChatMessage(`Done — I applied ${suggestions.length} approved update${suggestions.length === 1 ? "" : "s"}.`, "assistant");
    setSuggestions([]);
    setReviewOpen(false);
  }

  function undoLastApproval() {
    if (!lastSnapshot) return;
    setHospitals(lastSnapshot);
    setLastSnapshot(null);
  }

  function saveHospital(nextHospital: Hospital) {
    setLastSnapshot(hospitals);
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
    setLastSnapshot(hospitals);
    setHospitals((current) => [draft, ...current]);
    setSelectedId(draft.id);
    setDrawer("hospital");
  }

  function deleteHospital(id: string) {
    setLastSnapshot(hospitals);
    setHospitals((current) => current.filter((hospital) => hospital.id !== id));
    setSelectedId(null);
    setDrawer(null);
  }

  return (
    <main
      className={`dawn-app stage-${activeStage.toLowerCase()}`}
      onDragOver={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        if (!isFileDragging) setFileDragging(true);
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && event.currentTarget.contains(next)) return;
        setFileDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setFileDragging(false);
        void ingestFile(event.dataTransfer.files[0]);
      }}
    >
      <div className="sunrise-field" aria-hidden="true">
        <span className="moving-sun" />
      </div>

      {isFileDragging ? (
        <div className="file-drop-overlay" aria-hidden="true">
          <div className="file-drop-card">
            <PaperclipIcon />
            <b>Drop the file — Dawn will read it</b>
            <span>PDF, Excel, PowerPoint, Word, notes, or an image</span>
          </div>
        </div>
      ) : null}

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
          <button className="icon-button" aria-label="Activity" onClick={() => setDrawer("audit")}>
            <HistoryIcon />
          </button>
          <button className="icon-button" aria-label="File storage" onClick={() => setDrawer("files")}>
            <PaperclipIcon />
          </button>
          <button className="icon-button" aria-label="Settings" onClick={() => setDrawer("settings")}>
            <SettingsIcon />
          </button>
          <button className="icon-button" aria-label="Export all Dawn data and files" title="Export all data and files" onClick={() => void exportAllArchive(hospitals, uploadedFiles)}>
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
              <h1 key={dashboardGreetingIndex} className="dashboard-greeting">{dashboardGreetings[dashboardGreetingIndex]}</h1>
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
                className={`table-row data-row priority-${priority.toLowerCase().replaceAll(" ", "-")} ${dragOverHospitalId === hospital.id ? "is-drag-target" : ""}`}
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
                  if (!draggedHospitalId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dragOverHospitalId !== hospital.id) setDragOverHospitalId(hospital.id);
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
                    className={`priority-pill ${priority.toLowerCase().replaceAll(" ", "-")}`}
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
                  <span className={`stage-pill stage-${hospital.stage.toLowerCase()}`}>{hospital.stage}</span>
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
          <section className="note-panel note-yellow" aria-label="Quick note">
            <div
              ref={noteEditorRef}
              className="note-editor"
              contentEditable
              dir="ltr"
              suppressContentEditableWarning
              role="textbox"
              aria-label="Quick note editor"
              onInput={updateNoteFromEditor}
              onKeyDown={handleNoteEnter}
              onClick={(event) => {
                const target = event.target as HTMLInputElement;
                if (target.type === "checkbox") {
                  if (target.checked) target.setAttribute("checked", "checked");
                  else target.removeAttribute("checked");
                  updateNoteFromEditor();
                }
              }}
            />
          </section>

          {isChatFocused ? (
            <button
              type="button"
              className="chat-focus-backdrop"
              aria-label="Close expanded chat"
              onClick={() => setChatFocused(false)}
            />
          ) : null}

          <section
            ref={dawnPanelRef}
            className={`dawn-sidecar ${isDawnExpanded ? "is-expanded" : ""} ${hasChatActivity ? "has-activity" : ""} ${suggestions.length ? "has-suggestions" : ""} ${isChatFocused ? "is-chat-focused" : ""}`}
            aria-label="Ask Dawn"
          >
            {isDawnExpanded ? (
              <>
                <header>
                  <div className="chat-title">
                    <h2>Ask Dawn</h2>
                  </div>
                  {isChatFocused ? (
                    <button className="chat-focus-close" type="button" aria-label="Close expanded chat" onClick={() => setChatFocused(false)}>
                      <CloseIcon />
                    </button>
                  ) : showChatExpand ? (
                    <button
                      className="chat-expand-btn"
                      type="button"
                      aria-label="Expand to see all suggestions"
                      title="Expand to see all suggestions"
                      onClick={() => setChatFocused(true)}
                    >
                      <ExpandIcon />
                      {suggestions.length >= 2 ? <span className="chat-expand-label">Expand</span> : null}
                    </button>
                  ) : null}
                </header>
                <div
                  className={`chat-thread ${showChatExpand ? "is-overflowing" : ""}`}
                  aria-live="polite"
                  ref={chatThreadRef}
                  onClick={() => {
                    if (showChatExpand) setChatFocused(true);
                  }}
                  onKeyDown={(event) => {
                    if (showChatExpand && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      setChatFocused(true);
                    }
                  }}
                  role={showChatExpand ? "button" : undefined}
                  tabIndex={showChatExpand ? 0 : undefined}
                  title={showChatExpand ? "Expand chat to read full reply" : undefined}
                >
                  {chatMessages.length ? (
                    chatMessages.map((message) => (
                      <div className={`chat-message-wrap ${message.role}`} key={message.id}>
                        <p className={`chat-message ${message.role}`}>
                          {message.role === "assistant"
                            ? renderChatMessageContent(message.content, openHospitalFromChat)
                            : message.content}
                        </p>
                        {message.aiLabel ? <small className="chat-ai-label">{message.aiLabel}</small> : null}
                      </div>
                    ))
                  ) : (
                    <p className="chat-empty">Use the microphone for a voice note, type a quick update, or drop a file. Dawn will do the rest.</p>
                  )}
                  {isReadingFile ? <p className="chat-message assistant chat-reading">Dawn is thinking…</p> : null}
                </div>
                {suggestions.length ? (
                  <section className="chat-suggestions chat-suggestions-enter" aria-label="Dawn suggested changes">
                    <header>
                      <div>
                        <b>Dawn suggests {suggestions.length} change{suggestions.length === 1 ? "" : "s"}</b>
                        <small>Review before approving.</small>
                      </div>
                      <button className="chat-approve-all" onClick={approveAll}>Approve all</button>
                    </header>
                    {suggestions.map((suggestion) => (
                      <article key={suggestion.id}>
                        <div className="chat-suggestion-title">
                          <b>{suggestion.hospitalName}</b>
                          <div>
                            <span>{suggestionFieldLabel(suggestion.field)}</span>
                            <button
                              className="open-hospital-button"
                              aria-label={
                                suggestion.field === "createContact" || suggestion.field === "updateContact"
                                  ? `Open ${suggestion.suggestedValue || "contact"} at ${suggestion.hospitalName}`
                                  : `Open ${suggestion.hospitalName}`
                              }
                              title={
                                suggestion.field === "createContact" || suggestion.field === "updateContact"
                                  ? `Open contact at ${suggestion.hospitalName}`
                                  : `Open ${suggestion.hospitalName}`
                              }
                              onClick={() => openSuggestionTarget(suggestion)}
                            >
                              ↗
                            </button>
                          </div>
                        </div>
                        <SuggestionEditor suggestion={suggestion} onEdit={updateSuggestion} onPatch={patchSuggestion} />
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
                  <textarea
                    ref={composerRef}
                    rows={1}
                    value={composer}
                    onFocus={focusChatComposer}
                    onChange={(event) => {
                      setComposer(event.target.value);
                      event.currentTarget.style.height = "auto";
                      const maxHeight = isChatFocused ? 94 : 64;
                      event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, maxHeight)}px`;
                    }}
                    onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleComposerSend();
                      }
                    }}
                    placeholder="Speak or type an update"
                  />
                  <input ref={fileInputRef} type="file" className="sr-only" onChange={handleFile} />
                  <button className="composer-icon" aria-label="Attach file" onClick={() => fileInputRef.current?.click()}>
                    <PaperclipIcon />
                  </button>
                </section>
              </>
            ) : (
              <button
                className="dawn-prompt"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openDawnChat();
                }}
                aria-expanded={false}
              >
                <span className="dawn-prompt-mic" aria-hidden="true"><MicIcon /></span>
                <span>
                  <b>{dawnPrompts[dawnPromptIndex]}</b>
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
          onPatch={patchSuggestion}
        />
      ) : null}

      {drawer ? (
        <DrawerShell
          title={drawerTitle(drawer, selectedHospital)}
          className={isDrawerOverChat ? "is-over-chat" : undefined}
          onClose={() => {
            setDrawer(null);
            setHospitalDrawerFocus(null);
            setDrawerOverChat(false);
          }}
          onTitleChange={drawer === "hospital" && selectedHospital ? (name) => renameHospital(selectedHospital.id, name) : undefined}
        >
          {drawer === "hospital" && selectedHospital ? (
            <EditableHospitalDetail
              key={`${selectedHospital.id}-${hospitalDrawerFocus?.tab ?? "details"}-${hospitalDrawerFocus?.contactId ?? "none"}`}
              hospital={selectedHospital}
              focus={hospitalDrawerFocus ?? undefined}
              onSave={(nextHospital) => {
                saveHospital(nextHospital);
                setDrawer(null);
                setHospitalDrawerFocus(null);
                setDrawerOverChat(false);
              }}
              onDelete={deleteHospital}
              canUndo={Boolean(lastSnapshot)}
              onUndo={undoLastApproval}
              substageOptions={settings.substageOptions}
            />
          ) : null}
          {drawer === "settings" ? <EditableSettingsDrawer settings={settings} onSave={setSettings} /> : null}
          {drawer === "audit" ? <EditableAuditDrawer hospitals={hospitals} /> : null}
          {drawer === "files" ? <EditableFileStorageDrawer files={uploadedFiles} onDownload={downloadStoredFile} onDownloadAll={downloadAllFiles} onDelete={deleteStoredFile} /> : null}
          {drawer === "new" ? <EditableNewHospitalDrawer onCreate={createNewHospital} substageOptions={settings.substageOptions} /> : null}
        </DrawerShell>
      ) : null}
    </main>
  );
}

function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) grid[i][0] = i;
  for (let j = 0; j < cols; j += 1) grid[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      grid[i][j] = Math.min(grid[i - 1][j] + 1, grid[i][j - 1] + 1, grid[i - 1][j - 1] + cost);
    }
  }
  return grid[a.length][b.length];
}

function fuzzyHospitalWordMatch(spoken: string, expected: string): boolean {
  if (spoken === expected) return true;
  if (spoken.length < 6 || expected.length < 6) return false;
  if (spoken.slice(0, 5) === expected.slice(0, 5)) return editDistance(spoken, expected) <= 3;
  return editDistance(spoken, expected) <= 2;
}

function findMentionedHospital(text: string, hospitals: Hospital[]): Hospital | null {
  const lower = text.toLowerCase();
  const genericWords = new Set([
    "hospital",
    "hospitals",
    "medical",
    "center",
    "centre",
    "institute",
    "health",
    "healthcare",
    "university",
    "clinical",
    "general",
    "clinic",
    "system",
    "research",
    "regional",
    "national",
  ]);
  const tokens = lower.split(/[^a-z]+/).filter((word) => word.length >= 6);
  const matches = hospitals.filter((hospital) => {
    const name = hospital.name.toLowerCase();
    const words = name.split(/[^a-z]+/).filter((word) => word.length >= 5 && !genericWords.has(word));
    if (!words.length) return false;
    const hit =
      lower.includes(name) ||
      words.some((word) => lower.includes(word) || tokens.some((token) => fuzzyHospitalWordMatch(token, word)));
    if (!hit) return false;
    if (isNegatedHospitalMention(text, name)) return false;
    return !words.some((word) => (lower.includes(word) || tokens.some((token) => fuzzyHospitalWordMatch(token, word))) && isNegatedHospitalMention(text, word));
  });
  return matches.sort((a, b) => b.name.length - a.name.length)[0] ?? null;
}

function isNegatedHospitalMention(text: string, needle: string): boolean {
  const lower = text.toLowerCase();
  const token = needle.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!lower.includes(needle.toLowerCase())) return false;
  return new RegExp(`\\bnot\\s+(?:\\w+\\s+){0,3}${token}\\b`).test(lower);
}

function isHospitalSwitchMessage(text: string): boolean {
  return (
    /\b(might be|wrong hospital|different hospital|new hospital|add (?:a )?new)\b/i.test(text) ||
    /\b(i mean|mean)\s+[a-z]/i.test(text) ||
    /\b[a-z][a-z0-9'-]{3,}\s+not\s+[a-z][a-z0-9'-]{4,}/i.test(text)
  );
}

const UPDATE_SIGNAL =
  /\b(eaa|loi|kickoff|pilot|signed|sign|waiting|hospital|send|schedule|complete|completed|agreement|feasibility|contact|packet|demo|legal|admin|coordinator|reminder|update|note|file|call|email|met|spoke|discussed|approved|conference|meeting|interaction)\b/i;

const UPDATE_NARRATIVE =
  /\b(met (them|at|with)|conference|approved|agreed|wanted to share|this is for|they (said|want|approved)|we will|having a (meeting|kickoff)|next week|giving you an update|interaction)\b/i;

function looksLikeHospitalUpdate(text: string, hospitals: Hospital[]): boolean {
  const lower = text.toLowerCase();
  const hasHospital = Boolean(findMentionedHospital(text, hospitals) || detectNewHospitalName(text, hospitals));
  const hasOrgPhrase = /\b(university hospital|medical center|clinical institute|regional hospital)\b/i.test(lower);
  return (hasHospital && (UPDATE_NARRATIVE.test(lower) || UPDATE_SIGNAL.test(lower))) || (hasOrgPhrase && UPDATE_NARRATIVE.test(lower));
}

function findHospitalInConversation(messages: ChatMessage[], hospitals: Hospital[]): Hospital | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const found = findMentionedHospital(messages[index].content, hospitals);
    if (found) return found;
  }
  return null;
}

function resolveConversationUpdateContext(
  messages: ChatMessage[],
  currentText: string,
  hospitals: Hospital[],
  pendingSuggestions: Suggestion[],
): { combinedText: string; hospital: Hospital | null } {
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
  const isCorrection =
    /\b(actually|no wait|wait|correction|instead|rather|i mean|meant|not the eaa|not eaa|not what i meant|that's not|that is not|giving you an update|i was giving|you misunderstood|wrong answer)\b/i.test(
      currentText,
    );
  const isShortClarification =
    currentText.trim().split(/\s+/).length <= 5 &&
    (/^(it'?s|its|that'?s|this is|for|yes|no)\b/i.test(currentText.trim()) ||
      (Boolean(findMentionedHospital(currentText, hospitals)) && !UPDATE_SIGNAL.test(currentText)));

  if (isHospitalSwitchMessage(currentText) || detectNewHospitalName(currentText, hospitals)) {
    return {
      combinedText: currentText,
      hospital: findMentionedHospital(currentText, hospitals),
    };
  }

  let hospital =
    findMentionedHospital(currentText, hospitals) ??
    findHospitalInConversation(messages, hospitals) ??
    (pendingSuggestions[0] ? hospitals.find((item) => item.id === pendingSuggestions[0].hospitalId) ?? null : null);

  let combinedText = currentText;
  if (isCorrection) {
    const priorUpdate = [...userMessages]
      .slice(0, -1)
      .reverse()
      .find((message) => looksLikeHospitalUpdate(message, hospitals) || message.split(/\s+/).length >= 10);
    if (priorUpdate) combinedText = `${priorUpdate} ${currentText}`.replace(/\s+/g, " ").trim();
  } else if (isShortClarification || !UPDATE_SIGNAL.test(currentText)) {
    const priorUpdate = [...userMessages].slice(0, -1).reverse().find((message) => UPDATE_SIGNAL.test(message));
    if (priorUpdate) combinedText = `${priorUpdate} ${currentText}`.replace(/\s+/g, " ").trim();
  }

  hospital = findMentionedHospital(combinedText, hospitals) ?? hospital;
  return { combinedText, hospital };
}

function buildInteractionSummary(text: string, hospital: Hospital | null): string {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const shortName = hospital?.name.match(/^(\S+(?:\s+\S+)?)/)?.[1] ?? hospital?.name ?? "Hospital";
  const hasLoi = /\bloi\b/.test(lower);
  const hasEaa = /\beaa\b/.test(lower);
  const hasSigned = /\b(signed|sign|returned|completed|approved)\b/.test(lower);
  const negatesEaa = /\b(not|no|actually|instead|wrong)\b/.test(lower) && hasEaa;

  if (hasLoi && hasSigned && (negatesEaa || !hasEaa || /\bactually\b/.test(lower))) {
    return `${shortName} signed the LOI`;
  }
  if (hasEaa && hasSigned && !negatesEaa) {
    return `${shortName} signed the EAA`;
  }

  const trimmed = text.trim();
  if (/^(it'?s|its|that'?s|this is|for)\s+[a-z]/i.test(trimmed) && trimmed.split(/\s+/).length <= 4) {
    return "";
  }

  const cleaned = text
    .replace(/\b(actually|no wait|wait|i mean|meant to say|correction)[,:]?\s*/gi, "")
    .replace(/^(it'?s|its|that'?s|this is|for)\s+[a-z][a-z'\s-]{0,40}\.?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 10) return "";
  return cleaned.slice(0, 180);
}

const ORG_KEYWORDS = "Hospital|Hospitals|Medical Center|Medical Centre|Medical|Clinic|Institute|Healthcare|Health System|Health Centre|Health Center|Health";

function hospitalNameExists(candidate: string, hospitals: Hospital[]): boolean {
  const lower = candidate.toLowerCase();
  return hospitals.some((hospital) => {
    const name = hospital.name.toLowerCase();
    const distinctiveWord = name.split(/[^a-z]+/).find((word) => word.length >= 6);
    return name === lower || name.includes(lower) || lower.includes(name) || Boolean(distinctiveWord && lower.includes(distinctiveWord));
  });
}

function normalizeHospitalDisplayName(raw: string, hintText = ""): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (/\b(institute|hospital|medical|clinic|health)\b/i.test(trimmed)) {
    return trimmed.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }
  const titled = trimmed.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  const hint = hintText.toLowerCase();
  const token = trimmed.toLowerCase();
  if (token && new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+hospital\\b`).test(hint)) {
    return `${titled} Hospital`;
  }
  return `${titled} Institute`;
}

function cleanHospitalPhrase(raw: string): string {
  return raw
    .replace(/\b(called|named|it's|its|the|a|an|new|with|contact|met|at|conference|today)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePersonName(raw: string): string {
  const stop = new Set(["at", "a", "the", "conference", "today", "with", "contact", "hospital", "new", "called", "is", "he", "she", "they", "i", "we", "in"]);
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !stop.has(part.toLowerCase()))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractPreferredHospitalPhrase(text: string): string | null {
  const patterns = [
    /\bcalled\s+([a-z][a-z0-9'-]*(?:\s+[a-z][a-z0-9'-]*){0,3})\s+hospital\b/i,
    /\bnew\s+hospital\s+called\s+([a-z][a-z0-9'-]*(?:\s+[a-z][a-z0-9'-]*){0,3})(?:\s+hospital)?\b/i,
    /\b(?:i mean|might be|it's|its|named|wait,? it'?s)\s+([a-z][a-z0-9'-]*(?:\s+[a-z][a-z0-9'-]*){0,3}(?:\s+(?:institute|hospital|medical center|clinic|health system|health centre|health center|health))?)\s*(?:\s+not\b|[,.]|$)/i,
    /\b(?:i mean|mean)\s+([a-z][a-z0-9'-]+)\s+not\s+/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const phrase = cleanHospitalPhrase(match[1].trim());
    if (phrase.length >= 3 && !/^(not|they|signed|loi|eaa|wait|mean|contact|with|the)$/i.test(phrase)) return phrase;
  }
  return null;
}

function detectNewHospitalName(text: string, hospitals: Hospital[]): string | null {
  const preferred = extractPreferredHospitalPhrase(text);
  if (preferred) {
    const normalized = normalizeHospitalDisplayName(preferred, text);
    if (!hospitalNameExists(normalized, hospitals)) return normalized;
  }

  const regex = new RegExp(
    `\\b([A-Za-z][A-Za-z&'.-]*(?:\\s+[A-Za-z][A-Za-z&'.-]*){0,3}\\s+(?:${ORG_KEYWORDS}))\\b`,
    "gi",
  );
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const candidate = match[1].replace(/\s+/g, " ").trim();
    const normalized = normalizeHospitalDisplayName(candidate, text);
    const lower = normalized.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    if (!hospitalNameExists(normalized, hospitals)) return normalized;
  }
  return null;
}

function detectCountry(lower: string): string | undefined {
  const preset = countryPresets.find((country) => lower.includes(country.toLowerCase()));
  if (preset) return preset;
  const otherPatterns: Array<[RegExp, string]> = [
    [/\bvietnam\b/, "Vietnam"],
    [/\bphilippines\b|\bfilipino\b/, "Philippines"],
    [/\bcambodia\b/, "Cambodia"],
    [/\bmyanmar\b|\bburma\b/, "Myanmar"],
    [/\bbrunei\b/, "Brunei"],
    [/\blaos\b/, "Laos"],
  ];
  for (const [pattern, label] of otherPatterns) {
    if (pattern.test(lower)) return label;
  }
  return undefined;
}

function detectNextStep(lower: string): string {
  if (/\b(eaa|loi|agreement|data agreement)\b.*\b(signed|complete|approved)\b/.test(lower)) return "Schedule kickoff";
  if (/\bkickoff\b.*\b(scheduled|booked|confirmed)\b/.test(lower)) return "Prepare kickoff deck";
  if (/\bpilot\b/.test(lower)) return "Confirm pilot readiness";
  return "Send EAA packet";
}

function detectContactTitleFromText(text: string): ContactTitle {
  const lower = text.toLowerCase();
  if (/main crc|clinical research coordinator|\bcrc\b|research coordinator/.test(lower)) return "Clinical Research Coordinator (CRC)";
  if (/\bpi\b|principal investigator|sub-?investigator/.test(lower)) return "Principal Investigator (PI)";
  if (/feasibility/.test(lower)) return "Feasibility Manager / Feasibility Coordinator";
  if (/regulatory/.test(lower)) return "Regulatory Affairs Manager/Coordinator";
  if (/administrator|\badmin\b/.test(lower)) return "Hospital Administrator";
  if (/legal|counsel|contracts/.test(lower)) return "Legal Counsel";
  return "Clinical Research Coordinator (CRC)";
}

function noteMentionsContact(text: string): boolean {
  return (
    /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text) ||
    /\b(spoke with|talked to|met with|call with|email from|heard from|new contact|add contact|contact is|contacted)\b/i.test(text) ||
    /\b(main crc|\bcrc\b|\bpi\b|principal investigator|research coordinator)\b/i.test(text)
  );
}

function extractContactFromNote(text: string): { name: string; email: string; title: ContactTitle; department: string } | null {
  if (!noteMentionsContact(text)) return null;

  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  const email = emailMatch?.[0] ?? "";

  const namePatterns = [
    /\b(?:the\s+)?contact\s+(?:is\s+|named\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
    /\b(?:spoke with|talked to|met with|met)\s+([a-z]+(?:\s+[a-z]+)?)/i,
    /\b(?:spoke with|talked to|met with|call with|email from|heard from|contact(?:ed)?|updated?|new contact|add contact)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
  ];
  let name = "";
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      name = normalizePersonName(match[1]);
      break;
    }
  }

  if (!name && email) {
    const localPart = email.split("@")[0] ?? "";
    const fromEmail = localPart
      .split(/[._+-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
    if (fromEmail.length >= 2) name = fromEmail;
  }

  if (!name) return null;

  return {
    name,
    email,
    title: detectContactTitleFromText(text),
    department: /clinical research|research office/i.test(text) ? "Clinical research office" : "",
  };
}

function buildContactSuggestionsFromText(text: string, hospital: Hospital, source: string, confident: boolean): Suggestion[] {
  const parsed = extractContactFromNote(text);
  if (!parsed) return [];

  const existing = findContactOnHospital(hospital, parsed.name);
  const confidence = confident ? 88 : 64;

  if (existing) {
    const patch = {
      name: existing.name,
      email: parsed.email || existing.email,
      department: parsed.department || existing.department,
      title: parsed.title,
    };
    const emailChanging = Boolean(parsed.email && parsed.email !== existing.email);
    const titleChanging = patch.title !== existing.title;
    const departmentChanging = Boolean(parsed.department && parsed.department !== existing.department);
    if (!emailChanging && !titleChanging && !departmentChanging) return [];

    return [
      buildUpdateContactSuggestion(
        hospital,
        existing,
        patch,
        confidence,
        source,
      ),
    ];
  }

  return [
    buildCreateContactSuggestion(
      hospital,
      parsed.name,
      parsed.email,
      parsed.department,
      parsed.title,
      confidence - 2,
      source,
      parsed.email ? undefined : "No email was found in the note — add one before approving if you can.",
    ),
  ];
}

function mergeContactSuggestions(text: string, hospitals: Hospital[], suggestions: Suggestion[], source: string): Suggestion[] {
  if (!noteMentionsContact(text) || !suggestions.length) return suggestions;

  const createSuggestion = suggestions.find((item) => item.field === "create");
  if (createSuggestion) {
    const parsed = extractContactFromNote(text);
    if (!parsed) return suggestions;
    const draftHospital: Hospital = {
      id: createSuggestion.hospitalId,
      name: createSuggestion.suggestedValue,
      country: createSuggestion.createCountry ?? "Singapore",
      stage: "Interest",
      substage: "Agreements sent",
      nextStep: createSuggestion.createNextStep ?? "Send EAA packet",
      lastInteractionAt: "2026-07-18",
      lastInteraction: createSuggestion.createSummary ?? "",
      awaiting: "us",
      notes: "",
      priorityAdjustment: 0,
      contacts: [],
      evidence: [],
      audit: [],
      stageHistory: [],
    };
    const contactSuggestions = buildContactSuggestionsFromText(text, draftHospital, source, true);
    if (!contactSuggestions.length) return suggestions;
    return [...suggestions, ...contactSuggestions].slice(0, 6);
  }

  const mentioned = findMentionedHospital(text, hospitals);
  const hospital =
    hospitals.find((item) => item.id === suggestions[0]?.hospitalId) ??
    mentioned ??
    hospitals.find((item) => item.name === suggestions[0]?.hospitalName);
  if (!hospital) return suggestions;

  const contactSuggestions = buildContactSuggestionsFromText(text, hospital, source, Boolean(mentioned));
  if (!contactSuggestions.length) return suggestions;

  const merged = [...suggestions];
  for (const contactSuggestion of contactSuggestions) {
    const alreadyCovered = merged.some(
      (item) =>
        (item.field === "createContact" || item.field === "updateContact") &&
        (item.contactId === contactSuggestion.contactId ||
          item.suggestedValue.toLowerCase() === contactSuggestion.suggestedValue.toLowerCase() ||
          findContactOnHospital(hospital, item.suggestedValue)?.id === contactSuggestion.contactId),
    );
    if (!alreadyCovered) merged.push(contactSuggestion);
  }
  return merged.slice(0, 6);
}

type SpreadsheetRow = {
  hospital: string;
  country: string;
  update: string;
  nextStep: string;
  waitingOn: string;
  notes: string;
};

function parseSpreadsheetRows(text: string): SpreadsheetRow[] {
  const rows: SpreadsheetRow[] = [];
  let headers: string[] | null = null;
  let skipSheet = false;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("Sheet:")) {
      headers = null;
      skipSheet = /decoy|noise|garbage/i.test(line);
      continue;
    }
    if (skipSheet) continue;

    const cols = line.split(",").map((cell) => cell.trim());
    const headerKey = cols.join("|").toLowerCase();
    if (!headers && /hospital/.test(headerKey)) {
      headers = cols.map((cell) => cell.toLowerCase());
      continue;
    }
    if (!headers || cols.length < 2) continue;

    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cols[index]?.trim() ?? "";
    });

    const hospital = record.hospital ?? record.site ?? "";
    if (!hospital || hospital.toLowerCase() === "hospital") continue;

    rows.push({
      hospital,
      country: record.country ?? "",
      update: record.update ?? "",
      nextStep: record["next step"] ?? record.nextstep ?? "",
      waitingOn: record["waiting on"] ?? record.waitingon ?? "",
      notes: record.notes ?? "",
    });
  }

  return rows;
}

function isDecoySpreadsheetRow(row: SpreadsheetRow): boolean {
  const blob = `${row.hospital} ${row.update} ${row.notes}`.toLowerCase();
  if (/decoy|ignore|noise|gibberish|nonsense|hallucination|duplicate row/.test(blob)) return true;
  if (/moonbase|zorpington|atlantis|0xdeadbeef|glub the mermaid|asdf qwer|zztop/.test(blob)) return true;
  return false;
}

function resolveSpreadsheetHospital(name: string, hospitals: Hospital[]): Hospital | null {
  return (
    hospitals.find((hospital) => hospital.name.toLowerCase() === name.trim().toLowerCase()) ??
    findMentionedHospital(name, hospitals)
  );
}

function createSuggestionsFromSpreadsheet(text: string, hospitals: Hospital[], source: string): Suggestion[] {
  const parsedRows = parseSpreadsheetRows(text);
  if (!parsedRows.length) return [];

  const suggestions: Suggestion[] = [];
  const seenHospitals = new Set<string>();

  for (const row of parsedRows) {
    if (isDecoySpreadsheetRow(row)) continue;

    const key = row.hospital.trim().toLowerCase();
    if (seenHospitals.has(key)) continue;
    seenHospitals.add(key);

    const existing = resolveSpreadsheetHospital(row.hospital, hospitals);
    const summary = row.update || row.notes || `Update from spreadsheet for ${row.hospital}`;
    const country = normalizeCountryValue(row.country);

    if (existing) {
      suggestions.push(
        buildSuggestion(existing, "lastInteraction", existing.lastInteraction, summary, 92, source),
      );
      continue;
    }

    suggestions.push(
      buildCreateSuggestion(
        row.hospital.trim(),
        country,
        row.nextStep && row.nextStep.toLowerCase() !== "none" ? row.nextStep : "Send EAA packet",
        summary,
        90,
        source,
      ),
    );
  }

  return suggestions.slice(0, 12);
}

function createSuggestions(
  text: string,
  hospitals: Hospital[],
  source = "Messy note",
  options?: { combinedText?: string; hospital?: Hospital | null; fromConversation?: boolean },
): Suggestion[] {
  const parseText = options?.combinedText ?? text;
  const lower = parseText.toLowerCase();

  const newName = detectNewHospitalName(text, hospitals) ?? detectNewHospitalName(parseText, hospitals);
  if (newName) {
    const summary =
      buildInteractionSummary(parseText, null) || parseText.replace(/\s+/g, " ").trim().slice(0, 180) || `New site: ${newName}`;
    const createSuggestion = buildCreateSuggestion(newName, detectCountry(lower), detectNextStep(lower), summary, 82, source);
    return mergeContactSuggestions(text, hospitals, [createSuggestion], source);
  }

  const mentionedInCurrent = findMentionedHospital(text, hospitals);
  const mentionedInParse = findMentionedHospital(parseText, hospitals);
  const useContextHospital =
    options?.fromConversation &&
    options?.hospital &&
    !isHospitalSwitchMessage(text) &&
    !detectNewHospitalName(text, hospitals);
  const mentioned = mentionedInCurrent ?? mentionedInParse ?? (useContextHospital ? options?.hospital ?? null : null);

  const target = mentioned ?? [...hospitals].sort((a, b) => priorityScore(b) - priorityScore(a))[0];
  if (!target) return [];

  const hospitalNamed = Boolean(mentionedInCurrent ?? mentionedInParse ?? (useContextHospital ? options?.hospital : null));
  const updates: Suggestion[] = [];
  const conciseUpdate =
    buildInteractionSummary(parseText, target) || parseText.replace(/\s+/g, " ").trim().slice(0, 180);
  updates.push(
    buildSuggestion(
      target,
      "lastInteraction",
      target.lastInteraction,
      conciseUpdate,
      hospitalNamed ? 94 : 62,
      source,
      hospitalNamed
        ? undefined
        : options?.fromConversation && options?.hospital
          ? undefined
          : "No organisation was named, so Dawn selected the highest-priority site. Confirm before approving.",
    ),
  );

  if (/\bloi\b.*\b(signed|sign|complete|approved|returned)\b/.test(lower) && !/\beaa\b.*\b(signed|sign|complete|approved)\b/.test(lower)) {
    updates.push(buildSuggestion(target, "nextStep", target.nextStep, "Send EAA packet", hospitalNamed ? 88 : 58, source));
  } else if (/\b(eaa|agreement|data agreement)\b.*\b(signed|complete|approved)\b/.test(lower)) {
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

  updates.push(...buildContactSuggestionsFromText(parseText, target, source, Boolean(mentioned)));

  return updates.slice(0, 6);
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

function similarHospitalWarning(name: string, hospitals: Hospital[]): string | undefined {
  const lower = name.trim().toLowerCase();
  const first = lower.split(/\s+/)[0] ?? "";
  if (first.length < 4) return undefined;
  const similar = hospitals.find((hospital) => {
    const hospitalFirst = hospital.name.toLowerCase().split(/\s+/)[0] ?? "";
    return hospitalFirst === first && hospital.name.toLowerCase() !== lower;
  });
  if (similar) {
    return `${similar.name} already exists in Dawn. Confirm this is a different site (check the name) before approving.`;
  }
  return undefined;
}

function buildCreateSuggestion(
  name: string,
  country: string | undefined,
  nextStep: string,
  summary: string,
  confidence: number,
  source: string,
  conflict?: string,
): Suggestion {
  return {
    id: `create-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    hospitalId: `new-${Date.now()}`,
    hospitalName: name,
    field: "create",
    currentValue: "New hospital",
    suggestedValue: name,
    confidence,
    evidence: source,
    conflict: conflict ?? "This looks like a new hospital. Approving will create a fresh record you can edit.",
    createCountry: country,
    createNextStep: nextStep,
    createSummary: summary,
  };
}

function buildCreateContactSuggestion(
  hospital: Hospital,
  name: string,
  email: string,
  department: string,
  title: ContactTitle,
  confidence: number,
  source: string,
  conflict?: string,
): Suggestion {
  const duplicate = hospital.contacts.find((contact) => contact.name.toLowerCase() === name.trim().toLowerCase());
  return {
    id: `${hospital.id}-create-contact-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    field: "createContact",
    currentValue: "New contact",
    suggestedValue: name,
    confidence,
    evidence: source,
    contactEmail: email,
    contactDepartment: department,
    contactTitle: title,
    conflict:
      conflict ??
      (duplicate ? `${duplicate.name} already exists at this site. Confirm this is a different person before approving.` : undefined),
  };
}

function buildUpdateContactSuggestion(
  hospital: Hospital,
  contact: Contact,
  patch: { name?: string; email?: string; department?: string; title?: ContactTitle },
  confidence: number,
  source: string,
  conflict?: string,
): Suggestion {
  return {
    id: `${hospital.id}-update-contact-${contact.id}-${Date.now()}`,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    field: "updateContact",
    contactId: contact.id,
    currentValue: contact.name,
    suggestedValue: patch.name ?? contact.name,
    confidence,
    evidence: source,
    contactEmail: patch.email ?? contact.email,
    contactDepartment: patch.department ?? contact.department,
    contactTitle: patch.title ?? contact.title,
    contactCurrentEmail: contact.email,
    contactCurrentDepartment: contact.department,
    contactCurrentTitle: contact.title,
    conflict,
  };
}

function SuggestionFieldChange({
  label,
  current,
  suggested,
  onSuggestedChange,
  inputType = "text",
  options,
}: {
  label: string;
  current: string;
  suggested: string;
  onSuggestedChange: (value: string) => void;
  inputType?: "text" | "email" | "select";
  options?: string[];
}) {
  return (
    <div className="suggestion-field-change">
      <span className="suggestion-field-label">{label}</span>
      <small className="suggestion-current">Current: {current || "—"}</small>
      {inputType === "select" ? (
        <select className="suggestion-suggested" value={suggested} onChange={(event) => onSuggestedChange(event.target.value)}>
          {options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="suggestion-suggested"
          type={inputType}
          value={suggested}
          placeholder={`Suggested ${label.toLowerCase()}`}
          onChange={(event) => onSuggestedChange(event.target.value)}
        />
      )}
    </div>
  );
}

function SuggestionEditor({
  suggestion,
  onEdit,
  onPatch,
}: {
  suggestion: Suggestion;
  onEdit: (id: string, value: string) => void;
  onPatch: (id: string, patch: SuggestionPatch) => void;
}) {
  if (suggestion.field === "create") {
    return (
      <div className="contact-suggestion-fields">
        <SuggestionFieldChange label="Name" current="—" suggested={suggestion.suggestedValue} onSuggestedChange={(value) => onEdit(suggestion.id, value)} />
        <div className="suggestion-field-change">
          <span className="suggestion-field-label">Country</span>
          <small className="suggestion-current">Current: —</small>
          <CountryField
            key={suggestion.id}
            value={suggestion.createCountry ?? "Singapore"}
            onChange={(value) => onPatch(suggestion.id, { createCountry: value })}
          />
        </div>
        <SuggestionFieldChange
          label="Next step"
          current="—"
          suggested={suggestion.createNextStep ?? "Send EAA packet"}
          onSuggestedChange={(value) => onPatch(suggestion.id, { createNextStep: value })}
        />
      </div>
    );
  }

  if (suggestion.field === "createContact") {
    return (
      <div className="contact-suggestion-fields">
        <SuggestionFieldChange label="Name" current="—" suggested={suggestion.suggestedValue} onSuggestedChange={(value) => onEdit(suggestion.id, value)} />
        <SuggestionFieldChange
          label="Email"
          current="—"
          suggested={suggestion.contactEmail ?? ""}
          onSuggestedChange={(value) => onPatch(suggestion.id, { contactEmail: value })}
          inputType="email"
        />
        <SuggestionFieldChange
          label="Title"
          current="—"
          suggested={suggestion.contactTitle ?? "Clinical Research Coordinator (CRC)"}
          onSuggestedChange={(value) => onPatch(suggestion.id, { contactTitle: value as ContactTitle })}
          inputType="select"
          options={[...contactTitles]}
        />
        <SuggestionFieldChange
          label="Department"
          current="—"
          suggested={suggestion.contactDepartment ?? ""}
          onSuggestedChange={(value) => onPatch(suggestion.id, { contactDepartment: value })}
        />
      </div>
    );
  }

  if (suggestion.field === "updateContact") {
    const currentTitle = suggestion.contactCurrentTitle ?? "Clinical Research Coordinator (CRC)";
    const suggestedTitle = suggestion.contactTitle ?? currentTitle;
    return (
      <div className="contact-suggestion-fields">
        <SuggestionFieldChange label="Name" current={suggestion.currentValue} suggested={suggestion.suggestedValue} onSuggestedChange={(value) => onEdit(suggestion.id, value)} />
        <SuggestionFieldChange
          label="Email"
          current={suggestion.contactCurrentEmail ?? ""}
          suggested={suggestion.contactEmail ?? ""}
          onSuggestedChange={(value) => onPatch(suggestion.id, { contactEmail: value })}
          inputType="email"
        />
        <SuggestionFieldChange
          label="Title"
          current={currentTitle}
          suggested={suggestedTitle}
          onSuggestedChange={(value) => onPatch(suggestion.id, { contactTitle: value as ContactTitle })}
          inputType="select"
          options={[...contactTitles]}
        />
        <SuggestionFieldChange
          label="Department"
          current={suggestion.contactCurrentDepartment ?? ""}
          suggested={suggestion.contactDepartment ?? ""}
          onSuggestedChange={(value) => onPatch(suggestion.id, { contactDepartment: value })}
        />
      </div>
    );
  }

  return (
    <div className="suggestion-field-change">
      <small className="suggestion-current">Current: {suggestion.currentValue || "—"}</small>
      <input
        className="suggestion-suggested"
        aria-label={`Suggested ${suggestion.field} for ${suggestion.hospitalName}`}
        value={suggestion.suggestedValue}
        onChange={(event) => onEdit(suggestion.id, event.target.value)}
      />
    </div>
  );
}

type AIChange = { field?: string; value?: string; confidence?: number };
type AIContactChange = {
  action?: "create" | "update";
  matchName?: string | null;
  contactId?: string | null;
  name?: string;
  email?: string | null;
  department?: string | null;
  title?: string | null;
  confidence?: number;
};
type AIHospitalItem = {
  hospitalName?: string | null;
  isNewHospital?: boolean;
  country?: string | null;
  skip?: boolean;
  skipReason?: string | null;
  changes?: AIChange[];
  contacts?: AIContactChange[];
  summary?: string;
};
type AIResult = {
  answer?: string | null;
  hospitalName?: string | null;
  isNewHospital?: boolean;
  country?: string | null;
  changes?: AIChange[];
  contacts?: AIContactChange[];
  summary?: string;
  items?: AIHospitalItem[];
};

function clampConfidence(value: number | undefined): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 80;
  return Math.max(1, Math.min(99, Math.round(n)));
}

function currentFieldValue(hospital: Hospital, field: string): string {
  if (field === "stage") return hospital.stage;
  if (field === "nextStep") return hospital.nextStep;
  if (field === "awaiting") return hospital.awaiting;
  if (field === "notes") return hospital.notes;
  return hospital.lastInteraction;
}

function contactSuggestionsFromAI(result: AIResult, hospital: Hospital, source: string): Suggestion[] {
  const out: Suggestion[] = [];
  for (const item of result.contacts ?? []) {
    const name = (item.name ?? item.matchName ?? "").trim();
    if (!name) continue;

    if (item.action === "update") {
      const existing = findContactOnHospital(hospital, item.matchName ?? name, item.contactId);
      if (!existing) {
        out.push(
          buildCreateContactSuggestion(
            hospital,
            name,
            item.email ?? "",
            item.department ?? "",
            normalizeContactTitle(item.title),
            clampConfidence(item.confidence),
            source,
            `Couldn't find ${name} on this site — approving will add them as a new contact instead.`,
          ),
        );
        continue;
      }
      out.push(
        buildUpdateContactSuggestion(
          hospital,
          existing,
          {
            name,
            email: item.email ?? existing.email,
            department: item.department ?? existing.department,
            title: normalizeContactTitle(item.title ?? existing.title),
          },
          clampConfidence(item.confidence),
          source,
        ),
      );
      continue;
    }

    const duplicate = findContactOnHospital(hospital, name);
    if (duplicate) {
      out.push(
        buildUpdateContactSuggestion(
          hospital,
          duplicate,
          {
            name,
            email: item.email ?? duplicate.email,
            department: item.department ?? duplicate.department,
            title: normalizeContactTitle(item.title ?? duplicate.title),
          },
          clampConfidence(item.confidence),
          source,
          `${duplicate.name} already exists here — this looks like an update, not a brand-new person.`,
        ),
      );
    } else {
      out.push(
        buildCreateContactSuggestion(
          hospital,
          name,
          item.email ?? "",
          item.department ?? "",
          normalizeContactTitle(item.title),
          clampConfidence(item.confidence),
          source,
        ),
      );
    }
  }
  return out;
}

function suggestionsFromSingleAIResult(result: AIResult, hospitals: Hospital[], source: string): Suggestion[] {
  const name = (result.hospitalName ?? "").trim();
  const existingByName =
    hospitals.find((hospital) => hospital.name.toLowerCase() === name.toLowerCase()) ??
    resolveSpreadsheetHospital(name, hospitals);

  if (result.isNewHospital && name && existingByName) {
    return suggestionsFromSingleAIResult(
      {
        ...result,
        hospitalName: existingByName.name,
        isNewHospital: false,
      },
      hospitals,
      source,
    );
  }

  if (result.isNewHospital && name) {
    const country = normalizeCountryValue(result.country);
    const nextStepChange = result.changes?.find((change) => change.field === "nextStep");
    const createSuggestion = buildCreateSuggestion(
      name,
      country,
      nextStepChange?.value ?? "Send EAA packet",
      result.summary ?? name,
      82,
      source,
      similarHospitalWarning(name, hospitals),
    );
    const draftHospital: Hospital = {
      id: createSuggestion.hospitalId,
      name: createSuggestion.suggestedValue,
      country: country ?? "Singapore",
      stage: "Interest",
      substage: "Agreements sent",
      nextStep: nextStepChange?.value ?? "Send EAA packet",
      lastInteractionAt: "2026-07-18",
      lastInteraction: result.summary ?? "",
      awaiting: "us",
      notes: "",
      priorityAdjustment: 0,
      contacts: [],
      evidence: [],
      audit: [],
      stageHistory: [],
    };
    return [createSuggestion, ...contactSuggestionsFromAI(result, draftHospital, source)].slice(0, 6);
  }

  const target =
    hospitals.find((hospital) => hospital.name.toLowerCase() === name.toLowerCase()) ??
    (name ? findMentionedHospital(name, hospitals) : null);
  if (!target) return [];

  const editable = ["stage", "nextStep", "awaiting", "lastInteraction", "notes"];
  const out: Suggestion[] = [];
  for (const change of result.changes ?? []) {
    const field = change.field ?? "";
    if (!editable.includes(field) || !change.value) continue;
    let value = change.value;
    if (field === "stage" && !isStage(value)) continue;
    if (field === "awaiting") value = value.toLowerCase().includes("hosp") ? "hospital" : "us";
    out.push(buildSuggestion(target, field as Suggestion["field"], currentFieldValue(target, field), value, clampConfidence(change.confidence), source));
  }
  out.push(...contactSuggestionsFromAI(result, target, source));
  if (!out.some((suggestion) => suggestion.field === "lastInteraction") && result.summary && !(result.contacts?.length)) {
    out.unshift(buildSuggestion(target, "lastInteraction", target.lastInteraction, result.summary, 85, source));
  }
  return out.slice(0, 6);
}

function suggestionsFromAI(result: AIResult, hospitals: Hospital[]): Suggestion[] {
  const source = "Dawn AI (GPT)";

  if (result.items?.length) {
    const out: Suggestion[] = [];
    const seen = new Set<string>();
    for (const item of result.items) {
      if (item.skip) continue;
      const name = (item.hospitalName ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const existing =
        hospitals.find((hospital) => hospital.name.toLowerCase() === key) ??
        resolveSpreadsheetHospital(name, hospitals);
      const isNew = existing ? false : Boolean(item.isNewHospital);
      const single: AIResult = {
        hospitalName: existing?.name ?? name,
        isNewHospital: isNew,
        country: item.country,
        changes: item.changes,
        contacts: item.contacts,
        summary: item.summary,
      };
      out.push(...suggestionsFromSingleAIResult(single, hospitals, source));
    }
    return out.slice(0, 12);
  }

  return suggestionsFromSingleAIResult(result, hospitals, source);
}

type AiInterpretResult = {
  answer?: string;
  suggestions?: Suggestion[];
  provider?: string;
  model?: string;
  configured?: boolean;
  error?: string;
};

function formatAiAttribution(provider?: string, model?: string): string | undefined {
  if (!model) return undefined;
  const shortModel = model.replace(/^openai\//, "");
  if (provider === "ollama") return `Generated by Ollama · ${shortModel}`;
  if (provider === "openai" || provider === "github") return `Generated by GPT · ${shortModel}`;
  return `Generated by AI · ${shortModel}`;
}

async function aiInterpret(
  text: string,
  hospitals: Hospital[],
  chatHistory: string[] = [],
  options?: { voice?: boolean; inputKind?: "voice" | "text" | "file" | "spreadsheet" },
): Promise<AiInterpretResult | null> {
  const inputKind = options?.inputKind ?? (options?.voice ? "voice" : "text");
  try {
    const response = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        chatHistory,
        inputKind,
        hospitalNames: hospitals.map((hospital) => hospital.name),
        hospitalContacts: hospitals.flatMap((hospital) =>
          hospital.contacts.map((contact) => ({
            hospitalName: hospital.name,
            contactId: contact.id,
            name: contact.name,
            title: contact.title,
            email: contact.email,
            department: contact.department,
          })),
        ),
      }),
    });
    const data = await response.json().catch(() => null);
    const meta = { provider: data?.provider as string | undefined, model: data?.model as string | undefined };
    if (!response.ok) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Ask Dawn] GPT unavailable.", data?.error, data?.hint ?? data?.detail);
      }
      return {
        configured: data?.configured !== false,
        error: (data?.hint ?? data?.detail ?? data?.error ?? "GPT unavailable") as string,
        ...meta,
      };
    }
    if (!data?.configured) return { configured: false, ...meta };
    if (!data?.result) return { configured: true, error: "empty AI response", ...meta };
    const result = data.result as AIResult;
    if (result.answer && (!result.changes || result.changes.length === 0) && (!result.contacts || result.contacts.length === 0) && (!result.items || result.items.length === 0)) {
      return { answer: result.answer, configured: true, ...meta };
    }
    return { suggestions: suggestionsFromAI(result, hospitals), configured: true, ...meta };
  } catch (error) {
    const message = error instanceof Error ? error.message : "could not reach GPT";
    return { configured: true, error: message.includes("fetch") ? "fetch failed — restart npm run dev" : message };
  }
}

function smallTalkReply(text: string): string | null {
  const trimmed = text.trim().toLowerCase().replace(/[!.?,]+$/g, "").trim();
  if (!trimmed) return null;

  if (
    /^(hi+|hello+|hey+|howdy|good (morning|afternoon|evening))\b/.test(trimmed) ||
    /\bhow are you\b|\bhow'?s it going\b|\bhows it going\b/.test(trimmed)
  ) {
    return "Hi! I'm doing well — ready when you are. Tell me what happened with a hospital, or ask \"what's waiting on us?\"";
  }

  if (/^(thanks|thank you|ty|thx|cheers|great|nice|cool|perfect|awesome|lovely|got it|sounds good|ok|okay|okie|k)$/.test(trimmed)) {
    return "Anytime! Drop another update or a file whenever you're ready.";
  }

  if (/^(help|who are you|what are you)\b/.test(trimmed) || /what can you do|what do you do|how (does|do) (this|you) work/.test(trimmed)) {
    return "I turn messy updates into clear changes you approve. Try:\n• Type or paste a note like \"Harborview signed the EAA\"\n• Drop a PDF, Excel, Word, or PowerPoint file and I'll read it\n• Ask a question like \"what's waiting on us?\"\nI never change a record without your approval.";
  }
  return null;
}

async function dawnMetaReply(text: string): Promise<string | null> {
  const lower = text.trim().toLowerCase().replace(/[!.?,]+$/g, "");
  if (
    !/(what (ai|model|llm)|which model|do you use (gpt|ai)|are you (gpt|ai|a bot|chatgpt)|powered by|what gpt|who made you|who built you|what are you running|using gpt|using ai)/.test(
      lower,
    )
  ) {
    return null;
  }

  try {
    const response = await fetch("/api/parse");
    const data = await response.json().catch(() => null);
    if (data?.configured && data?.model) {
      const via = data.provider === "ollama" ? "Ollama" : data.provider === "openai" ? "OpenAI" : "GitHub Models";
      const engine = data.provider === "ollama" ? "Ollama" : "GPT";
      return `Right now I'm using ${engine} (${data.model}) via ${via} for voice notes, file reading, and messy updates. Simple greetings and hospital dashboard questions use built-in rules.\n\nI never change a hospital record unless you approve a suggestion.`;
    }
    return "AI isn't connected right now, so I'm on built-in rules only — no GPT. Add AI settings in .env.local to enable GPT (see .env.example).";
  } catch {
    return "When AI is connected I use GPT from your server settings. Otherwise I use built-in rules. I never change records without your approval.";
  }
}

function isTooVagueForUpdate(text: string, hospitals: Hospital[], contextHospital?: Hospital | null): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  const wordCount = lower.split(/\s+/).length;
  const mentionsHospital = Boolean(findMentionedHospital(text, hospitals));
  const hasUpdateSignal = UPDATE_SIGNAL.test(lower);

  if (mentionsHospital || hasUpdateSignal || contextHospital || detectNewHospitalName(text, hospitals)) return false;

  if (trimmed.length <= 4 && wordCount === 1) return true;
  if (trimmed.length <= 10 && wordCount <= 2) return true;

  return false;
}

function isGeneralQuestion(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.endsWith("?")) return true;
  return /^(what|which|who|when|where|why|how many|how much|how's|hows|show|list|tell me|give me|summar|status|do i|are there|is there|what's|whats|any )/.test(trimmed);
}

function isHospitalDashboardQuestion(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;

  if (/what('s|s| are) (my )?(priorit|waiting)|what should i (do|focus|work on)|what's waiting on us|whats waiting on us|show me (my )?priorit/.test(lower)) {
    return true;
  }

  if (/waiting on (us|the hospital|them|their)|on us|on their side|their court|ball is in/.test(lower) && /^(what|which|who|show|list|tell me|give me|any |how many)/.test(lower)) {
    return true;
  }

  if (/how many|count|number of|overview|snapshot|breakdown/.test(lower) && /^(what|which|how many|show|list|tell me|give me)/.test(lower)) {
    return true;
  }

  if (/^(what|which|who|show|list|tell me|give me|any ).*(hospital|site|waiting|stage|eaa|loi)/.test(lower)) {
    return true;
  }

  if (/(hospital|site|waiting on us|waiting on hospital)/.test(lower) && (lower.endsWith("?") || /^(what|which|who|how|show|list|tell|give|any|status)/.test(lower))) {
    return true;
  }

  return false;
}

function describeHospitalLine(hospital: Hospital, includeOwner = true): string {
  const core = `• [[hospital:${hospital.id}|${hospital.name}]] — ${hospital.nextStep} (${hospital.substage}`;
  if (!includeOwner) return `${core})`;
  const owner = hospital.awaiting === "us" ? "waiting on us" : "waiting on hospital";
  return `${core}, ${owner})`;
}

function buildDawnAnswer(text: string, hospitals: Hospital[]): string {
  const lower = text.toLowerCase();
  const byPriority = [...hospitals].sort((a, b) => priorityScore(b) - priorityScore(a));
  const waitingOnUs = byPriority.filter((hospital) => hospital.awaiting === "us");
  const waitingOnHospital = byPriority.filter((hospital) => hospital.awaiting === "hospital");

  if (/how many|count|number of|how's it|hows it|overview|snapshot|breakdown/.test(lower)) {
    const byStage = stages.map((stage) => `${hospitals.filter((hospital) => hospital.stage === stage).length} ${stage}`).join(", ");
    return `You're tracking ${hospitals.length} hospitals: ${byStage}.\n${waitingOnUs.length} ${waitingOnUs.length === 1 ? "is" : "are"} waiting on us right now.`;
  }

  if (/waiting on (the )?hospital|their court|waiting on them|on their side/.test(lower)) {
    if (!waitingOnHospital.length) return "Nothing is waiting on the hospital side right now.";
    return `${waitingOnHospital.length} ${waitingOnHospital.length === 1 ? "site is" : "sites are"} waiting on the hospital:\n${waitingOnHospital.map((hospital) => describeHospitalLine(hospital, false)).join("\n")}`;
  }

  if (/waiting on us|on us|cannot slip|can't slip|cant slip|slip|urgent|asap|our court|my court|overdue|behind/.test(lower)) {
    if (!waitingOnUs.length) return "Good news — nothing is waiting on us right now. The ball is in the hospitals' court.";
    return `${waitingOnUs.length} ${waitingOnUs.length === 1 ? "thing is" : "things are"} waiting on us — start here:\n${waitingOnUs.map((hospital) => describeHospitalLine(hospital, false)).join("\n")}`;
  }

  const focus = (waitingOnUs.length ? waitingOnUs : byPriority).slice(0, 3);
  const tail = waitingOnUs.length
    ? `\n\n${waitingOnUs.length} of your sites are waiting on us:\n${waitingOnUs.map((hospital) => describeHospitalLine(hospital, false)).join("\n")}`
    : "";
  return `Here's what I'd focus on first:\n${focus.map(describeHospitalLine).join("\n")}${tail}\n\nI haven't changed any records — just ask if you want me to update something.`;
}

function renderChatMessageContent(content: string, onOpenHospital: (hospitalId: string) => void) {
  return content.split("\n").map((line, lineIndex, lines) => {
    const parts: React.ReactNode[] = [];
    const pattern = /\[\[hospital:([^|]+)\|([^\]]+)\]\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
      const hospitalId = match[1];
      const hospitalName = match[2];
      if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
      parts.push(
        <button
          key={`${hospitalId}-${lineIndex}-${match.index}`}
          type="button"
          className="chat-hospital-link"
          onClick={() => onOpenHospital(hospitalId)}
        >
          {hospitalName}
        </button>,
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) parts.push(line.slice(lastIndex));
    return (
      <span className="chat-message-line" key={`line-${lineIndex}`}>
        {parts}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}

function applySuggestion(hospitals: Hospital[], suggestion: Suggestion): Hospital[] {
  if (suggestion.field === "create") {
    const name = suggestion.suggestedValue.trim();
    if (!name || hospitals.some((hospital) => hospital.name.toLowerCase() === name.toLowerCase())) return hospitals;
    const created = createHospital(
      `h-${Date.now()}${Math.floor(Math.random() * 1000)}`,
      name,
      suggestion.createCountry?.trim() || "Singapore",
      "Interest",
      "Agreements sent",
      suggestion.createNextStep ?? "Send EAA packet",
      "2026-07-18",
      suggestion.createSummary || "Added from a dropped file",
      "us",
      suggestion.createSummary || "Created by Dawn from an imported file.",
    );
    return [created, ...hospitals];
  }

  return hospitals.map((hospital) => {
    if (hospital.id !== suggestion.hospitalId) return hospital;

    if (suggestion.field === "createContact") {
      const name = suggestion.suggestedValue.trim();
      if (!name) return hospital;
      const newContact: Contact = {
        id: `contact-${Date.now()}`,
        name,
        email: suggestion.contactEmail ?? "",
        department: suggestion.contactDepartment ?? "",
        title: suggestion.contactTitle ?? "Clinical Research Coordinator (CRC)",
      };
      return {
        ...hospital,
        contacts: [...hospital.contacts, newContact],
        evidence: [
          {
            id: `${suggestion.id}-evidence`,
            label: suggestion.evidence,
            text: `Added contact ${formatContactLine(newContact)}`,
            at: "2026-07-18",
          },
          ...hospital.evidence,
        ],
        audit: [
          {
            id: `${suggestion.id}-audit`,
            at: "2026-07-18 20:45",
            by: "Demo user",
            action: `Approved new contact ${newContact.name}`,
            source: suggestion.evidence,
          },
          ...hospital.audit,
        ],
      };
    }

    if (suggestion.field === "updateContact" && suggestion.contactId) {
      const previous = hospital.contacts.find((contact) => contact.id === suggestion.contactId);
      if (!previous) return hospital;
      const updated: Contact = {
        ...previous,
        name: suggestion.suggestedValue.trim() || previous.name,
        email: suggestion.contactEmail ?? previous.email,
        department: suggestion.contactDepartment ?? previous.department,
        title: suggestion.contactTitle ?? previous.title,
      };
      return {
        ...hospital,
        contacts: hospital.contacts.map((contact) => (contact.id === suggestion.contactId ? updated : contact)),
        evidence: [
          {
            id: `${suggestion.id}-evidence`,
            label: suggestion.evidence,
            text: `Contact ${formatContactLine(previous)} -> ${formatContactLine(updated)}`,
            at: "2026-07-18",
          },
          ...hospital.evidence,
        ],
        audit: [
          {
            id: `${suggestion.id}-audit`,
            at: "2026-07-18 20:45",
            by: "Demo user",
            action: `Approved contact update for ${updated.name}`,
            source: suggestion.evidence,
          },
          ...hospital.audit,
        ],
      };
    }

    const next = { ...hospital };
    if (suggestion.field === "stage" && isStage(suggestion.suggestedValue)) next.stage = suggestion.suggestedValue;
    if (suggestion.field === "nextStep") next.nextStep = suggestion.suggestedValue;
    if (suggestion.field === "lastInteraction") {
      next.lastInteraction = suggestion.suggestedValue;
      next.lastInteractionAt = "2026-07-18";
    }
    if (suggestion.field === "awaiting") next.awaiting = suggestion.suggestedValue.toLowerCase().includes("hospital") ? "hospital" : "us";
    if (suggestion.field === "notes") next.notes = suggestion.suggestedValue;

    const interactionText =
      suggestion.field === "lastInteraction" || suggestion.field === "notes"
        ? suggestion.suggestedValue
        : `${suggestion.field}: ${suggestion.currentValue} -> ${suggestion.suggestedValue}`;

    next.evidence = [
      {
        id: `${suggestion.id}-evidence`,
        label: suggestion.evidence,
        text: interactionText,
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
  onPatch,
  onClose,
}: {
  suggestions: Suggestion[];
  onApprove: (suggestion: Suggestion) => void;
  onApproveAll: () => void;
  onDismiss: (id: string) => void;
  onEdit: (id: string, value: string) => void;
  onPatch: (id: string, patch: SuggestionPatch) => void;
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
                <span>{suggestionFieldLabel(suggestion.field)}</span>
              </div>
              <SuggestionEditor suggestion={suggestion} onEdit={onEdit} onPatch={onPatch} />
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
  className,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onTitleChange?: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`drawer-backdrop ${className ?? ""}`.trim()} onClick={onClose}>
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
        <h3>Activity</h3>
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
  if (score >= 90) return "Critical";
  if (score >= 78) return "Urgent";
  if (score >= 66) return "Very high";
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
  if (drawer === "audit") return "Activity";
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

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "Unassigned";
}

function createWorkbook(hospitals: Hospital[], files: StoredFile[]) {
  const workbook = XLSX.utils.book_new();
  const sheets: Array<[string, Record<string, unknown>[]]> = [
    ["Hospitals", hospitals.map((hospital) => ({
      Hospital: hospital.name, Country: hospital.country, Stage: hospital.stage, Substage: hospital.substage,
      "Next step": hospital.nextStep, "Last interaction date": hospital.lastInteractionAt, "Last interaction": hospital.lastInteraction,
      Awaiting: hospital.awaiting === "us" ? "Jeremy" : hospital.contacts.find((contact) => contact.id === hospital.awaitingContactId)?.name ?? "Hospital contact",
      Notes: hospital.notes,
    }))],
    ["Contacts", hospitals.flatMap((hospital) => hospital.contacts.map((contact) => ({ Hospital: hospital.name, Name: contact.name, Title: contact.title, Department: contact.department, Email: contact.email })))],
    ["Interactions", hospitals.flatMap((hospital) => hospital.evidence.map((item) => ({ Hospital: hospital.name, Title: item.label, Date: item.at, Type: item.kind ?? "note", Details: item.text })))],
    ["Activity", hospitals.flatMap((hospital) => hospital.audit.map((item) => ({ Hospital: hospital.name, Date: item.at, By: item.by, Action: item.action, Source: item.source })))],
    ["Stage history", hospitals.flatMap((hospital) => hospital.stageHistory.map((item) => ({ Hospital: hospital.name, Entry: item })))],
    ["Files", files.map((file) => ({ File: file.name, Hospital: file.hospitalName, Type: file.type, Bytes: file.size, Uploaded: file.uploadedAt, Source: file.source }))],
  ];
  sheets.forEach(([name, rows]) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name));
  return XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
}

async function exportAllArchive(hospitals: Hospital[], files: StoredFile[]) {
  const zip = new JSZip();
  zip.file("dawn-structured-data.xlsx", createWorkbook(hospitals, files));
  files.forEach((file) => {
    zip.folder(`attachments/${safeFileName(file.hospitalName)}`)?.file(file.name, file.data ?? file.content ?? `File: ${file.name}\nStored in Dawn for ${file.hospitalName}.`);
  });
  downloadBlob(await zip.generateAsync({ type: "blob" }), "dawn-export.zip");
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

function ExpandIcon() {
  return (
    <Icon>
      <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
