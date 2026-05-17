"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ScoreBadge } from "@/components/ScoreBadge";
import { AutomationBadge, PolicyBadge } from "@/components/Phase3Badges";

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [sort, setSort] = useState("score");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState({ manualTitle: "", manualCompany: "", manualLocation: "", manualUrl: "", manualDescription: "" });

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    const response = await fetch("/api/jobs");
    const data = await response.json();
    setJobs(data.jobs ?? []);
  }

  async function findJobs() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/jobs/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manual.manualDescription.trim() ? manual : {})
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not find jobs.");
      return;
    }
    setManual({ manualTitle: "", manualCompany: "", manualLocation: "", manualUrl: "", manualDescription: "" });
    await loadJobs();
  }

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      if (sort === "score") return (b.matches?.[0]?.overallScore ?? 0) - (a.matches?.[0]?.overallScore ?? 0);
      if (sort === "date") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return a.title.localeCompare(b.title);
    });
  }, [jobs, sort]);

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="Find jobs through approved providers, import manual descriptions, and sort by fit score."
        action={
          <button className="btn-primary" onClick={findJobs} disabled={loading}>
            <Search size={16} />
            {loading ? "Finding" : "Find Jobs"}
          </button>
        }
      />
      {error ? <p className="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}

      <section className="panel mb-6 p-5">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-teal-700" />
          <h2 className="text-base font-semibold text-ink">Manual Job Import</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <input className="field" placeholder="Title" value={manual.manualTitle} onChange={(e) => setManual({ ...manual, manualTitle: e.target.value })} />
          <input className="field" placeholder="Company" value={manual.manualCompany} onChange={(e) => setManual({ ...manual, manualCompany: e.target.value })} />
          <input className="field" placeholder="Location" value={manual.manualLocation} onChange={(e) => setManual({ ...manual, manualLocation: e.target.value })} />
          <input className="field" placeholder="Apply URL" value={manual.manualUrl} onChange={(e) => setManual({ ...manual, manualUrl: e.target.value })} />
        </div>
        <textarea
          className="field mt-3 min-h-28"
          placeholder="Paste job description here to import alongside mock/provider results."
          value={manual.manualDescription}
          onChange={(e) => setManual({ ...manual, manualDescription: e.target.value })}
        />
      </section>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">{jobs.length} jobs stored</p>
        <select className="field w-44" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="score">Sort by score</option>
          <option value="date">Sort by newest</option>
          <option value="title">Sort by title</option>
        </select>
      </div>

      {sortedJobs.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {sortedJobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="panel p-5 transition hover:-translate-y-0.5 hover:border-teal-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{job.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {job.company} · {job.location} · {job.remoteType}
                  </p>
                </div>
                <ScoreBadge score={job.matches?.[0]?.overallScore} />
              </div>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{job.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-md bg-slate-100 px-2 py-1">{job.source}</span>
                <PolicyBadge value={job.sourceType} />
                <AutomationBadge value={job.automationLevel} />
                {job.salaryMin ? <span className="rounded-md bg-slate-100 px-2 py-1">${job.salaryMin.toLocaleString()}+</span> : null}
                {job.experienceRequired ? <span className="rounded-md bg-slate-100 px-2 py-1">{job.experienceRequired}+ yrs</span> : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="No jobs yet" body="Save preferences, then click Find Jobs to load approved mock/provider results and create tracker cards." />
      )}
    </>
  );
}
