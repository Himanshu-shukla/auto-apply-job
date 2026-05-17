"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AutomationBadge, PolicyBadge } from "@/components/Phase3Badges";

const emptySource = {
  name: "",
  sourceType: "company_career_page",
  domain: "",
  baseUrl: "",
  automationLevel: "assisted_apply",
  explicitlyAllowed: false,
  enabled: true
};

export default function SourcesPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [form, setForm] = useState(emptySource);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const response = await fetch("/api/sources");
    setSources((await response.json()).sources ?? []);
  }

  async function saveSource() {
    await fetch("/api/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm(emptySource);
    await load();
  }

  async function deleteSource(id: string) {
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <>
      <PageHeader title="Sources" subtitle="Classify sources and grant only the automation level each source is allowed to use." />
      <section className="panel mb-6 p-5">
        <h2 className="mb-4 text-base font-semibold text-ink">Add Allowed Source</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="field" value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })}>
            <option value="company_career_page">Company career page</option>
            <option value="direct_email">Direct email</option>
            <option value="official_api">Official API</option>
            <option value="partner_feed">Partner feed</option>
            <option value="user_imported">User imported</option>
            <option value="restricted_platform">Restricted platform</option>
            <option value="unknown">Unknown</option>
          </select>
          <select className="field" value={form.automationLevel} onChange={(e) => setForm({ ...form, automationLevel: e.target.value })}>
            <option value="save_only">Save only</option>
            <option value="assisted_apply">Assisted apply</option>
            <option value="one_click_apply">One-click apply</option>
            <option value="auto_send_email">Auto-send email</option>
            <option value="api_apply">API apply</option>
          </select>
          <input className="field" placeholder="Domain" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
          <input className="field" placeholder="Career URL" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
          <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
            <input type="checkbox" checked={form.explicitlyAllowed} onChange={(e) => setForm({ ...form, explicitlyAllowed: e.target.checked })} />
            Explicitly allowed
          </label>
          <button className="btn-primary md:col-span-3" onClick={saveSource}>
            <Plus size={16} />
            Add Source
          </button>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {sources.map((source) => (
          <article key={source.id} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">{source.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{source.domain || source.baseUrl || "No domain"}</p>
              </div>
              <div className="flex flex-col gap-2">
                <PolicyBadge value={source.sourceType} />
                <AutomationBadge value={source.automationLevel} />
              </div>
            </div>
            <button className="btn-secondary mt-4" onClick={() => deleteSource(source.id)}>
              <Trash2 size={16} />
              Delete
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
