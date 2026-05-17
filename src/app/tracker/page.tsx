"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ScoreBadge } from "@/components/ScoreBadge";
import { PolicyBadge } from "@/components/Phase3Badges";

const columns = [
  ["SAVED", "Saved"],
  ["READY_TO_APPLY", "Ready to Apply"],
  ["APPLIED", "Applied"],
  ["INTERVIEW", "Interview"],
  ["OFFER", "Offer"],
  ["REJECTED", "Rejected"]
];

export default function TrackerPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    loadTracker();
  }, []);

  async function loadTracker() {
    const response = await fetch("/api/tracker");
    const data = await response.json();
    setApplications(data.applications ?? []);
  }

  async function patchApplication(id: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/tracker/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (response.ok) {
      setApplications((current) => current.map((app) => (app.id === id ? data.application : app)));
    }
  }

  const grouped = useMemo(() => {
    return Object.fromEntries(columns.map(([status]) => [status, applications.filter((app) => app.status === status)]));
  }, [applications]);

  return (
    <>
      <PageHeader title="Tracker" subtitle="Move jobs through the application pipeline, store notes, and preserve status history." />
      <div className="grid min-h-[70vh] gap-4 xl:grid-cols-6">
        {columns.map(([status, label]) => (
          <section
            key={status}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragging) patchApplication(dragging, { status, markApplied: status === "APPLIED" });
              setDragging(null);
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">{label}</h2>
              <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-500">{grouped[status]?.length ?? 0}</span>
            </div>
            <div className="space-y-3">
              {grouped[status]?.map((application: any) => (
                <article
                  key={application.id}
                  draggable
                  onDragStart={() => setDragging(application.id)}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/jobs/${application.job.id}`} className="text-sm font-semibold text-ink hover:text-teal-700">
                        {application.job.title}
                      </Link>
                      <p className="text-xs text-slate-500">{application.job.company}</p>
                    </div>
                    <ScoreBadge score={application.job.matches?.[0]?.overallScore} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    {application.appliedViaExtension ? <span className="rounded-md bg-teal-50 px-2 py-1 font-semibold text-teal-800">Applied via Extension</span> : null}
                    <span className="rounded-md bg-slate-100 px-2 py-1">{application.job.sourcePlatform || application.job.source}</span>
                    <PolicyBadge value={application.job.sourceType} />
                    {application.submittedAt ? <span className="rounded-md bg-slate-100 px-2 py-1">Submitted {application.submittedAt.slice(0, 10)}</span> : null}
                  </div>
                  <textarea
                    className="field mt-3 min-h-20 text-xs"
                    placeholder="Notes"
                    value={application.notes ?? ""}
                    onChange={(event) =>
                      setApplications((current) => current.map((app) => (app.id === application.id ? { ...app, notes: event.target.value } : app)))
                    }
                    onBlur={(event) => patchApplication(application.id, { notes: event.target.value })}
                  />
                  <div className="mt-3 grid gap-2">
                    <input
                      className="field text-xs"
                      type="date"
                      value={application.followUpDate ? application.followUpDate.slice(0, 10) : ""}
                      onChange={(event) => patchApplication(application.id, { followUpDate: event.target.value })}
                    />
                    <select className="field text-xs" value={application.status} onChange={(event) => patchApplication(application.id, { status: event.target.value })}>
                      {columns.map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="btn-secondary mt-3 w-full text-xs" onClick={() => patchApplication(application.id, { status: "APPLIED", markApplied: true })}>
                    Mark Applied
                  </button>
                  {application.appliedDate ? <p className="mt-2 text-xs text-slate-500">Applied {application.appliedDate.slice(0, 10)}</p> : null}
                  <Link href={`/applications/${application.id}`} className="mt-2 inline-flex text-xs font-semibold text-teal-700 hover:text-teal-900">
                    Details
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
