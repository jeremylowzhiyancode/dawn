"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import {
  AuditDrawer as EditableAuditDrawer,
  FileStorageDrawer as EditableFileStorageDrawer,
  HospitalDetail as EditableHospitalDetail,
  NewHospitalDrawer as EditableNewHospitalDrawer,
  SettingsDrawer as EditableSettingsDrawer,
} from "./Drawers";
import { extractTextFromFile } from "./fileExtraction";

export type Stage = "Interest" | "Kickoff" | "Pilot" | "Active";
export type Awaiting = "us" | "hospital";
export type Country = "Singapore" | "Malaysia" | "Indonesia" | "Thailand" | "Vietnam";
export type SortKey = "priority" | "hospital" | "stage" | "nextStep" | "lastInteraction" | "awaiting" | "country";
export type SortDirection = "asc" | "desc";
type Priority = "Low" | "Med" | "High" | "Very high" | "Urgent" | "Very urgent";
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
  field: "stage" | "nextStep" | "lastInteraction" | "awaiting" | "notes" | "newHospital" | "newContact" | "contactUpdate";
  currentValue: string;
  suggestedValue: string;
  confidence: number;
  evidence: string;
  sourceText?: string;
  conflict?: string;
  entity?: {
    hospital?: Hospital;
    contact?: Contact;
  };
};

type ChatMessage = {
  id: string;
  content: string;
  role: "user" | "assistant";
  hospitalId?: string;
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
const dashboardGreetings = [
  "A clearer day ahead.",
  "Welcome back — let’s keep this going.",
  "You’ve got this. One good move at a time.",
  "Let’s make today feel lighter.",
  "Small wins add up. You’re on it.",
  "Ready when you are.",
];
export const stages: Stage[] = ["Interest", "Kickoff", "Pilot", "Active"];
export const countries: Country[] = ["Singapore", "Malaysia", "Indonesia", "Thailand", "Vietnam"];
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
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('<strong>High</strong><br><label><input type="checkbox" /> Book kickoff for Northbridge</label><br><label><input type="checkbox" /> Send EAA packet to Harborview</label><br><label><input type="checkbox" /> Check pilot form at Redwood</label>');
  const [composer, setComposer] = useState("");
  const [isNoteOpen, setNoteOpen] = useState(true);
  const [isNoteMenuOpen, setNoteMenuOpen] = useState(false);
  const [noteColor, setNoteColor] = useState<"yellow" | "peach" | "pink">("yellow");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isReviewOpen, setReviewOpen] = useState(false);
  const [isDawnFocused, setDawnFocused] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<Hospital[] | null>(null);
  const [isListening, setListening] = useState(false);
  const [isDawnExpanded, setDawnExpanded] = useState(false);
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
  const [draggedHospitalId, setDraggedHospitalId] = useState<string | null>(null);
  const [dragOverHospitalId, setDragOverHospitalId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteFileInputRef = useRef<HTMLInputElement>(null);
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const restoreChecklistCaretRef = useRef(false);
  const dawnPanelRef = useRef<HTMLElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const previousRowPositions = useRef(new Map<string, DOMRect>());

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
    if (!restoreChecklistCaretRef.current || !noteEditorRef.current) return;
    const editor = noteEditorRef.current;
    const newestChecklist = editor.querySelector("label:last-of-type");
    const textNode = newestChecklist?.lastChild;
    if (textNode) {
      const range = document.createRange();
      range.setStart(textNode, textNode.textContent?.length ?? 0);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      editor.focus();
      newestChecklist?.scrollIntoView({ block: "nearest" });
    }
    restoreChecklistCaretRef.current = false;
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
      const target = event.target as Node;
      if (isDawnExpanded && !chatMessages.length && !composer.trim() && !dawnPanelRef.current?.contains(target)) {
        setDawnExpanded(false);
      }
    }
    document.addEventListener("mousedown", collapseUntouchedDawn);
    return () => document.removeEventListener("mousedown", collapseUntouchedDawn);
  }, [chatMessages.length, composer, isDawnExpanded]);

  useEffect(() => {
    if (!isDawnFocused) return;
    const frame = window.requestAnimationFrame(() => dawnPanelRef.current?.scrollTo({ top: 0 }));
    return () => window.cancelAnimationFrame(frame);
  }, [isDawnFocused, suggestions.length]);

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
      .sort((a, b) => {
        if (sortKey === "priority" && manualOrder.length) {
          const aManualIndex = manualOrder.indexOf(a.id);
          const bManualIndex = manualOrder.indexOf(b.id);
          if (aManualIndex >= 0 && bManualIndex >= 0) return aManualIndex - bManualIndex;
          if (aManualIndex >= 0) return -1;
          if (bManualIndex >= 0) return 1;
        }
        return compareHospitals(a, b, sortKey, sortDirection);
      });
  }, [activeStage, hospitals, manualOrder, query, sortDirection, sortKey]);

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

  function formatNote(command: "bold" | "italic" | "underline" | "strikeThrough" | "insertUnorderedList") {
    noteEditorRef.current?.focus();
    document.execCommand(command);
    updateNoteFromEditor();
  }

  function insertChecklistItem() {
    noteEditorRef.current?.focus();
    document.execCommand("insertText", false, "☐ ");
    updateNoteFromEditor();
  }

  function createNewNote() {
    setNote("");
    setNoteMenuOpen(false);
    window.setTimeout(() => noteEditorRef.current?.focus(), 0);
  }

  function addChecklistItem() {
    noteEditorRef.current?.focus();
    document.execCommand("insertHTML", false, '<br><label><input type="checkbox" /> </label>');
    restoreChecklistCaretRef.current = true;
    updateNoteFromEditor();
  }

  function insertNoteImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    noteEditorRef.current?.focus();
    document.execCommand("insertImage", false, URL.createObjectURL(file));
    updateNoteFromEditor();
    event.target.value = "";
  }

  function handleStage(stage: Stage | "All") {
    setActiveStage(stage);
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    setPage(1);
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "priority" || key === "lastInteraction" ? "desc" : "asc");
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return <span className="sort-indicator" aria-hidden="true">↕</span>;
    return <span className="sort-indicator active" aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>;
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

  function placeAtPriorityPosition(hospitalId: string, position: "before" | "after") {
    if (!draggedHospitalId || draggedHospitalId === hospitalId) return;

    setLastSnapshot(hospitals);

    setHospitals((current) => {
      const draggedHospital = current.find((hospital) => hospital.id === draggedHospitalId);
      const targetHospital = current.find((hospital) => hospital.id === hospitalId);
      if (!draggedHospital || !targetHospital) return current;

      const ordered = [...current].sort((a, b) => priorityScore(b) - priorityScore(a));
      const targetIndex = ordered.findIndex((hospital) => hospital.id === targetHospital.id);
      const neighbour = position === "before" ? ordered[targetIndex - 1] : ordered[targetIndex + 1];
      const targetScore = priorityScore(targetHospital);
      const rawNextScore = neighbour
        ? (targetScore + priorityScore(neighbour)) / 2
        : targetScore + (position === "before" ? 1 : -1);
      const [tierFloor, tierCeiling] = priorityScoreRange(priorityFor(targetHospital));
      const nextScore = Math.max(tierFloor, Math.min(tierCeiling, rawNextScore));
      const nextAdjustment = nextScore - suggestedPriorityScore(draggedHospital);
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
                  action: `Placed ${position} ${targetHospital.name}; priority is now ${priorityFor(targetHospital)}`,
                  source: "Manual drag priority",
                },
                ...hospital.audit,
              ],
            }
          : hospital,
      );
    });
    setManualOrder((currentOrder) => {
      const ordered = [...hospitals].sort((a, b) => {
        const aManualIndex = currentOrder.indexOf(a.id);
        const bManualIndex = currentOrder.indexOf(b.id);
        if (aManualIndex >= 0 && bManualIndex >= 0) return aManualIndex - bManualIndex;
        if (aManualIndex >= 0) return -1;
        if (bManualIndex >= 0) return 1;
        return compareHospitals(a, b, "priority", "desc");
      });
      const ids = ordered.map((hospital) => hospital.id).filter((id) => id !== draggedHospitalId);
      const targetIndex = ids.indexOf(hospitalId);
      ids.splice(Math.max(0, targetIndex + (position === "after" ? 1 : 0)), 0, draggedHospitalId);
      return ids;
    });
    setDraggedHospitalId(null);
    setDragOverHospitalId(null);
  }

  function handleComposerSend() {
    const text = composer.trim();
    if (!text) return;

    recordChatMessage(text, "user");
    setDawnExpanded(true);
    setDawnFocused(true);

    if (/export|excel|download/i.test(text)) {
      void exportAllArchive(hospitals, uploadedFiles);
      recordChatMessage("I prepared the export. Your hospital records have not been changed.", "assistant");
      setComposer("");
      return;
    }

    const nextSuggestions = createSuggestions(text, hospitals).map((suggestion) => ({ ...suggestion, sourceText: text }));
    setSuggestions(nextSuggestions);
    const readableFields = nextSuggestions.map((suggestion) => formatSuggestionField(suggestion.field).toLowerCase());
    const affectedHospitals = [...new Set(nextSuggestions.map((suggestion) => suggestion.hospitalName))];
    if (nextSuggestions.length) {
      recordChatMessage(
        `I found ${nextSuggestions.length} proposed ${nextSuggestions.length === 1 ? "update" : "updates"} across ${affectedHospitals.join(", ")}: ${readableFields.join(", ")}. I’ve kept the source note unchanged and made the proposed interactions concise for your review.`,
        "assistant",
      );
    }
    if (!nextSuggestions.length) recordChatMessage(
      false
        ? `Okay, noted. It sounds like you want to update ${nextSuggestions.map((suggestion) => `${suggestion.hospitalName}'s ${suggestion.field}`).join(" and ")}. I’ve prepared ${nextSuggestions.length === 1 ? "the change" : "the changes"} below for your approval.`
        : "Okay, noted. I couldn’t safely identify a record to change, so I’ve left everything unchanged.",
      "assistant",
    );
    setComposer("");
  }

  function recordChatMessage(content: string, role: ChatMessage["role"] = "user", hospitalId?: string) {
    setChatMessages((current) => {
      if (current[current.length - 1]?.content === content && current[current.length - 1]?.role === role) return current;
      return [...current, { id: `chat-${Date.now()}-${role}-${current.length}`, content, role, hospitalId }];
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
                  action: `Dawn AI added ${interaction.kind === "voice" ? "a voice note" : interaction.kind === "note" ? "a note" : interaction.kind === "image" ? "an image" : "a file"}: ${interaction.label}`,
                  source: "Linked interaction",
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
    if (!file) return;
    setDawnExpanded(true);
    recordChatMessage(`Reading ${file.name}…`, "assistant");
    const extraction = await extractTextFromFile(file);
    const sourceText = extraction.text.trim();
    const hospital = inferAttachmentHospital(`${file.name}\n${sourceText}`);
    if (!hospital) return;
    const data = await file.arrayBuffer();
    const kind = file.type.startsWith("image/") ? "image" : "file";
    const interaction: EvidenceItem = {
      id: `interaction-${Date.now()}`,
      label: file.name,
      text: sourceText
        ? `Extracted from ${file.name}: ${sourceText.slice(0, 420)}${sourceText.length > 420 ? "…" : ""}`
        : `Attached through Dawn AI and linked to ${hospital.name}. ${extraction.note}`,
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
        content: sourceText || undefined,
        data,
      },
      ...current,
    ]);
    recordChatMessage(sourceText
      ? `Extracted ${sourceText.length} characters from ${file.name}, linked it to ${hospital.name}, and prepared any safe changes for review. ${extraction.note}`
      : `Attached ${file.name} as an interaction for ${hospital.name}. ${extraction.note}`, "assistant");
    setSuggestions(createSuggestions(`Uploaded file: ${file.name}\n${sourceText || `for ${hospital.name}`}`, hospitals, file.name)
      .map((suggestion) => ({ ...suggestion, sourceText: sourceText || undefined })));
    event.target.value = "";
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

    setDawnFocused(true);

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
    recognition.lang = "en-SG";
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

  function updateContactSuggestionField(id: string, field: "name" | "title" | "department", value: string) {
    setSuggestions((current) => current.map((suggestion) => {
      if (suggestion.id !== id || (suggestion.field !== "newContact" && suggestion.field !== "contactUpdate") || !suggestion.entity?.contact) return suggestion;
      const contact = { ...suggestion.entity.contact, [field]: value };
      return {
        ...suggestion,
        entity: { ...suggestion.entity, contact },
        suggestedValue: `${contact.name} · ${contact.title}`,
      };
    }));
  }

  function dismissSuggestion(id: string) {
    setSuggestions((current) => current.filter((suggestion) => suggestion.id !== id));
  }

  function approveSuggestion(suggestion: Suggestion) {
    setLastSnapshot(hospitals);
    setHospitals((current) => attachApprovedNoteInteraction(applySuggestion(current, suggestion), suggestion));
    dismissSuggestion(suggestion.id);
    recordChatMessage(`Done — ${formatSuggestionField(suggestion.field)} saved for ${suggestion.hospitalName}.`, "assistant", suggestion.hospitalId);
  }

  function approveAll() {
    setLastSnapshot(hospitals);
    setHospitals((current) => suggestions.reduce((next, suggestion) => attachApprovedNoteInteraction(applySuggestion(next, suggestion), suggestion), current));
    suggestions.forEach((suggestion) => recordChatMessage(`Done — ${formatSuggestionField(suggestion.field)} saved for ${suggestion.hospitalName}.`, "assistant", suggestion.hospitalId));
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
                <button className="sort-header" onClick={() => toggleSort("priority")} aria-label={`Sort by ${settings.fieldLabels.priority}`}>
                  {settings.fieldLabels.priority} {sortIndicator("priority")}
                </button>
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
              <div role="columnheader"><button className="sort-header" onClick={() => toggleSort("hospital")}>{settings.fieldLabels.hospital} {sortIndicator("hospital")}</button></div>
              <div role="columnheader" className="status-heading">
                <button className="sort-header" onClick={() => toggleSort("stage")}>{settings.fieldLabels.stage} {sortIndicator("stage")}</button>
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
              <div role="columnheader"><button className="sort-header" onClick={() => toggleSort("nextStep")}>{settings.fieldLabels.nextStep} {sortIndicator("nextStep")}</button></div>
              <div role="columnheader"><button className="sort-header" onClick={() => toggleSort("lastInteraction")}>{settings.fieldLabels.lastInteraction} {sortIndicator("lastInteraction")}</button></div>
              <div role="columnheader"><button className="sort-header" onClick={() => toggleSort("awaiting")}>{settings.fieldLabels.awaiting} {sortIndicator("awaiting")}</button></div>
            </div>
            {visibleHospitals.map((hospital) => {
              const priority = priorityFor(hospital);
              const awaitingContact = hospital.awaiting === "hospital" ? contactAwaiting(hospital) : null;
              return (
              <div
                className={`table-row data-row priority-${priority.toLowerCase().replaceAll(" ", "-")} ${dragOverHospitalId === hospital.id ? "is-drag-target" : ""}`}
                role="row"
                key={hospital.id}
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
                  const bounds = event.currentTarget.getBoundingClientRect();
                  placeAtPriorityPosition(hospital.id, event.clientY < bounds.top + bounds.height / 2 ? "before" : "after");
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
                  <button className="hospital-name" type="button" onClick={() => openHospital(hospital)}>
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
          {isNoteOpen ? <section className={`note-panel note-${noteColor}`} aria-label="Quick note">
          <div className="note-topbar">
            <button type="button" aria-label="New note" onClick={createNewNote}>+</button>
            <div className="note-menu-wrap">
              <button type="button" aria-label="Note options" onClick={() => setNoteMenuOpen((current) => !current)}>•••</button>
              {isNoteMenuOpen ? <div className="note-menu" role="menu">
                {(["yellow", "peach", "pink"] as const).map((color) => <button key={color} type="button" onClick={() => { setNoteColor(color); setNoteMenuOpen(false); }}>{color}</button>)}
              </div> : null}
            </div>
            <button type="button" aria-label="Close note" onClick={() => setNoteOpen(false)}>×</button>
          </div>
          <div className="note-toolbar">
            <button type="button" aria-label="Bold note text" onMouseDown={(event) => event.preventDefault()} onClick={() => formatNote("bold")}>B</button>
            <button type="button" aria-label="Italic note text" onMouseDown={(event) => event.preventDefault()} onClick={() => formatNote("italic")}>I</button>
            <button type="button" aria-label="Underline note text" onMouseDown={(event) => event.preventDefault()} onClick={() => formatNote("underline")}>U</button>
            <button type="button" aria-label="Strike through note text" onMouseDown={(event) => event.preventDefault()} onClick={() => formatNote("strikeThrough")}>S</button>
            <button type="button" aria-label="Checklist" onMouseDown={(event) => event.preventDefault()} onClick={insertChecklistItem}>☑</button>
            <button type="button" aria-label="Bullets" onMouseDown={(event) => event.preventDefault()} onClick={() => formatNote("insertUnorderedList")}>•</button>
            <input ref={noteFileInputRef} type="file" accept="image/*" className="sr-only" onChange={insertNoteImage} />
            <button type="button" aria-label="Add image to note" onClick={() => noteFileInputRef.current?.click()}>▧</button>
          </div>
            <div
              ref={noteEditorRef}
              className="note-editor"
              contentEditable
              dir="ltr"
              suppressContentEditableWarning
              role="textbox"
              aria-label="Quick note editor"
              onInput={updateNoteFromEditor}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addChecklistItem();
                }
              }}
              onClick={(event) => {
                const target = event.target as HTMLInputElement;
                if (target.type === "checkbox") {
                  if (target.checked) target.setAttribute("checked", "checked");
                  else target.removeAttribute("checked");
                  updateNoteFromEditor();
                }
              }}
              dangerouslySetInnerHTML={{ __html: note }}
            />
          </section> : <button className="open-note" type="button" onClick={() => setNoteOpen(true)}>Open note</button>}

          <section ref={dawnPanelRef} className={`dawn-sidecar ${isDawnExpanded ? "is-expanded" : ""} ${isDawnFocused ? "is-focused" : ""}`} aria-label="Ask Dawn">
            {isDawnExpanded ? (
              <>
                <header>
                  <div className="chat-title">
                    <h2>Ask Dawn</h2>
                  </div>
                  {isDawnFocused ? <button className="chat-focus-close" type="button" aria-label="Minimize Ask Dawn" onClick={() => setDawnFocused(false)}>×</button> : null}
                </header>
                <div className="chat-thread" aria-live="polite">
                  {chatMessages.length ? (
                    chatMessages.map((message) => (
                      <div className={`chat-message ${message.role}`} key={message.id}>
                        <span>{message.content}</span>
                        {message.role === "assistant" && message.hospitalId ? (
                          <button
                            className="chat-message-open-record"
                            type="button"
                            aria-label={`Open ${message.content.match(/for (.+)\.$/)?.[1] ?? "approved record"}`}
                            title="Open approved record"
                            onClick={() => {
                              const hospital = hospitals.find((item) => item.id === message.hospitalId);
                              if (hospital) openHospital(hospital);
                            }}
                          >
                            ↗
                          </button>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="chat-empty">Use the microphone for a voice note, type a quick update, or drop a file. Dawn will do the rest.</p>
                  )}
                </div>
                {suggestions.length ? (
                  <section className="chat-suggestions" aria-label="Dawn suggested changes">
                    <header>
                      <div>
                        <b>Dawn suggests {suggestions.length} change{suggestions.length === 1 ? "" : "s"}</b>
                        <small>Review each one before it updates Onboard.</small>
                      </div>
                      <div className="chat-review-actions">
                        <button className="chat-focus-review" onClick={() => setDawnFocused(true)}>Review</button>
                        <button className="chat-approve-all" onClick={approveAll}>Approve all</button>
                      </div>
                    </header>
                    {suggestions.map((suggestion) => (
                      <article key={suggestion.id}>
                        <div className="chat-suggestion-title">
                          <b>{suggestion.hospitalName}</b>
                          <div>
                            <span>{formatSuggestionField(suggestion.field)}</span>
                            <button
                              className="open-hospital-button"
                              aria-label={`Open ${suggestion.hospitalName}`}
                              title={`Open ${suggestion.hospitalName}`}
                              onClick={() => {
                                const hospital = hospitals.find((item) => item.id === suggestion.hospitalId);
                                if (hospital) openHospital(hospital);
                              }}
                            >
                              ↗
                            </button>
                          </div>
                        </div>
                        <p className="suggestion-diff"><span>Current</span>{suggestion.currentValue || "Not set"}<span>Suggested</span></p>
                        {isEntitySuggestion(suggestion) ? (
                          <EntityStoragePreview suggestion={suggestion} onContactFieldChange={updateContactSuggestionField} />
                        ) : (
                          <textarea
                            aria-label={`Suggested ${suggestion.field} for ${suggestion.hospitalName}`}
                            rows={suggestion.field === "lastInteraction" ? 3 : 2}
                            value={suggestion.suggestedValue}
                            onChange={(event) => updateSuggestion(suggestion.id, event.target.value)}
                          />
                        )}
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
                    rows={1}
                    value={composer}
                    onChange={(event) => {
                      setComposer(event.target.value);
                      event.currentTarget.style.height = "auto";
                      event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 94)}px`;
                    }}
                    onFocus={() => {
                      setDawnFocused(true);
                      window.requestAnimationFrame(() => dawnPanelRef.current?.scrollTo({ top: 0 }));
                    }}
                    onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleComposerSend();
                      }
                    }}
                    placeholder="Speak or type an update"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept=".txt,.md,.csv,.json,.xlsx,.xls,.docx,.pptx,.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,image/*,text/plain,application/pdf"
                    onChange={handleFile}
                  />
                  <button className="composer-icon" aria-label="Attach file" title="Attach PDF, Word, Excel, PPT, image, or text" onClick={() => fileInputRef.current?.click()}>
                    <PaperclipIcon />
                  </button>
                </section>
              </>
            ) : (
              <button className="dawn-prompt" type="button" onClick={() => { setDawnExpanded(true); setDawnFocused(true); }} aria-expanded={false}>
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
          onEditContactField={updateContactSuggestionField}
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

function formatSuggestionField(field: Suggestion["field"]) {
  return field === "newHospital" ? "New hospital" : field === "newContact" ? "New contact" : field === "contactUpdate" ? "Update contact" : field === "lastInteraction" ? "Last interaction" : field === "nextStep" ? "Next step" : field === "awaiting" ? "Awaiting" : field === "stage" ? "Stage" : "Notes";
}

function isEntitySuggestion(suggestion: Suggestion) {
  return suggestion.field === "newHospital" || suggestion.field === "newContact" || suggestion.field === "contactUpdate";
}

function EntityStoragePreview({
  suggestion,
  onContactFieldChange,
}: {
  suggestion: Suggestion;
  onContactFieldChange?: (id: string, field: "name" | "title" | "department", value: string) => void;
}) {
  const contact = suggestion.entity?.contact;
  const hospital = suggestion.entity?.hospital;

  if ((suggestion.field === "newContact" || suggestion.field === "contactUpdate") && contact) {
    return (
      <section className="suggestion-storage-preview" aria-label={`Contact fields to save for ${contact.name}`}>
        <p>{suggestion.field === "newContact" ? "Will be saved as a new contact" : "Will update this existing contact"}</p>
        <dl>
          <div><dt>Name</dt><dd>{onContactFieldChange ? <input aria-label={`Contact name to save for ${suggestion.hospitalName}`} value={contact.name} onChange={(event) => onContactFieldChange(suggestion.id, "name", event.target.value)} /> : contact.name}</dd></div>
          <div><dt>Title</dt><dd>{onContactFieldChange ? <input aria-label={`Contact title to save for ${suggestion.hospitalName}`} value={contact.title} onChange={(event) => onContactFieldChange(suggestion.id, "title", event.target.value)} /> : contact.title}</dd></div>
          <div><dt>Department</dt><dd>{onContactFieldChange ? <input aria-label={`Contact department to save for ${suggestion.hospitalName}`} value={contact.department || "To be confirmed"} onChange={(event) => onContactFieldChange(suggestion.id, "department", event.target.value)} /> : (contact.department || "To be confirmed")}</dd></div>
        </dl>
      </section>
    );
  }

  if (suggestion.field === "newHospital" && hospital) {
    return (
      <section className="suggestion-storage-preview" aria-label={`Hospital fields to save for ${hospital.name}`}>
        <p>Will be saved as a new hospital</p>
        <dl>
          <div><dt>Hospital name</dt><dd>{hospital.name}</dd></div>
          <div><dt>Country</dt><dd>{hospital.country}</dd></div>
          <div><dt>Starting stage</dt><dd>{hospital.stage} · {hospital.substage}</dd></div>
        </dl>
      </section>
    );
  }

  return null;
}

function createSuggestions(text: string, hospitals: Hospital[], source = "Messy note"): Suggestion[] {
  const entitySuggestions = createEntitySuggestions(text, hospitals, source);
  const mentionedHospitals = hospitals.filter((hospital) => hospitalMentioned(text, hospital));
  const targets = mentionedHospitals.length
    ? mentionedHospitals
    : entitySuggestions.length
      ? []
      : [[...hospitals].sort((a, b) => priorityScore(b) - priorityScore(a))[0]].filter(Boolean) as Hospital[];

  const hospitalSuggestions = targets.flatMap((hospital) => {
    const context = hospitalContext(text, hospital, hospitals);
    if (!context || isExplicitlyUnrelated(context)) return [];
    return createHospitalSuggestions(hospital, context, source, mentionedHospitals.length > 0);
  });

  return [...entitySuggestions, ...hospitalSuggestions].slice(0, 10);
}

function createEntitySuggestions(text: string, hospitals: Hospital[], source: string): Suggestion[] {
  const updates: Suggestion[] = [];
  const newHospitalMatch = text.match(/(?:new\s+(?:hospital|site)|add\s+(?:a\s+)?new\s+(?:hospital|site))\s*[:\-]?\s*(?:called\s+|named\s+)?([A-Z][A-Za-z&' -]+?)(?=,|\s+(?:in|from|based)\b|[.!])/i);
  const newHospitalName = newHospitalMatch?.[1]?.trim().replace(/\s+/g, " ");
  const country = countries.find((candidate) => new RegExp(`\\b${candidate}\\b`, "i").test(text)) ?? "Singapore";
  const newHospitalId = newHospitalName ? `new-${slugify(newHospitalName)}` : "";

  if (newHospitalName && !hospitals.some((hospital) => hospital.name.toLowerCase() === newHospitalName.toLowerCase())) {
    const proposedHospital: Hospital = {
      id: newHospitalId,
      name: newHospitalName,
      country,
      stage: "Interest",
      substage: "Agreements sent",
      nextStep: "Send EAA packet",
      lastInteractionAt: "2026-07-18",
      lastInteraction: `New hospital identified from Dawn note.`,
      awaiting: "hospital",
      priorityAdjustment: 0,
      awaitingContactId: "",
      notes: "Created from an approved Dawn suggestion.",
      contacts: [],
      evidence: [],
      audit: [],
      stageHistory: ["Interest: created from approved Dawn suggestion"],
    };
    updates.push({
      id: `${newHospitalId}-new-hospital-${Date.now()}`,
      hospitalId: newHospitalId,
      hospitalName: newHospitalName,
      field: "newHospital",
      currentValue: "Not in Onboard",
      suggestedValue: `${newHospitalName} · ${country} · Interest`,
      confidence: 88,
      evidence: source,
      entity: { hospital: proposedHospital },
    });

    const contact = extractProposedContact(text);
    if (contact) updates.push(buildNewContactSuggestion(newHospitalId, newHospitalName, contact, source));
  }

  for (const hospital of hospitals) {
    const context = hospitalContext(text, hospital, hospitals);
    if (!context || isExplicitlyUnrelated(context)) continue;
    const contact = extractProposedContact(context);
    if (contact) {
      const existing = hospital.contacts.find((item) => item.name.toLowerCase() === contact.name.toLowerCase());
      if (!existing) {
        updates.push(buildNewContactSuggestion(hospital.id, hospital.name, contact, source));
      } else if (existing.title !== contact.title || existing.department.trim().toLowerCase() !== contact.department.trim().toLowerCase()) {
        updates.push(buildContactUpdateSuggestion(hospital.id, hospital.name, existing, contact, source));
      }
    }
  }

  return updates;
}

function extractProposedContact(text: string): Contact | null {
  const match = text.match(/(?:new\s+contact|add\s+(?:a\s+)?contact|main\s+contact(?:\s+is)?|contact(?:\s+is)?)\s*[:\-]?\s*(?:is\s+)?((?:Dr\.?\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*,?\s*(?:the\s+)?([A-Za-z /()-]+?)(?=[.!;]|$)/i);
  if (!match) return null;
  const name = match[1].replace(/\s+/g, " ").trim();
  const role = match[2].trim().toLowerCase();
  const title = contactTitles.find((candidate) => role.includes(candidate.toLowerCase().split(" /")[0]))
    ?? (role.includes("security") ? "IT Security Officer"
      : role.includes("legal") ? "Legal Counsel"
      : role.includes("clinical") || role.includes("trial") ? "Clinical Trials Manager / Clinical Operations Manager"
      : "Hospital Administrator");
  const department = role.includes("security") || title === "IT Security Officer" ? "Information Technology"
    : role.includes("legal") ? "Legal"
      : role.includes("clinical") || role.includes("trial") ? "Clinical Operations"
        : role ? role.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "To be confirmed";
  return {
    id: `contact-${slugify(name)}-${Date.now()}`,
    name,
    email: "",
    department,
    title,
  };
}

function buildNewContactSuggestion(hospitalId: string, hospitalName: string, contact: Contact, source: string): Suggestion {
  return {
    id: `${hospitalId}-${contact.id}-new-contact`,
    hospitalId,
    hospitalName,
    field: "newContact",
    currentValue: "No matching contact",
    suggestedValue: `${contact.name} · ${contact.title}`,
    confidence: 86,
    evidence: source,
    entity: { contact },
  };
}

function buildContactUpdateSuggestion(hospitalId: string, hospitalName: string, existing: Contact, proposed: Contact, source: string): Suggestion {
  return {
    id: `${hospitalId}-${existing.id}-contact-update-${Date.now()}`,
    hospitalId,
    hospitalName,
    field: "contactUpdate",
    currentValue: `${existing.name} · ${existing.title}`,
    suggestedValue: `${proposed.name} · ${proposed.title}`,
    confidence: 84,
    evidence: source,
    entity: { contact: { ...proposed, id: existing.id, email: existing.email } },
  };
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function hospitalMentioned(text: string, hospital: Hospital) {
  const lower = text.toLowerCase();
  const words = hospital.name.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const genericSiteWords = new Set(["academic", "center", "clinic", "general", "health", "hospital", "institute", "medical", "research", "university"]);
  const distinctiveWord = words.find((word) => word.length >= 6 && !genericSiteWords.has(word));
  const aliases = [hospital.name.toLowerCase(), words.slice(0, 2).join(" "), distinctiveWord];
  return aliases.some((alias) => Boolean(alias && lower.includes(alias)));
}

function hospitalContext(text: string, hospital: Hospital, hospitals: Hospital[]) {
  const sentences = text.split(/(?<=[.!?])\s+|;\s+/).filter(Boolean);
  const collected: string[] = [];
  let isCurrentHospital = false;

  for (const sentence of sentences) {
    const namedHere = hospitals.filter((candidate) => hospitalMentioned(sentence, candidate));

    if (namedHere.length) {
      isCurrentHospital = namedHere.some((candidate) => candidate.id === hospital.id);
      if (isCurrentHospital) collected.push(sentence);
      continue;
    }

    // Voice notes often add an ownership detail immediately after naming a site
    // (for example, “that one is on me”). Carry only these clear continuations
    // forward, so personal asides do not become hospital updates.
    if (isCurrentHospital && /\b(that one|on me|with me|waiting|awaiting|also|we need|i need)\b/i.test(sentence)) {
      collected.push(sentence);
    }
  }

  return collected.join(" ").trim();
}

function isExplicitlyUnrelated(text: string) {
  return /\b(ignore|unrelated|did not have a call|no call today|not about)\b/i.test(text);
}

function createHospitalSuggestions(hospital: Hospital, context: string, source: string, named: boolean): Suggestion[] {
  const lower = context.toLowerCase();
  const updates: Suggestion[] = [];
  const confidence = named ? 94 : 62;
  const stageChangeDenied = /\b(scratch that|do not|don't|not)\b.{0,42}\b(move|change|active|stage|kickoff)\b/i.test(context);
  const legalReviewPending = /\b(legal|contract)\b.{0,48}\b(review|reviewing|needs to review|pending)\b/i.test(context);

  updates.push(buildSuggestion(hospital, "lastInteraction", hospital.lastInteraction, createInteractionSummary(context, hospital), confidence, source));

  if (/\b(eaa|loi|agreement|data agreement)\b.*\b(signed|complete|approved)\b/.test(lower)) {
    const nextStep = legalReviewPending
      ? "Follow up on legal review"
      : /\b(send|share|offer)\b.{0,48}\b(times?|dates?|slots?)\b/.test(lower)
        ? "Send kickoff time options"
        : "Schedule kickoff";
    updates.push(buildSuggestion(hospital, "nextStep", hospital.nextStep, nextStep, named ? 90 : 58, source));
  } else if (!stageChangeDenied && /\bkickoff\b.*\b(scheduled|booked|confirmed)\b/.test(lower)) {
    updates.push(buildSuggestion(hospital, "stage", hospital.stage, "Kickoff", named ? 89 : 58, source));
  } else if (!stageChangeDenied && /\bpilot\b.*\b(completed|complete)\b/.test(lower)) {
    updates.push(buildSuggestion(hospital, "stage", hospital.stage, "Active", named ? 86 : 56, source, "Confirm the site has completed its pilot exit criteria before approving."));
  } else if (!stageChangeDenied && /\bpilot\b/.test(lower)) {
    updates.push(buildSuggestion(hospital, "stage", hospital.stage, "Pilot", named ? 84 : 55, source));
  }

  if (/\b(waiting on jeremy|on me,? jeremy|on me\b|with me\b|my action|i need to|we need to|our team)\b/.test(lower)) {
    updates.push(buildSuggestion(hospital, "awaiting", hospital.awaiting, "Jeremy", named ? 91 : 60, source));
  } else if (/\b(waiting on|awaiting|pending with)\b/.test(lower)) {
    updates.push(buildSuggestion(hospital, "awaiting", hospital.awaiting, "hospital", named ? 84 : 56, source));
  }

  return updates.slice(0, 3);
}

function createInteractionSummary(text: string, hospital: Hospital) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  const contactMatch = normalized.match(/\b(?:spoke|talked|phone|call(?:ed)?)\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  const contact = contactMatch?.[1]?.replace(/\b(?:uh|um|yeah)\b/gi, "").trim();
  const facts: string[] = [];

  if (/\b(eaa|data agreement)\b.{0,80}\b(signed|complete|approved)\b/.test(lower)) facts.push("EAA signed");
  else if (/\bloi\b.{0,80}\b(signed|complete|approved)\b/.test(lower)) facts.push("LOI signed");
  else if (/\bagreement\b.{0,80}\b(signed|complete|approved)\b/.test(lower)) facts.push("agreement signed");

  if (/\bkickoff\b.{0,60}\bnext week\b|\bnext week\b.{0,60}\bkickoff\b/.test(lower)) facts.push("kickoff possible next week");
  if (/\b(send|share|offer)\b.{0,48}\b(times?|dates?|slots?)\b/.test(lower)) facts.push("send time options");
  if (/\basked for options\b/.test(lower)) facts.push("asked for kickoff options");
  if (/\bdo not\b.{0,42}\b(move|change|active|stage|kickoff)\b/i.test(normalized)) facts.push("stage remains unchanged");

  const opening = contact ? `Spoke with ${contact} at ${hospital.name}` : `Update from ${hospital.name}`;
  if (facts.length) return `${opening}: ${facts.join("; ")}.`;

  return normalized
    .replace(/\b(?:um|uh|you know|sorry|quick one)\b[,.]?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
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
  if (suggestion.field === "newHospital" && suggestion.entity?.hospital) {
    if (hospitals.some((hospital) => hospital.id === suggestion.entity?.hospital?.id || hospital.name.toLowerCase() === suggestion.entity?.hospital?.name.toLowerCase())) return hospitals;
    const proposed = suggestion.entity.hospital;
    return [{
      ...proposed,
      evidence: [{ id: `${suggestion.id}-evidence`, label: suggestion.evidence, text: `Created hospital record: ${proposed.name}`, at: "2026-07-18", kind: "note" as const }],
      audit: [{ id: `${suggestion.id}-audit`, at: "2026-07-18 20:45", by: "Demo user", action: "Approved new hospital", source: suggestion.evidence }],
    }, ...hospitals];
  }

  if (suggestion.field === "newContact" && suggestion.entity?.contact) {
    const proposedContact = suggestion.entity.contact;
    return hospitals.map((hospital) => {
      if (hospital.id !== suggestion.hospitalId || hospital.contacts.some((contact) => contact.name.toLowerCase() === proposedContact.name.toLowerCase())) return hospital;
      return {
        ...hospital,
        contacts: [...hospital.contacts, proposedContact],
        audit: [{ id: `${suggestion.id}-audit`, at: "2026-07-18 20:45", by: "Demo user", action: `Approved new contact: ${proposedContact.name}`, source: suggestion.evidence }, ...hospital.audit],
      };
    });
  }

  if (suggestion.field === "contactUpdate" && suggestion.entity?.contact) {
    const proposedContact = suggestion.entity.contact;
    return hospitals.map((hospital) => {
      if (hospital.id !== suggestion.hospitalId) return hospital;
      return {
        ...hospital,
        contacts: hospital.contacts.map((contact) => contact.id === proposedContact.id ? { ...contact, ...proposedContact } : contact),
        audit: [{ id: `${suggestion.id}-audit`, at: "2026-07-18 20:45", by: "Demo user", action: `Approved contact update: ${proposedContact.name}`, source: suggestion.evidence }, ...hospital.audit],
      };
    });
  }

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

function attachApprovedNoteInteraction(hospitals: Hospital[], suggestion: Suggestion) {
  const sourceText = suggestion.sourceText;
  if (!sourceText) return hospitals;
  return hospitals.map((hospital) => {
    if (hospital.id !== suggestion.hospitalId) return hospital;
    if (hospital.evidence.some((item) => item.kind === "note" && item.text === sourceText)) return hospital;
    const interactionId = `${suggestion.id}-approved-note`;
    return {
      ...hospital,
      evidence: [
        {
          id: interactionId,
          label: "Approved Dawn AI note",
          text: sourceText,
          at: "2026-07-18",
          kind: "note" as const,
        },
        ...hospital.evidence,
      ],
      audit: [
        {
          id: `${interactionId}-audit`,
          at: "2026-07-18 20:45",
          by: "Demo user",
          action: `Attached approved Dawn AI note for ${suggestion.field} update`,
          source: suggestion.evidence,
        },
        ...hospital.audit,
      ],
    };
  });
}

function ReviewModal({
  suggestions,
  onApprove,
  onApproveAll,
  onDismiss,
  onEdit,
  onEditContactField,
  onClose,
}: {
  suggestions: Suggestion[];
  onApprove: (suggestion: Suggestion) => void;
  onApproveAll: () => void;
  onDismiss: (id: string) => void;
  onEdit: (id: string, value: string) => void;
  onEditContactField: (id: string, field: "name" | "title" | "department", value: string) => void;
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
                <span>{formatSuggestionField(suggestion.field)}</span>
              </div>
              {isEntitySuggestion(suggestion) ? (
                <EntityStoragePreview suggestion={suggestion} onContactFieldChange={onEditContactField} />
              ) : (
                <input value={suggestion.suggestedValue} onChange={(event) => onEdit(suggestion.id, event.target.value)} />
              )}
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

function priorityScoreRange(priority: Priority): [number, number] {
  switch (priority) {
    case "Very urgent": return [90, Number.POSITIVE_INFINITY];
    case "Urgent": return [78, 89.999];
    case "Very high": return [66, 77.999];
    case "High": return [57, 65.999];
    case "Med": return [34, 56.999];
    case "Low": return [Number.NEGATIVE_INFINITY, 33.999];
  }
}

function compareHospitals(a: Hospital, b: Hospital, key: SortKey, direction: SortDirection) {
  const multiplier = direction === "asc" ? 1 : -1;
  const stageOrder: Record<Stage, number> = { Interest: 0, Kickoff: 1, Pilot: 2, Active: 3 };
  const values: Record<SortKey, [string | number, string | number]> = {
    priority: [priorityScore(a), priorityScore(b)],
    hospital: [a.name, b.name],
    stage: [stageOrder[a.stage], stageOrder[b.stage]],
    nextStep: [a.nextStep, b.nextStep],
    lastInteraction: [new Date(a.lastInteractionAt).getTime(), new Date(b.lastInteractionAt).getTime()],
    awaiting: [a.awaiting === "us" ? "Jeremy" : contactAwaiting(a).name, b.awaiting === "us" ? "Jeremy" : contactAwaiting(b).name],
    country: [a.country, b.country],
  };
  const [left, right] = values[key];
  const comparison = typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right));
  return comparison * multiplier || a.name.localeCompare(b.name);
}

function priorityFor(hospital: Hospital): Priority {
  const score = priorityScore(hospital);
  if (score >= 90) return "Very urgent";
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
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Singapore",
  }).format(new Date(`${date}T12:00:00+08:00`));
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
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore",
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

function LogoutIcon() {
  return (
    <Icon>
      <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M18 12H9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}
