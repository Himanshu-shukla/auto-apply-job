"use client";

import { useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";

export function EmailApplicationPanel({ applicationId, directEmailAllowed }: { applicationId: string; directEmailAllowed: boolean }) {
  const [emails, setEmails] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const response = await fetch(`/api/applications/${applicationId}/email`);
    const data = await response.json();
    setEmails(data.emails ?? []);
    setDraft(data.emails?.[0] ?? null);
  }

  async function generate() {
    setError("");
    const response = await fetch(`/api/applications/${applicationId}/email/generate`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Email generation failed.");
      return;
    }
    await load();
  }

  async function send() {
    setError("");
    const response = await fetch(`/api/applications/${applicationId}/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: draft?.subject, body: draft?.body, manual: false })
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Email send blocked.");
    await load();
  }

  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Email Application</h2>
        <button className="btn-secondary" onClick={generate} disabled={!directEmailAllowed}>
          <Mail size={16} />
          Generate
        </button>
      </div>
      {!directEmailAllowed ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Email generation is available only for classified direct-email jobs with a recruiter email.</p> : null}
      {error ? <p className="mb-3 rounded-md bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
      {draft ? (
        <div className="space-y-3">
          <input className="field" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          <textarea className="field min-h-56" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-600">Status: {draft.status}</span>
            <button className="btn-primary" onClick={send} disabled={draft.status === "sent"}>
              <Send size={16} />
              Send Approved
            </button>
          </div>
        </div>
      ) : emails.length ? null : <p className="text-sm text-slate-600">No email draft yet.</p>}
    </div>
  );
}
