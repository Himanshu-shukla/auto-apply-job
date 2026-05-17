"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Send, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ApprovalBadge, AutomationBadge, PolicyBadge } from "@/components/Phase3Badges";
import { ScoreBadge } from "@/components/ScoreBadge";

export default function ApprovalQueuePage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const response = await fetch("/api/approval-queue");
    setItems((await response.json()).items ?? []);
  }

  async function approve(id: string) {
    await fetch(`/api/approval-queue/${id}/approve`, { method: "POST" });
    await load();
  }

  async function reject(id: string) {
    await fetch(`/api/approval-queue/${id}/reject`, { method: "POST" });
    await load();
  }

  async function send(applicationId: string) {
    setError("");
    const response = await fetch(`/api/applications/${applicationId}/email/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Send blocked.");
    await load();
  }

  return (
    <>
      <PageHeader title="Approval Queue" subtitle="Review generated applications before any email or application action is sent." />
      {error ? <p className="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      <div className="space-y-4">
        {items.length ? items.map((item) => (
          <article key={item.id} className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link href={`/jobs/${item.job.id}`} className="text-lg font-semibold text-ink hover:text-teal-700">
                  {item.job.title}
                </Link>
                <p className="mt-1 text-sm text-slate-600">{item.job.company} · {item.job.location}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ScoreBadge score={item.job.matches?.[0]?.overallScore} />
                <PolicyBadge value={item.job.sourceType} />
                <AutomationBadge value={item.job.automationLevel} />
                <ApprovalBadge value={item.status} />
              </div>
            </div>
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Recommended:</strong> {String(item.recommendedAction).replaceAll("_", " ")}
              {item.riskWarnings?.length ? <div className="mt-2">{item.riskWarnings.join(" ")}</div> : null}
            </div>
            {item.generatedPayload?.subject ? (
              <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm">
                <div className="font-semibold text-ink">{item.generatedPayload.subject}</div>
                <p className="mt-2 whitespace-pre-wrap text-slate-600">{item.generatedPayload.body}</p>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => approve(item.id)} disabled={item.status !== "pending_review"}>
                <Check size={16} />
                Approve
              </button>
              <button className="btn-secondary" onClick={() => reject(item.id)} disabled={item.status === "rejected"}>
                <X size={16} />
                Reject
              </button>
              {item.applicationId ? (
                <button className="btn-secondary" onClick={() => send(item.applicationId)} disabled={item.status !== "approved"}>
                  <Send size={16} />
                  Send Approved Email
                </button>
              ) : null}
            </div>
          </article>
        )) : (
          <div className="panel p-8 text-center text-sm text-slate-600">No applications need approval.</div>
        )}
      </div>
    </>
  );
}
