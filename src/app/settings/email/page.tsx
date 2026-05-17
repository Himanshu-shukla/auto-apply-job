"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetch("/api/settings/email").then(async (response) => setSettings((await response.json()).settings));
  }, []);

  async function save() {
    const response = await fetch("/api/settings/email", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setSettings((await response.json()).settings);
  }

  if (!settings) return <PageHeader title="Email Settings" subtitle="Loading email controls." />;

  return (
    <>
      <PageHeader title="Email Settings" subtitle="Sender identity, subject template, reply-to, signature, and follow-up copy." />
      <section className="panel max-w-4xl p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Sender name" value={settings.senderName ?? ""} onChange={(value: string) => setSettings({ ...settings, senderName: value })} />
          <Field label="Reply-to email" value={settings.replyToEmail ?? ""} onChange={(value: string) => setSettings({ ...settings, replyToEmail: value })} />
          <Field label="Subject template" value={settings.defaultSubjectTemplate} onChange={(value: string) => setSettings({ ...settings, defaultSubjectTemplate: value })} />
          <label className="block md:col-span-2"><span className="label">Email signature</span><textarea className="field mt-1 min-h-28" value={settings.emailSignature} onChange={(e) => setSettings({ ...settings, emailSignature: e.target.value })} /></label>
          <label className="block md:col-span-2"><span className="label">Follow-up template</span><textarea className="field mt-1 min-h-28" value={settings.followUpTemplate} onChange={(e) => setSettings({ ...settings, followUpTemplate: e.target.value })} /></label>
        </div>
        <button className="btn-primary mt-5" onClick={save}>
          <Save size={16} />
          Save Settings
        </button>
      </section>
    </>
  );
}

function Field({ label, value, onChange }: any) {
  return <label className="block"><span className="label">{label}</span><input className="field mt-1" value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></label>;
}
