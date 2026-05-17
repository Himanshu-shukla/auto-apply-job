"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ApprovalBadge } from "@/components/Phase3Badges";

const emptyRule = {
  name: "",
  targetTitles: "",
  locations: "",
  remotePreference: "FLEXIBLE",
  minMatchScore: 70,
  minSalary: "",
  requiredSkills: "",
  excludedCompanies: "",
  excludedKeywords: "",
  maxApplicationsPerDay: 10,
  approvalMode: "manual_review",
  enabled: true
};

export default function AutomationPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [form, setForm] = useState(emptyRule);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [rulesRes, settingsRes] = await Promise.all([fetch("/api/automation/rules"), fetch("/api/settings/automation")]);
    setRules((await rulesRes.json()).rules ?? []);
    setSettings((await settingsRes.json()).settings);
  }

  async function saveRule() {
    await fetch("/api/automation/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(form))
    });
    setForm(emptyRule);
    await load();
  }

  async function removeRule(id: string) {
    await fetch(`/api/automation/rules/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <>
      <PageHeader title="Automation" subtitle="Controlled rules for safe sources only, with review gates and daily limits." />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Quota label="Automation" value={settings?.automationEnabled ? "Enabled" : "Disabled"} />
        <Quota label="Applications/day" value={settings?.maxApplicationsPerDay ?? 10} />
        <Quota label="Emails/day" value={settings?.maxEmailsPerDay ?? 10} />
        <Quota label="Cooldown" value={`${settings?.cooldownMinutes ?? 3} min`} />
      </div>

      <section className="panel mb-6 p-5">
        <h2 className="mb-4 text-base font-semibold text-ink">Create Rule</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="field" placeholder="Rule name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field" placeholder="Target titles, comma separated" value={form.targetTitles} onChange={(e) => setForm({ ...form, targetTitles: e.target.value })} />
          <input className="field" placeholder="Locations" value={form.locations} onChange={(e) => setForm({ ...form, locations: e.target.value })} />
          <select className="field" value={form.remotePreference} onChange={(e) => setForm({ ...form, remotePreference: e.target.value })}>
            <option value="FLEXIBLE">Flexible</option>
            <option value="REMOTE">Remote</option>
            <option value="HYBRID">Hybrid</option>
            <option value="ONSITE">Onsite</option>
          </select>
          <input className="field" type="number" placeholder="Minimum match score" value={form.minMatchScore} onChange={(e) => setForm({ ...form, minMatchScore: Number(e.target.value) })} />
          <input className="field" type="number" placeholder="Minimum salary" value={form.minSalary} onChange={(e) => setForm({ ...form, minSalary: e.target.value })} />
          <input className="field" placeholder="Required skills" value={form.requiredSkills} onChange={(e) => setForm({ ...form, requiredSkills: e.target.value })} />
          <input className="field" placeholder="Excluded companies" value={form.excludedCompanies} onChange={(e) => setForm({ ...form, excludedCompanies: e.target.value })} />
          <input className="field" placeholder="Excluded keywords" value={form.excludedKeywords} onChange={(e) => setForm({ ...form, excludedKeywords: e.target.value })} />
          <select className="field" value={form.approvalMode} onChange={(e) => setForm({ ...form, approvalMode: e.target.value })}>
            <option value="manual_review">Manual review</option>
            <option value="one_click_approve">One-click approve</option>
            <option value="allowed_source_auto_send_only">Allowed-source auto-send only</option>
          </select>
          <input className="field" type="number" value={form.maxApplicationsPerDay} onChange={(e) => setForm({ ...form, maxApplicationsPerDay: Number(e.target.value) })} />
          <button className="btn-primary" onClick={saveRule}>
            <Plus size={16} />
            Add Rule
          </button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {rules.map((rule) => (
          <article key={rule.id} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">{rule.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{rule.targetTitles.join(", ") || "Any title"} · score {rule.minMatchScore}+</p>
              </div>
              <ApprovalBadge value={rule.approvalMode} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-md bg-slate-100 px-2 py-1">{rule.remotePreference}</span>
              <span className="rounded-md bg-slate-100 px-2 py-1">Max {rule.maxApplicationsPerDay}/day</span>
              <span className="rounded-md bg-slate-100 px-2 py-1">{rule.enabled ? "Enabled" : "Disabled"}</span>
            </div>
            <button className="btn-secondary mt-4" onClick={() => removeRule(rule.id)}>
              <Trash2 size={16} />
              Delete
            </button>
          </article>
        ))}
      </div>
    </>
  );
}

function toPayload(form: any) {
  return {
    ...form,
    targetTitles: split(form.targetTitles),
    locations: split(form.locations),
    requiredSkills: split(form.requiredSkills),
    excludedCompanies: split(form.excludedCompanies),
    excludedKeywords: split(form.excludedKeywords),
    minSalary: form.minSalary ? Number(form.minSalary) : null
  };
}

function split(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function Quota({ label, value }: { label: string; value: any }) {
  return (
    <div className="panel p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-bold text-ink">{value}</div>
    </div>
  );
}
