"use client";

import { useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ApprovalBadge } from "@/components/Phase3Badges";

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const response = await fetch("/api/followups/due");
    setFollowUps((await response.json()).followUps ?? []);
  }

  async function generate(id: string) {
    setError("");
    const response = await fetch(`/api/followups/${id}/generate`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Could not generate follow-up.");
    await load();
  }

  async function send(id: string) {
    setError("");
    const response = await fetch(`/api/followups/${id}/send`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Could not send follow-up.");
    await load();
  }

  return (
    <>
      <PageHeader title="Follow-Ups" subtitle="Due reminders and reviewed follow-up emails for direct-email applications." />
      {error ? <p className="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      <div className="space-y-4">
        {followUps.length ? followUps.map((item) => (
          <article key={item.id} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">{item.application.job.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{item.application.job.company} · due {item.dueDate.slice(0, 10)}</p>
              </div>
              <ApprovalBadge value={item.status} />
            </div>
            {item.body ? <p className="mt-4 whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm text-slate-600">{item.body}</p> : null}
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary" onClick={() => generate(item.id)}>
                <Mail size={16} />
                Generate
              </button>
              <button className="btn-primary" onClick={() => send(item.id)} disabled={!item.body}>
                <Send size={16} />
                Send
              </button>
            </div>
          </article>
        )) : <div className="panel p-8 text-center text-sm text-slate-600">No follow-ups are due.</div>}
      </div>
    </>
  );
}
