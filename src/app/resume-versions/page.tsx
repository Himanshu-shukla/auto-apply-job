"use client";

import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function ResumeVersionsPage() {
  const [versions, setVersions] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", targetRole: "", rawText: "", isDefault: false });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const response = await fetch("/api/resume-versions");
    setVersions((await response.json()).versions ?? []);
  }

  async function create() {
    await fetch("/api/resume-versions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, parsedJson: {}, fileUrl: null }) });
    setForm({ name: "", targetRole: "", rawText: "", isDefault: false });
    await load();
  }

  async function setDefault(id: string) {
    await fetch(`/api/resume-versions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDefault: true }) });
    await load();
  }

  return (
    <>
      <PageHeader title="Resume Versions" subtitle="Create targeted resume versions and track which versions produce interviews." />
      <section className="panel mb-6 p-5">
        <h2 className="mb-4 text-base font-semibold text-ink">Create Version</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="field" placeholder="Version name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field" placeholder="Target role" value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })} />
          <textarea className="field min-h-40 md:col-span-2" placeholder="Resume text" value={form.rawText} onChange={(e) => setForm({ ...form, rawText: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Mark default
          </label>
          <button className="btn-primary" onClick={create}>
            <Plus size={16} />
            Create Version
          </button>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {versions.map((version) => (
          <article key={version.id} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">{version.name}</h2>
                <p className="text-sm text-slate-600">{version.targetRole || "General"} · {version.rawText.length} chars</p>
              </div>
              {version.isDefault ? <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">Default</span> : null}
            </div>
            <p className="mt-4 line-clamp-3 text-sm text-slate-600">{version.rawText}</p>
            {!version.isDefault ? (
              <button className="btn-secondary mt-4" onClick={() => setDefault(version.id)}>
                <Check size={16} />
                Set Default
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
