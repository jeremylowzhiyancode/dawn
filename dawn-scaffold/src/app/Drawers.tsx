"use client";

import { useState } from "react";
import type { Awaiting, Contact, ContactTitle, DawnSettings, Hospital, Stage, StoredFile } from "./DawnApp";
import { contactTitles, nextStepOptions, stages } from "./DawnApp";

function nextStepsFor(stage: Stage, substage: string) {
  const nextStepBySubstage: Record<string, string> = {
    "Interest:Agreements sent": "Send polite reminder",
    "Interest:LOI signed": "Send EAA packet",
    "Interest:EAA signed": "Schedule kickoff",
    "Kickoff:Kickoff invited": "Schedule kickoff",
    "Kickoff:Kickoff scheduled": "Prepare kickoff deck",
    "Kickoff:Kickoff completed": "Confirm pilot readiness",
    "Pilot:Pilot initiated": "Check feasibility completion",
    "Pilot:Pilot completed": "Collect usage feedback",
    "Active:1 month check-in": "Schedule monthly check-in",
    "Active:2 month check-in": "Schedule monthly check-in",
    "Active:3 month check-in": "Schedule monthly check-in",
  };
  return [nextStepBySubstage[`${stage}:${substage}`] ?? "Review next step", "Other, please specify"];
}

function TrashIcon() {
  return (
    <svg className="trash-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V4.8h6V7" />
      <path d="M6.7 7l.8 12.2c.1.9.8 1.6 1.7 1.6h5.6c.9 0 1.6-.7 1.7-1.6L17.3 7" />
      <path d="M10 11v5.8M14 11v5.8" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="download-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HospitalDetail({ hospital, onSave, onDelete, canUndo, onUndo, substageOptions }: { hospital: Hospital; onSave: (hospital: Hospital) => void; onDelete: (id: string) => void; canUndo: boolean; onUndo: () => void; substageOptions: Record<Stage, string[]> }) {
  const [draft, setDraft] = useState(hospital);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [isCustomNextStep, setCustomNextStep] = useState(!nextStepOptions.includes(hospital.nextStep));
  const [activeTab, setActiveTab] = useState<"details" | "contacts" | "activity">("details");
  const [draftUndo, setDraftUndo] = useState<Hospital[]>([]);
  const [isAddingInteraction, setAddingInteraction] = useState(false);
  const [interactionText, setInteractionText] = useState("");
  const [interactionTitle, setInteractionTitle] = useState("");
  const [interactionDate, setInteractionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expandedInteractionId, setExpandedInteractionId] = useState<string | null>(null);

  function updateDraft(updater: (current: Hospital) => Hospital) {
    setDraft((current) => {
      setDraftUndo((history) => [...history.slice(-9), current]);
      return updater(current);
    });
  }

  function undoDraftChange() {
    setDraftUndo((history) => {
      const previous = history.at(-1);
      if (previous) setDraft(previous);
      return history.slice(0, -1);
    });
  }

  function updateField<K extends keyof Hospital>(field: K, value: Hospital[K]) {
    updateDraft((current) => ({ ...current, [field]: value }));
  }

  function updateContact(id: string, field: keyof Contact, value: string) {
    updateDraft((current) => ({
      ...current,
      contacts: current.contacts.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact,
      ),
    }));
  }

  function updateStage(stage: Stage) {
    updateDraft((current) => ({
      ...current,
      stage,
      substage: substageOptions[stage][0],
    }));
  }

  function updateAwaiting(value: string) {
    updateDraft((current) =>
      value === "jeremy"
        ? { ...current, awaiting: "us" }
        : { ...current, awaiting: "hospital", awaitingContactId: value },
    );
  }

  function selectNextStep(value: string) {
    if (value === "Other, please specify") {
      setCustomNextStep(true);
      if (nextStepOptions.includes(draft.nextStep)) updateField("nextStep", "");
      return;
    }
    setCustomNextStep(false);
    updateField("nextStep", value);
  }

  function addContact() {
    updateDraft((current) => ({
      ...current,
      contacts: [
        ...current.contacts,
        {
          id: `contact-${Date.now()}`,
          name: "",
          email: "",
          department: "",
          title: "Clinical Research Coordinator (CRC)",
        },
      ],
    }));
  }

  function deleteContact(id: string) {
    const contact = draft.contacts.find((item) => item.id === id);
    if (!contact || !window.confirm(`Delete ${contact.name || "this contact"}?`)) return;
    updateDraft((current) => ({
      ...current,
      contacts: current.contacts.filter((item) => item.id !== id),
      ...(current.awaitingContactId === id ? { awaiting: "us", awaitingContactId: "" } : {}),
    }));
    setExpandedContactId((current) => (current === id ? null : current));
  }

  function addInteraction() {
    const text = interactionText.trim();
    if (!text) return;
    updateDraft((current) => ({
      ...current,
      evidence: [{ id: `manual-${Date.now()}`, label: interactionTitle.trim() || "Manual update", text, at: interactionDate, kind: "note" }, ...current.evidence],
    }));
    setInteractionText("");
    setInteractionTitle("");
    setAddingInteraction(false);
  }

  function updateInteraction(id: string, field: "label" | "text" | "at", value: string) {
    updateDraft((current) => ({
      ...current,
      evidence: current.evidence.map((item) => item.id === id ? { ...item, [field]: value } : item),
    }));
  }

  function deleteInteraction(id: string) {
    if (!window.confirm("Delete this interaction?")) return;
    updateDraft((current) => ({ ...current, evidence: current.evidence.filter((item) => item.id !== id) }));
    setExpandedInteractionId((current) => current === id ? null : current);
  }

  return (
    <div className="drawer-stack">
      <div className="hospital-tabs" role="tablist" aria-label="Hospital details">
        {[
          ["details", "Details"],
          ["contacts", "Contacts"],
          ["activity", "Log"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={activeTab === id ? "active" : ""}
            onClick={() => setActiveTab(id as typeof activeTab)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "details" ? <>
      <section className="form-section">
        <label>
          <span>Stage</span>
          <select value={draft.stage} onChange={(event) => updateStage(event.target.value as Stage)}>
            {stages.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Substage</span>
          <select value={draft.substage} onChange={(event) => updateField("substage", event.target.value)}>
            {substageOptions[draft.stage].map((substage) => (
              <option key={substage}>{substage}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Next step</span>
          {isCustomNextStep ? (
            <input
              autoFocus
              value={draft.nextStep}
              onChange={(event) => updateField("nextStep", event.target.value)}
              placeholder="Type the next step"
              aria-label="Custom next step"
            />
          ) : (
            <select value={draft.nextStep} onChange={(event) => selectNextStep(event.target.value)}>
              {nextStepsFor(draft.stage, draft.substage).map((nextStep) => (
                <option key={nextStep}>{nextStep}</option>
              ))}
            </select>
          )}
        </label>
        <label>
          <span>Last interaction date</span>
          <input type="date" value={draft.lastInteractionAt} onChange={(event) => updateField("lastInteractionAt", event.target.value)} />
        </label>
        <label>
          <span>Awaiting who?</span>
          <select value={draft.awaiting === "us" ? "jeremy" : draft.awaitingContactId} onChange={(event) => updateAwaiting(event.target.value)}>
            <option value="jeremy">Jeremy</option>
            {draft.contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>{contact.name || "Unnamed contact"} · {contact.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Notes</span>
          <textarea value={draft.notes} onChange={(event) => updateField("notes", event.target.value)} />
        </label>
      </section>

      <section className="interactions-section">
        <div className="section-title-row">
          <h3>Interactions</h3>
          <button className="mini-action plus-action" type="button" aria-label="Add interaction" title="Add interaction" onClick={() => setAddingInteraction((current) => !current)}>
            +
          </button>
        </div>
        {isAddingInteraction ? <div className="manual-interaction">
          <input value={interactionTitle} placeholder="Title" onChange={(event) => setInteractionTitle(event.target.value)} />
          <input type="date" value={interactionDate} onChange={(event) => setInteractionDate(event.target.value)} />
          <textarea autoFocus value={interactionText} placeholder="Add an update" onChange={(event) => setInteractionText(event.target.value)} />
          <button className="mini-action" type="button" onClick={addInteraction}>Add update</button>
        </div> : null}
        {draft.evidence.map((item) => (
          <div className="interaction-card" key={item.id}>
            <button
              className="interaction-summary"
              type="button"
              onClick={() => setExpandedInteractionId((current) => current === item.id ? null : item.id)}
              aria-expanded={expandedInteractionId === item.id}
            >
              {item.label}
            </button>
            <button className="interaction-delete" type="button" aria-label={`Delete ${item.label}`} title="Delete interaction" onClick={() => deleteInteraction(item.id)}><TrashIcon /></button>
            {expandedInteractionId === item.id ? <div className="interaction-details">
              <label><span>Title</span><input value={item.label} onChange={(event) => updateInteraction(item.id, "label", event.target.value)} /></label>
              <label><span>Date</span><input type="date" value={item.at} onChange={(event) => updateInteraction(item.id, "at", event.target.value)} /></label>
              <label><span>Interaction</span><textarea value={item.text} onChange={(event) => updateInteraction(item.id, "text", event.target.value)} /></label>
            </div> : null}
          </div>
        ))}
      </section>
      </> : null}

      {activeTab === "contacts" ? <section className="form-section">
        <div className="section-title-row">
          <button className="mini-action plus-action" type="button" aria-label="Add contact" title="Add contact" onClick={addContact}>+</button>
        </div>
        {draft.contacts.map((contact) => (
          <div className="contact-card" key={contact.id}>
            <div className="contact-summary">
              <input value={contact.name} placeholder="Contact name" onFocus={() => setExpandedContactId(contact.id)} onChange={(event) => updateContact(contact.id, "name", event.target.value)} />
              <button className="contact-expand" type="button" onClick={() => setExpandedContactId((current) => current === contact.id ? null : contact.id)} aria-expanded={expandedContactId === contact.id}>
                <small>{contact.title}</small>
              </button>
            </div>
            {expandedContactId === contact.id ? (
              <div className="contact-details">
                <label>
                  <span>Email</span>
                  <input type="email" value={contact.email} onChange={(event) => updateContact(contact.id, "email", event.target.value)} />
                </label>
                <label>
                  <span>Department</span>
                  <input value={contact.department} onChange={(event) => updateContact(contact.id, "department", event.target.value)} />
                </label>
                <label>
                  <span>Title</span>
                  <select value={contact.title} onChange={(event) => updateContact(contact.id, "title", event.target.value as ContactTitle)}>
                    {contactTitles.map((title) => (
                      <option key={title}>{title}</option>
                    ))}
                  </select>
                </label>
                <button className="text-danger-action trash-action" type="button" aria-label={`Delete ${contact.name || "contact"}`} title="Delete contact" onClick={() => deleteContact(contact.id)}><TrashIcon /></button>
              </div>
            ) : null}
          </div>
        ))}
      </section> : null}

      {activeTab === "activity" ? <section>
        {draft.audit.map((entry) => (
          <div className="detail-row" key={entry.id}>
            <b>{entry.action}</b>
            <span>{entry.source}</span>
            <small>
              {entry.by} - {entry.at}
            </small>
          </div>
        ))}
        <h3 className="activity-subheading">Stage history</h3>
        {draft.stageHistory.map((item) => (
          <p className="history-line" key={item}>
            {item}
          </p>
        ))}
      </section> : null}

      {activeTab === "details" || activeTab === "contacts" ? <div className="sticky-save">
        {draftUndo.length ? <button className="secondary-action" type="button" onClick={undoDraftChange}>Undo edit</button> : null}
        {!draftUndo.length && canUndo ? <button className="secondary-action" type="button" onClick={onUndo}>Undo last change</button> : null}
        <button
          className="text-danger-action trash-action"
          type="button"
          aria-label={`Delete ${hospital.name}`}
          title="Delete hospital"
          onClick={() => {
            if (window.confirm(`Delete ${hospital.name}? This cannot be undone.`)) onDelete(hospital.id);
          }}
        >
          <TrashIcon />
        </button>
        <button className="primary-action" onClick={() => onSave(draft)}>
          Save
        </button>
      </div> : null}
    </div>
  );
}

export function SettingsDrawer({ settings, onSave }: { settings: DawnSettings; onSave: (settings: DawnSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  const columnNames: Record<keyof DawnSettings["fieldLabels"], string> = {
    priority: "Priority",
    hospital: "Hospital",
    stage: "Stage",
    nextStep: "Next step",
    lastInteraction: "Last interaction",
    awaiting: "Awaiting",
  };

  function updateLabel(field: keyof DawnSettings["fieldLabels"], value: string) {
    setDraft((current) => ({
      ...current,
      fieldLabels: { ...current.fieldLabels, [field]: value },
    }));
  }

  function updateSubstage(stage: Stage, index: number, value: string) {
    setDraft((current) => ({
      ...current,
      substageOptions: {
        ...current.substageOptions,
        [stage]: current.substageOptions[stage].map((substage, currentIndex) => currentIndex === index ? value : substage),
      },
    }));
  }

  function addSubstage(stage: Stage) {
    setDraft((current) => ({
      ...current,
      substageOptions: { ...current.substageOptions, [stage]: [...current.substageOptions[stage], "New substage"] },
    }));
  }

  function removeSubstage(stage: Stage, index: number) {
    setDraft((current) => ({
      ...current,
      substageOptions: {
        ...current.substageOptions,
        [stage]: current.substageOptions[stage].filter((_, currentIndex) => currentIndex !== index),
      },
    }));
  }

  return (
    <div className="drawer-stack">
      <section className="form-section">
        <h3>Dashboard column names</h3>
        <p>Rename the labels people see on the dashboard. The underlying fields stay the same.</p>
        {Object.entries(draft.fieldLabels).map(([field, label]) => (
          <label key={field}>
            <span>{columnNames[field as keyof DawnSettings["fieldLabels"]]}</span>
            <input value={label} onChange={(event) => updateLabel(field as keyof DawnSettings["fieldLabels"], event.target.value)} />
          </label>
        ))}
      </section>

      <section className="form-section">
        <h3>Stages and substages</h3>
        <p>These are the choices available when editing a hospital. Add or rename substages below.</p>
        {stages.map((stage) => (
          <div className="settings-stage" key={stage}>
            <h4>{stage}</h4>
            <div className="substage-list">
              {draft.substageOptions[stage].map((substage, index) => (
                <div className="substage-row" key={`${stage}-${index}`}>
                  <input aria-label={`${stage} substage ${index + 1}`} value={substage} onChange={(event) => updateSubstage(stage, index, event.target.value)} />
                  <button className="substage-remove" type="button" aria-label={`Remove ${substage}`} title="Remove substage" disabled={draft.substageOptions[stage].length === 1} onClick={() => removeSubstage(stage, index)}>×</button>
                </div>
              ))}
            </div>
            <button className="mini-action settings-add" type="button" onClick={() => addSubstage(stage)}>+ Add substage</button>
          </div>
        ))}
      </section>

      <section className="form-section">
        <h3>AI mode</h3>
        <label>
          <span>Model mode</span>
          <input value={draft.aiModel} readOnly />
        </label>
        <p>Dawn currently uses local demo logic, so testing is free and does not require an API key or payment method.</p>
        <label>
          <span>System prompt</span>
          <textarea value={draft.systemPrompt} onChange={(event) => setDraft((current) => ({ ...current, systemPrompt: event.target.value }))} />
        </label>
      </section>

      <section>
        <h3>Priority logic</h3>
        <p>Dawn prioritises work waiting on you first, then considers stage timing and the last interaction. Use the arrows on a hospital to apply your own judgement.</p>
      </section>

      <div className="sticky-save">
        <button className="primary-action" onClick={() => onSave(draft)}>
          Save
        </button>
      </div>
    </div>
  );
}

export function AuditDrawer({ hospitals }: { hospitals: Hospital[] }) {
  const audit = hospitals.flatMap((hospital) => hospital.audit.map((entry) => ({ ...entry, hospital: hospital.name }))).slice(0, 30);

  return (
    <div className="drawer-stack">
      {audit.map((entry) => (
        <section className="detail-row" key={entry.id}>
          <b>{entry.hospital}</b>
          <span>{entry.action}</span>
          <small>
            {entry.by} - {entry.at}
          </small>
        </section>
      ))}
    </div>
  );
}

export function NewHospitalDrawer({ onCreate, substageOptions }: { onCreate: (hospital: Hospital) => void; substageOptions: Record<Stage, string[]> }) {
  const [draft, setDraft] = useState<Hospital>(() => {
    const id = `h${Date.now()}`;
    return {
      id,
      name: "",
      stage: "Interest",
      substage: "Agreements sent",
      nextStep: "",
      lastInteractionAt: "2026-07-18",
      lastInteraction: "",
      awaiting: "us",
      priorityAdjustment: 0,
      country: "Singapore",
      awaitingContactId: `${id}-c1`,
      notes: "",
      contacts: [
        {
          id: `${id}-c1`,
          name: "",
          email: "",
          department: "",
          title: "Clinical Research Coordinator (CRC)",
        },
      ],
      evidence: [],
      audit: [],
      stageHistory: [],
    };
  });
  const [isCustomNextStep, setCustomNextStep] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "contacts">("details");
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [isAddingInteraction, setAddingInteraction] = useState(false);
  const [interactionText, setInteractionText] = useState("");
  const [interactionTitle, setInteractionTitle] = useState("");
  const [interactionDate, setInteractionDate] = useState(() => new Date().toISOString().slice(0, 10));

  function updateField<K extends keyof Hospital>(field: K, value: Hospital[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateStage(stage: Stage) {
    setDraft((current) => ({
      ...current,
      stage,
      substage: substageOptions[stage][0],
    }));
  }

  function updateContact(id: string, field: keyof Contact, value: string) {
    setDraft((current) => ({
      ...current,
      contacts: current.contacts.map((contact) => contact.id === id ? { ...contact, [field]: value } : contact),
    }));
  }

  function addContact() {
    setDraft((current) => ({
      ...current,
      contacts: [...current.contacts, { id: `contact-${Date.now()}`, name: "", email: "", department: "", title: "Clinical Research Coordinator (CRC)" }],
    }));
  }

  function addInteraction() {
    const text = interactionText.trim();
    if (!text) return;
    setDraft((current) => ({
      ...current,
      evidence: [{ id: `manual-${Date.now()}`, label: interactionTitle.trim() || "Manual update", text, at: interactionDate, kind: "note" }, ...current.evidence],
    }));
    setInteractionText("");
    setInteractionTitle("");
    setAddingInteraction(false);
  }

  function selectNextStep(value: string) {
    if (value === "Other, please specify") {
      setCustomNextStep(true);
      if (nextStepOptions.includes(draft.nextStep)) updateField("nextStep", "");
      return;
    }
    setCustomNextStep(false);
    updateField("nextStep", value);
  }

  function updateAwaiting(value: string) {
    setDraft((current) =>
      value === "jeremy"
        ? { ...current, awaiting: "us" }
        : { ...current, awaiting: "hospital", awaitingContactId: value },
    );
  }

  return (
    <div className="drawer-stack">
      <div className="hospital-tabs" role="tablist" aria-label="New hospital details">
        {["details", "contacts"].map((tab) => (
          <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab as typeof activeTab)}>
            {tab === "details" ? "Details" : "Contacts"}
          </button>
        ))}
      </div>

      {activeTab === "details" ? <section className="form-section">
        <label>
          <span>Hospital name</span>
          <input autoFocus value={draft.name} placeholder="Hospital name" onChange={(event) => updateField("name", event.target.value)} />
        </label>
        <label>
          <span>Stage</span>
          <select value={draft.stage} onChange={(event) => updateStage(event.target.value as Stage)}>
            {stages.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Substage</span>
          <select value={draft.substage} onChange={(event) => updateField("substage", event.target.value)}>
            {substageOptions[draft.stage].map((substage) => (
              <option key={substage}>{substage}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Next step</span>
          {isCustomNextStep ? (
            <input
              autoFocus
              value={draft.nextStep}
              onChange={(event) => updateField("nextStep", event.target.value)}
              placeholder="Type the next step"
              aria-label="Custom next step"
            />
          ) : (
            <select value={draft.nextStep} onChange={(event) => selectNextStep(event.target.value)}>
              <option value="" disabled>Select next step</option>
              {nextStepsFor(draft.stage, draft.substage).map((nextStep) => (
                <option key={nextStep}>{nextStep}</option>
              ))}
            </select>
          )}
        </label>
        <label>
          <span>Last interaction date</span>
          <input type="date" value={draft.lastInteractionAt} onChange={(event) => updateField("lastInteractionAt", event.target.value)} />
        </label>
        <label>
          <span>Awaiting who?</span>
          <select value={draft.awaiting === "us" ? "jeremy" : draft.awaitingContactId} onChange={(event) => updateAwaiting(event.target.value)}>
            <option value="jeremy">Jeremy</option>
            {draft.contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>{contact.name || "Unnamed contact"} · {contact.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Notes</span>
          <textarea value={draft.notes} placeholder="Add a note" onChange={(event) => updateField("notes", event.target.value)} />
        </label>
        {false ? (
          <label>
            <span>Hospital contact</span>
            <select value={draft.awaitingContactId} onChange={(event) => updateField("awaitingContactId", event.target.value)}>
              {draft.contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.name || "Unnamed contact"} · {contact.title}</option>
              ))}
            </select>
          </label>
        ) : null}
      </section> : null}

      {activeTab === "details" ? <section className="interactions-section">
        <div className="section-title-row">
          <h3>Interactions</h3>
          <button className="mini-action plus-action" type="button" aria-label="Add interaction" title="Add interaction" onClick={() => setAddingInteraction((current) => !current)}>+</button>
        </div>
        {isAddingInteraction ? <div className="manual-interaction">
          <input value={interactionTitle} placeholder="Title" onChange={(event) => setInteractionTitle(event.target.value)} />
          <input type="date" value={interactionDate} onChange={(event) => setInteractionDate(event.target.value)} />
          <textarea autoFocus value={interactionText} placeholder="Add an update" onChange={(event) => setInteractionText(event.target.value)} />
          <button className="mini-action" type="button" onClick={addInteraction}>Add update</button>
        </div> : null}
        {draft.evidence.map((item) => <div className="detail-row" key={item.id}><b>{item.label}</b><span>{item.text}</span><small>{item.at}</small></div>)}
      </section> : null}

      {activeTab === "contacts" ? <section className="form-section">
        <div className="section-title-row">
          <button className="mini-action plus-action" type="button" aria-label="Add contact" title="Add contact" onClick={addContact}>+</button>
        </div>
        {draft.contacts.map((contact) => (
          <div className="contact-card" key={contact.id}>
            <div className="contact-summary">
              <input value={contact.name} placeholder="Contact name" onFocus={() => setExpandedContactId(contact.id)} onChange={(event) => updateContact(contact.id, "name", event.target.value)} />
              <button className="contact-expand" type="button" onClick={() => setExpandedContactId((current) => current === contact.id ? null : contact.id)} aria-expanded={expandedContactId === contact.id}><small>{contact.title}</small></button>
            </div>
            {expandedContactId === contact.id ? <div className="contact-details">
              <label><span>Email</span><input type="email" value={contact.email} placeholder="Email" onChange={(event) => updateContact(contact.id, "email", event.target.value)} /></label>
              <label><span>Department</span><input value={contact.department} placeholder="Department" onChange={(event) => updateContact(contact.id, "department", event.target.value)} /></label>
              <label><span>Title</span><select value={contact.title} onChange={(event) => updateContact(contact.id, "title", event.target.value as ContactTitle)}>{contactTitles.map((title) => <option key={title}>{title}</option>)}</select></label>
            </div> : null}
          </div>
        ))}
      </section> : null}

      <div className="sticky-save">
        <button className="primary-action" onClick={() => onCreate(draft)}>
          Save hospital
        </button>
      </div>
    </div>
  );
}

export function FileStorageDrawer({ files, onDownload, onDownloadAll, onDelete }: { files: StoredFile[]; onDownload: (file: StoredFile) => void; onDownloadAll: () => void; onDelete: (id: string) => void }) {
  return (
    <div className="drawer-stack">
      {files.length ? <button className="primary-action file-archive-action" type="button" onClick={onDownloadAll}>Download all files (.zip)</button> : null}
      {files.length ? (
        files.map((file) => (
          <section className="detail-row" key={file.id}>
            <b>{file.name}</b>
            <span>{file.hospitalName}</span>
            <small>{formatFileSize(file.size)} · {file.type}</small>
            <small>{file.uploadedAt}</small>
            <div className="file-actions">
              <button className="file-icon-action" type="button" aria-label={`Download ${file.name}`} title="Download" onClick={() => onDownload(file)}><DownloadIcon /></button>
              <button className="file-icon-action delete" type="button" aria-label={`Delete ${file.name}`} title="Delete" onClick={() => onDelete(file.id)}><TrashIcon /></button>
            </div>
          </section>
        ))
      ) : (
        <section className="detail-row">
          <b>No uploaded files yet</b>
          <span>Files sent through Dawn AI will appear here automatically.</span>
        </section>
      )}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
