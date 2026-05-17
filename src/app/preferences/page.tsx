"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const defaults = {
  targetRole: "",
  preferredLocations: "",
  remotePreference: "FLEXIBLE",
  minimumSalary: "",
  experienceLevel: "MID",
  jobType: "FULL_TIME",
  skillsToPrioritize: "",
  skillsToAvoid: "",
  sourcePreferences: "MockJobs, ManualImport"
};

export default function PreferencesPage() {
  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/preferences")
      .then((res) => res.json())
      .then((data) => {
        if (!data.preferences) return;
        setForm({
          ...data.preferences,
          preferredLocations: data.preferences.preferredLocations.join(", "),
          skillsToPrioritize: data.preferences.skillsToPrioritize.join(", "),
          skillsToAvoid: data.preferences.skillsToAvoid.join(", "),
          sourcePreferences: data.preferences.sourcePreferences.join(", "),
          minimumSalary: data.preferences.minimumSalary ?? ""
        });
      });
  }, []);

  async function savePreferences(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save preferences.");
      return;
    }
    setMessage("Preferences saved.");
  }

  function update(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <>
      <PageHeader title="Preferences" subtitle="Define the roles, locations, sources, and skill signals the matching engine should optimize for." />
      {message ? <p className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      <form onSubmit={savePreferences} className="panel grid gap-4 p-5 md:grid-cols-2">
        <Field label="Target role/title" value={form.targetRole} onChange={(value: string) => update("targetRole", value)} required />
        <Field label="Preferred locations" value={form.preferredLocations} onChange={(value: string) => update("preferredLocations", value)} placeholder="Remote, Austin, New York" />
        <Select label="Remote preference" value={form.remotePreference} onChange={(value: string) => update("remotePreference", value)} options={["FLEXIBLE", "REMOTE", "HYBRID", "ONSITE"]} />
        <Field label="Minimum salary" value={String(form.minimumSalary)} onChange={(value: string) => update("minimumSalary", value)} type="number" />
        <Select label="Experience level" value={form.experienceLevel} onChange={(value: string) => update("experienceLevel", value)} options={["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD"]} />
        <Select label="Job type" value={form.jobType} onChange={(value: string) => update("jobType", value)} options={["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT"]} />
        <Field label="Skills to prioritize" value={form.skillsToPrioritize} onChange={(value: string) => update("skillsToPrioritize", value)} placeholder="Node.js, React, PostgreSQL" />
        <Field label="Skills to avoid" value={form.skillsToAvoid} onChange={(value: string) => update("skillsToAvoid", value)} placeholder="Legacy stack, heavy travel" />
        <label className="md:col-span-2">
          <span className="label mb-1 block">Platforms/sources preference</span>
          <input className="field" value={form.sourcePreferences} onChange={(event) => update("sourcePreferences", event.target.value)} />
        </label>
        <div className="md:col-span-2">
          <button className="btn-primary" disabled={loading}>
            <Save size={16} />
            {loading ? "Saving" : "Save Preferences"}
          </button>
        </div>
      </form>
    </>
  );
}

function Field({ label, value, onChange, ...props }: any) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <input className="field" value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}

function Select({ label, value, onChange, options }: any) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option: string) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
