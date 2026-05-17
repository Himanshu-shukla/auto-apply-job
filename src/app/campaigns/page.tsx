"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Play, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const emptyForm = {
  name: "",
  targetCount: 50,
  minMatchScore: 70,
  titleIncludes: "",
  locationIncludes: ""
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const response = await fetch("/api/campaigns");
    const data = await readJson(response);
    if (!response.ok) {
      setMessage(data.error || "Could not load campaigns.");
      setCampaigns([]);
      return;
    }
    setCampaigns(data.campaigns ?? []);
  }

  async function createCampaign() {
    setLoading(true);
    setMessage("Preparing campaign...");
    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await readJson(response);
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Campaign creation failed.");
      return;
    }
    setForm(emptyForm);
    setMessage(`Prepared ${data.campaign?.preparedCount ?? 0} job(s).`);
    await load();
  }

  return (
    <>
      <PageHeader title="Bulk Campaigns" subtitle="Prepare 50, 100, or 500 job queues with review gates and source-policy enforcement." />

      <section className="panel mb-6 p-5">
        <div className="grid gap-3 md:grid-cols-5">
          <input className="field" placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="field" value={form.targetCount} onChange={(e) => setForm({ ...form, targetCount: Number(e.target.value) })}>
            {[50, 100, 500].map((count) => <option key={count} value={count}>{count} jobs</option>)}
          </select>
          <input className="field" type="number" min={0} max={100} value={form.minMatchScore} onChange={(e) => setForm({ ...form, minMatchScore: Number(e.target.value) })} />
          <input className="field" placeholder="Title filter" value={form.titleIncludes} onChange={(e) => setForm({ ...form, titleIncludes: e.target.value })} />
          <input className="field" placeholder="Location filter" value={form.locationIncludes} onChange={(e) => setForm({ ...form, locationIncludes: e.target.value })} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" onClick={createCampaign} disabled={loading}>
            <Plus size={16} />
            Create Queue
          </button>
          <button className="btn-secondary" onClick={load}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <span className="text-sm text-slate-600">{message}</span>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {campaigns.map((campaign) => (
          <article key={campaign.id} className="panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-ink">{campaign.name}</h2>
                <p className="mt-1 text-sm text-slate-600">Target {campaign.targetCount} · score {campaign.minMatchScore}+ · {campaign.status}</p>
              </div>
              <Link className="btn-primary" href={`/campaigns/${campaign.id}`}>
                <Play size={16} />
                Open
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <Metric label="Prepared" value={campaign.preparedCount} />
              <Metric label="Submitted" value={campaign.submittedCount} />
              <Metric label="Failed" value={campaign.failedCount} />
            </div>
            <div className="mt-4 space-y-2">
              {(campaign.campaignJobs ?? []).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <span className="truncate">{item.job?.title} · {item.job?.company}</span>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs">{item.status}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 300) };
  }
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value ?? 0}</div>
    </div>
  );
}
