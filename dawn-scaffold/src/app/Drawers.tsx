"use client";

import { useState } from "react";
import type { Awaiting, Contact, ContactTitle, DawnSettings, Hospital, Stage, StoredFile } from "./DawnApp";
import { contactTitles, nextStepOptions, stages, stageSubstages } from "./DawnApp";

export function HospitalDetail({ hospital, onSave }: { hospital: Hospital; onSave: (hospital: Hospital) => void }) {
  const [draft, setDraft] = useState(hospital);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [isCustomNextStep, setCustomNextStep] = useState(!nextStepOptions.includes(hospital.nextStep));
  const [activeTab, setActiveTab] = useState<"fields" | "contacts" | "interactions" | "audit" | "history">("fields");

  function updateField<K extends keyof Hospital>(field: K, value: Hospital[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateContact(id: string, field: keyof Contact, value: string) {
    setDraft((current) => ({
      ...current,
      contacts: current.contacts.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact,
      ),
    }));
  }

  function updateStage(stage: Stage) {
    setDraft((current) => ({
      ...current,
      stage,
      substage: stageSubstages[stage][0],
    }));
  }

  function updateAwaiting(value: string) {
    setDraft((current) =>
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
    setDraft((current) => ({
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

  return (
    <div className="drawer-stack">
      <div className="hospital-tabs" role="tablist" aria-label="Hospital details">
        {[
          ["fields", "Fields"],
          ["contacts", "Contacts"],
          ["interactions", "Interactions"],
          ["audit", "Audit trail"],
          ["history", "Stage history"],
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

      {activeTab === "fields" ? <section className="form-section">
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
            {stageSubstages[draft.stage].map((substage) => (
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
              {nextStepOptions.map((nextStep) => (
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
          <span>Last interaction</span>
          <input value={draft.lastInteraction} onChange={(event) => updateField("lastInteraction", event.target.value)} />
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
      </section> : null}

      {activeTab === "contacts" ? <section className="form-section">
        <div className="section-title-row">
          <h3>Contacts</h3>
          <button className="mini-action" onClick={addContact}>
            Add contact
          </button>
        </div>
        {draft.contacts.map((contact) => (
          <div className="contact-card" key={contact.id}>
            <button
              className="contact-summary"
              type="button"
              onClick={() => setExpandedContactId((current) => current === contact.id ? null : contact.id)}
              aria-expanded={expandedContactId === contact.id}
            >
              <span>{contact.name || "Unnamed contact"}</span>
              <small>{contact.title}</small>
            </button>
            {expandedContactId === contact.id ? (
              <div className="contact-details">
                <label>
                  <span>Name</span>
                  <input value={contact.name} onChange={(event) => updateContact(contact.id, "name", event.target.value)} />
                </label>
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
              </div>
            ) : null}
          </div>
        ))}
      </section> : null}

      {activeTab === "interactions" ? <section>
        <h3>Interactions</h3>
        {draft.evidence.map((item) => (
          <div className="detail-row" key={item.id}>
            <b>{item.label}</b>
            <span>{item.text}</span>
            <small>{item.at}</small>
          </div>
        ))}
      </section> : null}

      {activeTab === "audit" ? <section>
        <h3>Audit trail</h3>
        {draft.audit.map((entry) => (
          <div className="detail-row" key={entry.id}>
            <b>{entry.action}</b>
            <span>{entry.source}</span>
            <small>
              {entry.by} - {entry.at}
            </small>
          </div>
        ))}
      </section> : null}

      {activeTab === "history" ? <section>
        <h3>Stage history</h3>
        {draft.stageHistory.map((item) => (
          <p className="history-line" key={item}>
            {item}
          </p>
        ))}
      </section> : null}

      <div className="sticky-save">
        <button className="primary-action" onClick={() => onSave(draft)}>
          Save changes
        </button>
      </div>
    </div>
  );
}

export function SettingsDrawer({ settings, onSave }: { settings: DawnSettings; onSave: (settings: DawnSettings) => void }) {
  const [draft, setDraft] = useState(settings);

  function updateLabel(field: keyof DawnSettings["fieldLabels"], value: string) {
    setDraft((current) => ({
      ...current,
      fieldLabels: { ...current.fieldLabels, [field]: value },
    }));
  }

  function updateSubstage(stage: Stage, value: string) {
    setDraft((current) => ({
      ...current,
      substageLabels: { ...current.substageLabels, [stage]: value },
    }));
  }

  return (
    <div className="drawer-stack">
      <section className="form-section">
        <h3>Hospital database columns</h3>
        {Object.entries(draft.fieldLabels).map(([field, label]) => (
          <label key={field}>
            <span>{field}</span>
            <input value={label} onChange={(event) => updateLabel(field as keyof DawnSettings["fieldLabels"], event.target.value)} />
          </label>
        ))}
      </section>

      <section className="form-section">
        <h3>Stage substages</h3>
        {stages.map((stage) => (
          <label key={stage}>
            <span>{stage}</span>
            <input value={draft.substageLabels[stage]} onChange={(event) => updateSubstage(stage, event.target.value)} />
          </label>
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
        <h3>Status timing</h3>
        <p>Waiting on us is urgent first. Stage timing then controls how quickly a site cools.</p>
      </section>

      <div className="sticky-save">
        <button className="primary-action" onClick={() => onSave(draft)}>
          Save settings
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

export function NewHospitalDrawer({ onCreate }: { onCreate: (hospital: Hospital) => void }) {
  const [draft, setDraft] = useState<Hospital>(() => {
    const id = `h${Date.now()}`;
    return {
      id,
      name: "New hospital site",
      stage: "Interest",
      substage: "Agreements sent",
      nextStep: "Add first real next step",
      lastInteractionAt: "2026-07-18",
      lastInteraction: "Manual hospital created",
      awaiting: "us",
      priorityAdjustment: 0,
      country: "Singapore",
      awaitingContactId: `${id}-c1`,
      notes: "Needs first activation note",
      contacts: [
        {
          id: `${id}-c1`,
          name: "",
          email: "",
          department: "",
          title: "Clinical Research Coordinator (CRC)",
        },
      ],
      evidence: [
        {
          id: `${id}-e1`,
          label: "Manual hospital created",
          text: "Created from the new-org rail.",
          at: "2026-07-18",
        },
      ],
      audit: [],
      stageHistory: ["Interest: created manually on 18 Jul"],
    };
  });
  const [isCustomNextStep, setCustomNextStep] = useState(!nextStepOptions.includes(draft.nextStep));

  function updateField<K extends keyof Hospital>(field: K, value: Hospital[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateStage(stage: Stage) {
    setDraft((current) => ({
      ...current,
      stage,
      substage: stageSubstages[stage][0],
    }));
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
      <section className="form-section">
        <h3>New org</h3>
        <p>Manual fallback for when there is no note, voice, email, or file to parse.</p>
        <label>
          <span>Hospital</span>
          <input value={draft.name} onChange={(event) => updateField("name", event.target.value)} />
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
            {stageSubstages[draft.stage].map((substage) => (
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
              {nextStepOptions.map((nextStep) => (
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
      </section>

      <div className="sticky-save">
        <button className="primary-action" onClick={() => onCreate(draft)}>
          Save hospital
        </button>
      </div>
    </div>
  );
}

export function FileStorageDrawer({ files }: { files: StoredFile[] }) {
  return (
    <div className="drawer-stack">
      {files.length ? (
        files.map((file) => (
          <section className="detail-row" key={file.id}>
            <b>{file.name}</b>
            <span>{file.hospitalName}</span>
            <small>{formatFileSize(file.size)} · {file.type}</small>
            <small>{file.uploadedAt}</small>
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
