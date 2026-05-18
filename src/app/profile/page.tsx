"use client";

import { useEffect, useState } from "react";
import { Save, UserRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const scalarFields = [
  ["fullName", "Full name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["currentLocation", "Current location"],
  ["targetRole", "Target role"],
  ["expectedSalary", "Expected salary"],
  ["availability", "Availability / notice period"],
  ["workAuthorization", "Work authorization"],
  ["visaStatus", "Visa status"],
  ["linkedIn", "LinkedIn"],
  ["portfolio", "Portfolio"],
  ["github", "GitHub"]
];

const sectionFields = [
  ["workHistory", "Work history"],
  ["education", "Education"],
  ["certificates", "Certificates"],
  ["customAnswers", "Custom answers"]
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [resumes, setResumes] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const response = await fetch("/api/profile");
    const data = await response.json();
    setProfile(data.profile);
    setResumes(data.resumes ?? []);
  }

  function update(field: string, value: string) {
    setProfile((current: any) => ({ ...current, [field]: value }));
  }

  function updateSection(field: string, value: string) {
    setProfile((current: any) => ({
      ...current,
      [field]: value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
    }));
  }

  async function save() {
    setLoading(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error || "Could not save profile.");
      return;
    }
    setProfile(data.profile);
    setMessage("Profile saved for extension autofill.");
  }

  if (!profile) return <PageHeader title="Profile" subtitle="Loading structured applicant profile." />;

  return (
    <>
      <PageHeader title="Profile" subtitle="Build the structured profile used for autofill, answers, resume selection, and campaign runs." />

      {message ? <p className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}

      <section className="panel mb-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-800">
              <UserRound size={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink">Applicant Details</h2>
              <p className="text-sm text-slate-500">These values are shown in the extension preview before filling.</p>
            </div>
          </div>
          <button className="btn-primary" onClick={save} disabled={loading}>
            <Save size={16} />
            {loading ? "Saving" : "Save Profile"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {scalarFields.map(([field, label]) => (
            <label key={field}>
              <span className="label mb-1 block">{label}</span>
              <input className="field" value={profile[field] ?? ""} onChange={(event) => update(field, event.target.value)} />
            </label>
          ))}
          <label>
            <span className="label mb-1 block">Preferred resume</span>
            <select className="field" value={profile.preferredResumeId ?? ""} onChange={(event) => update("preferredResumeId", event.target.value)}>
              <option value="">Use active resume</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.fileName}{resume.isActive ? " · active" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="mb-4 text-base font-semibold text-ink">Structured Sections</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {sectionFields.map(([field, label]) => (
            <label key={field}>
              <span className="label mb-1 block">{label}</span>
              <textarea
                className="field min-h-44"
                value={(profile[field] ?? []).join("\n")}
                onChange={(event) => updateSection(field, event.target.value)}
              />
            </label>
          ))}
        </div>
      </section>
    </>
  );
}
