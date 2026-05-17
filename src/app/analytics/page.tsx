"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [funnel, setFunnel] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [resumes, setResumes] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/analytics/overview"),
      fetch("/api/analytics/funnel"),
      fetch("/api/analytics/source-performance"),
      fetch("/api/analytics/resume-performance")
    ]).then(async ([overviewRes, funnelRes, sourceRes, resumeRes]) => {
      setOverview(await overviewRes.json());
      setFunnel((await funnelRes.json()).funnel ?? []);
      setSources((await sourceRes.json()).sources ?? []);
      setResumes((await resumeRes.json()).resumes ?? []);
    });
  }, []);

  return (
    <>
      <PageHeader title="Analytics" subtitle="Pipeline performance from real saved jobs, applications, resumes, and source outcomes." />
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Saved jobs" value={overview?.totalSavedJobs ?? 0} />
        <Metric label="Applications" value={overview?.totalApplications ?? 0} />
        <Metric label="Avg match" value={`${overview?.averageMatchScore ?? 0}/100`} />
        <Metric label="Response rate" value={`${overview?.responseRate ?? 0}%`} />
        <Metric label="Interview rate" value={`${overview?.interviewConversionRate ?? 0}%`} />
        <Metric label="Offer rate" value={`${overview?.offerConversionRate ?? 0}%`} />
        <Metric label="Rejection rate" value={`${overview?.rejectionRate ?? 0}%`} />
        <Metric label="Best source" value={overview?.bestSourceByInterviewRate ?? "No data"} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Chart title="Application Funnel" rows={funnel} labelKey="label" valueKey="value" />
        <Chart title="Source Performance" rows={sources} labelKey="label" valueKey="interviewRate" suffix="%" />
        <Chart title="Resume Performance" rows={resumes} labelKey="label" valueKey="interviewRate" suffix="%" />
        <Chart title="Weekly Trend" rows={overview?.applicationsPerWeek ?? []} labelKey="week" valueKey="count" />
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="panel p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 truncate text-xl font-bold text-ink">{value}</div>
    </div>
  );
}

function Chart({ title, rows, labelKey, valueKey, suffix = "" }: any) {
  const max = Math.max(1, ...rows.map((row: any) => Number(row[valueKey]) || 0));
  return (
    <section className="panel p-5">
      <h2 className="mb-4 text-base font-semibold text-ink">{title}</h2>
      {rows.length ? rows.map((row: any) => {
        const value = Number(row[valueKey]) || 0;
        return (
          <div key={row[labelKey]} className="mb-3">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-600">{row[labelKey]}</span>
              <span className="font-semibold text-ink">{value}{suffix}</span>
            </div>
            <div className="h-2 rounded-md bg-slate-100">
              <div className="h-2 rounded-md bg-teal-700" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
            </div>
          </div>
        );
      }) : <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">No analytics yet. Send or update applications to populate this chart.</p>}
    </section>
  );
}
