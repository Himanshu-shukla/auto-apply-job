"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function AutomationSettingsPage() {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetch("/api/settings/automation").then(async (response) => setSettings((await response.json()).settings));
  }, []);

  async function save() {
    const response = await fetch("/api/settings/automation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        blockedCompanies: split(settings.blockedCompaniesText ?? settings.blockedCompanies?.join(",")),
        blockedKeywords: split(settings.blockedKeywordsText ?? settings.blockedKeywords?.join(","))
      })
    });
    setSettings((await response.json()).settings);
  }

  if (!settings) return <PageHeader title="Automation Settings" subtitle="Loading controls." />;

  return (
    <>
      <PageHeader title="Automation Settings" subtitle="Global controls, limits, blocked terms, and strict truthfulness defaults." />
      <section className="panel max-w-4xl p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.automationEnabled} onChange={(e) => setSettings({ ...settings, automationEnabled: e.target.checked })} />
            Enable automation globally
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.strictTruthfulness} onChange={(e) => setSettings({ ...settings, strictTruthfulness: e.target.checked })} />
            Strict truthfulness mode
          </label>
          <Field label="Applications/day" type="number" value={settings.maxApplicationsPerDay} onChange={(value) => setSettings({ ...settings, maxApplicationsPerDay: Number(value) })} />
          <Field label="Emails/day" type="number" value={settings.maxEmailsPerDay} onChange={(value) => setSettings({ ...settings, maxEmailsPerDay: Number(value) })} />
          <Field label="Follow-ups/day" type="number" value={settings.maxFollowUpsPerDay} onChange={(value) => setSettings({ ...settings, maxFollowUpsPerDay: Number(value) })} />
          <Field label="Cooldown minutes" type="number" value={settings.cooldownMinutes} onChange={(value) => setSettings({ ...settings, cooldownMinutes: Number(value) })} />
          <Select label="Approval mode" value={settings.approvalMode} onChange={(value) => setSettings({ ...settings, approvalMode: value })} options={["manual_review", "one_click_approve", "allowed_source_auto_send_only"]} />
          <Select label="AI tone" value={settings.aiTone} onChange={(value) => setSettings({ ...settings, aiTone: value })} options={["professional", "concise", "confident"]} />
          <Field label="Blocked companies" value={settings.blockedCompaniesText ?? settings.blockedCompanies?.join(", ")} onChange={(value) => setSettings({ ...settings, blockedCompaniesText: value })} />
          <Field label="Blocked keywords" value={settings.blockedKeywordsText ?? settings.blockedKeywords?.join(", ")} onChange={(value) => setSettings({ ...settings, blockedKeywordsText: value })} />
        </div>
        <button className="btn-primary mt-5" onClick={save}>
          <Save size={16} />
          Save Settings
        </button>
      </section>
    </>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return <label className="block"><span className="label">{label}</span><input className="field mt-1" type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block"><span className="label">{label}</span><select className="field mt-1" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((item: string) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>;
}

function split(value: string) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}
