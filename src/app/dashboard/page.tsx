"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, FileText, Sparkles, Target } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ScoreBadge } from "@/components/ScoreBadge";

export default function DashboardPage() {
  const [resume, setResume] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([fetch("/api/resume"), fetch("/api/preferences"), fetch("/api/jobs")])
      .then(async ([resumeRes, prefRes, jobsRes]) => {
        setResume((await resumeRes.json()).resume);
        setPreferences((await prefRes.json()).preferences);
        setJobs((await jobsRes.json()).jobs ?? []);
      })
      .catch(() => {});
  }, []);

  const topJobs = [...jobs].sort((a, b) => (b.matches?.[0]?.overallScore ?? 0) - (a.matches?.[0]?.overallScore ?? 0)).slice(0, 4);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your resume, preferences, job matches, and application pipeline in one quiet operating room."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={FileText} label="Active Resume" value={resume ? "Parsed" : "Missing"} href="/resume" />
        <Metric icon={Target} label="Target Role" value={preferences?.targetRole ?? "Set preferences"} href="/preferences" />
        <Metric icon={BriefcaseBusiness} label="Jobs Found" value={String(jobs.length)} href="/jobs" />
        <Metric icon={Sparkles} label="Best Score" value={`${topJobs[0]?.matches?.[0]?.overallScore ?? 0}/100`} href="/jobs" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Top Matches</h2>
            <Link className="text-sm font-semibold text-teal-700" href="/jobs">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {topJobs.length ? (
              topJobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="block rounded-md border border-slate-200 p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-ink">{job.title}</h3>
                      <p className="text-sm text-slate-600">
                        {job.company} · {job.location} · {job.remoteType}
                      </p>
                    </div>
                    <ScoreBadge score={job.matches?.[0]?.overallScore} />
                  </div>
                </Link>
              ))
            ) : (
              <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">Save preferences and run Find Jobs to populate matches.</p>
            )}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-base font-semibold text-ink">Phase 1 Flow</h2>
          <div className="mt-4 space-y-3">
            <Step done={Boolean(resume)} href="/resume" label="Upload and edit parsed resume" />
            <Step done={Boolean(preferences)} href="/preferences" label="Save search preferences" />
            <Step done={jobs.length > 0} href="/jobs" label="Find and score jobs" />
            <Step done={false} href="/tracker" label="Move applications through tracker" />
          </div>
        </section>
      </div>
    </>
  );
}

function Metric({ icon: Icon, label, value, href }: any) {
  return (
    <Link href={href} className="panel p-4 transition hover:-translate-y-0.5 hover:border-teal-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <Icon size={18} className="text-teal-700" />
      </div>
      <div className="mt-3 truncate text-xl font-bold text-ink">{value}</div>
    </Link>
  );
}

function Step({ done, href, label }: { done: boolean; href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
      <span className={done ? "text-ink" : "text-slate-500"}>{label}</span>
      <ArrowRight size={16} className="text-slate-400" />
    </Link>
  );
}
