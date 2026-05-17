"use client";

import { useEffect, useState } from "react";
import { Save, Upload } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

const arrayFields = ["skills", "workExperience", "education", "projects"];

export default function ResumePage() {
  const [resume, setResume] = useState<any>(null);
  const [parsed, setParsed] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/resume")
      .then((res) => res.json())
      .then((data) => {
        setResume(data.resume);
        setParsed(data.resume?.parsedJson ?? null);
      });
  }, []);

  async function uploadResume(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/resume/upload", { method: "POST", body: formData });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Upload failed.");
      return;
    }
    setResume(data.resume);
    setParsed(data.resume.parsedJson);
    setMessage("Resume parsed successfully.");
  }

  async function saveParsed() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/resume", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parsedJson: parsed })
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save resume.");
      return;
    }
    setResume(data.resume);
    setMessage("Parsed profile saved.");
  }

  function updateField(field: string, value: string) {
    setParsed((current: any) => ({
      ...current,
      [field]: arrayFields.includes(field)
        ? value
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
        : field === "totalExperienceYears"
          ? Number(value)
          : value
    }));
  }

  return (
    <>
      <PageHeader title="Resume" subtitle="Upload a PDF or DOCX resume, review the parsed data, and correct anything before matching." />
      <form onSubmit={uploadResume} className="panel mb-6 flex flex-col gap-4 p-5 md:flex-row md:items-end">
        <label className="flex-1">
          <span className="label mb-1 block">Resume file</span>
          <input className="field" type="file" accept=".pdf,.doc,.docx,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <button className="btn-primary" disabled={!file || loading}>
          <Upload size={16} />
          {loading ? "Processing" : "Upload Resume"}
        </button>
      </form>

      {message ? <p className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}

      {!parsed ? (
        <EmptyState title="No parsed resume yet" body="Upload your resume to extract contact info, skills, experience, education, projects, and total experience." />
      ) : (
        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Parsed Profile</h2>
              <p className="text-sm text-slate-500">{resume?.fileName}</p>
            </div>
            <button className="btn-primary" onClick={saveParsed} disabled={loading}>
              <Save size={16} />
              Save Edits
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {["name", "email", "phone", "location", "totalExperienceYears"].map((field) => (
              <label key={field}>
                <span className="label mb-1 block">{label(field)}</span>
                <input className="field" value={parsed[field] ?? ""} onChange={(event) => updateField(field, event.target.value)} />
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {arrayFields.map((field) => (
              <label key={field}>
                <span className="label mb-1 block">{label(field)}</span>
                <textarea className="field min-h-36" value={(parsed[field] ?? []).join("\n")} onChange={(event) => updateField(field, event.target.value)} />
              </label>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function label(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
