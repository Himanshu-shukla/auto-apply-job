"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ExternalLink, Pause, Play, Send, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AutomationBadge, PolicyBadge } from "@/components/Phase3Badges";

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const [campaign, setCampaign] = useState<any>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const response = await fetch(`/api/campaigns/${params.id}`);
    setCampaign((await response.json()).campaign);
  }

  async function post(path: string) {
    const response = await fetch(path, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Action failed.");
      return;
    }
    setMessage(data.message || "Updated.");
    setCampaign(data.campaign);
  }

  if (!campaign) return <PageHeader title="Bulk Campaign" subtitle="Loading campaign." />;

  const jobs = campaign.campaignJobs ?? [];
  const ready = jobs.filter((item: any) => item.status === "ready").length;
  const review = jobs.filter((item: any) => item.status === "needs_review").length;

  return (
    <>
      <PageHeader title={campaign.name} subtitle={`Prepared ${campaign.preparedCount} jobs · ${review} need review · ${ready} ready to run.`} />

      <section className="panel mb-6 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={() => post(`/api/campaigns/${campaign.id}/start`)}>
            <Play size={16} />
            Start
          </button>
          <button className="btn-secondary" onClick={() => post(`/api/campaigns/${campaign.id}/pause`)}>
            <Pause size={16} />
            Pause
          </button>
          <button className="btn-primary" onClick={() => post(`/api/campaigns/${campaign.id}/run-next`)}>
            <Send size={16} />
            Run Next
          </button>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{campaign.status}</span>
          <span className="text-sm text-slate-600">{message}</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Metric label="Target" value={campaign.targetCount} />
          <Metric label="Prepared" value={campaign.preparedCount} />
          <Metric label="Submitted" value={campaign.submittedCount} />
          <Metric label="Failed" value={campaign.failedCount} />
        </div>
      </section>

      <div className="space-y-3">
        {jobs.map((item: any) => (
          <article key={item.id} className="panel p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-ink">{item.job?.title}</h2>
                  <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">Match {item.matchScore}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs">{item.status}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.job?.company} · {item.job?.location}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PolicyBadge value={item.job?.sourceType ?? "unknown"} />
                  <AutomationBadge value={item.job?.automationLevel ?? "save_only"} />
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs">{item.recommendedAction}</span>
                </div>
                {item.riskWarnings?.length ? <p className="mt-3 text-sm text-amber-800">{item.riskWarnings.join(" ")}</p> : null}
                {item.attempts?.[0]?.errorMessage ? <p className="mt-3 text-sm text-rose-700">{item.attempts[0].errorMessage}</p> : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link className="btn-secondary" href={item.job?.applyUrl ?? "#"} target="_blank">
                  <ExternalLink size={16} />
                  Open
                </Link>
                <button className="btn-primary" onClick={() => post(`/api/campaigns/${campaign.id}/jobs/${item.id}/approve`)}>
                  <Check size={16} />
                  Approve
                </button>
                <button className="btn-secondary" onClick={() => post(`/api/campaigns/${campaign.id}/jobs/${item.id}/reject`)}>
                  <X size={16} />
                  Skip
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value ?? 0}</div>
    </div>
  );
}
