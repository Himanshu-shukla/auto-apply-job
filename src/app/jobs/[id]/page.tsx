"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, RefreshCw, Save, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ScoreBadge } from "@/components/ScoreBadge";

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState("");
  const [coverContent, setCoverContent] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadJob();
  }, []);

  async function loadJob() {
    const response = await fetch(`/api/jobs/${params.id}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Job not found.");
      return;
    }
    setJob(data.job);
    setCoverContent(data.job.coverLetters?.[0]?.content ?? "");
  }

  async function action(route: string, label: string) {
    setLoading(label);
    setError("");
    const response = await fetch(`/api/jobs/${params.id}/${route}`, { method: "POST" });
    const data = await response.json();
    setLoading("");
    if (!response.ok) {
      setError(data.error ?? "Action failed.");
      return;
    }
    if (data.coverLetter) setCoverContent(data.coverLetter.content);
    await loadJob();
  }

  async function saveCoverLetter() {
    setLoading("save");
    await fetch(`/api/jobs/${params.id}/cover-letter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: coverContent })
    });
    setLoading("");
    await loadJob();
  }

  if (error && !job) return <p className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>;
  if (!job) return <p className="text-sm text-slate-600">Loading job details...</p>;

  const match = job.matches?.[0];
  const suggestion = job.suggestions?.[0];

  return (
    <>
      <PageHeader
        title={job.title}
        subtitle={`${job.company} · ${job.location} · ${job.remoteType}`}
        action={
          <a className="btn-secondary" href={job.applyUrl} target="_blank" rel="noreferrer">
            Source URL
          </a>
        }
      />
      {error ? <p className="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-6">
          <div className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Match Breakdown</h2>
              <button className="btn-secondary" onClick={() => action("match", "match")} disabled={Boolean(loading)}>
                <RefreshCw size={16} />
                Re-score
              </button>
            </div>
            {match ? (
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <ScoreBadge score={match.overallScore} />
                  <p className="text-sm text-slate-600">{match.aiExplanation}</p>
                </div>
                <ScoreRows match={match} />
                <List title="Missing Skills" items={match.missingSkills} />
                <List title="Strong Matching Points" items={match.strongMatchingPoints} />
                <List title="Risk Factors" items={match.riskFactors} />
              </div>
            ) : (
              <p className="text-sm text-slate-600">Run matching to see score details.</p>
            )}
          </div>

          <div className="panel p-5">
            <h2 className="mb-3 text-base font-semibold text-ink">Job Description</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{job.description}</p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Resume Suggestions</h2>
              <button className="btn-primary" onClick={() => action("resume-suggestions", "suggestions")} disabled={Boolean(loading)}>
                <Sparkles size={16} />
                Generate
              </button>
            </div>
            {suggestion ? (
              <div className="grid gap-4 md:grid-cols-2">
                <List title="Safe to add if true" items={suggestion.safeToAddIfTrue} />
                <List title="Needs confirmation" items={suggestion.needsUserConfirmation} />
                <List title="Missing skill to learn" items={suggestion.missingSkillToLearn} />
                <List title="Keywords" items={suggestion.keywords} />
                <List title="Better bullet ideas" items={suggestion.improvedBullets} />
                <List title="Weak areas" items={suggestion.weakAreas} />
              </div>
            ) : (
              <p className="text-sm text-slate-600">Generate tailored suggestions. Nothing here should be added unless it is true.</p>
            )}
          </div>

          <div className="panel p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">Cover Letter</h2>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => action("cover-letter", "cover")} disabled={Boolean(loading)}>
                  <RefreshCw size={16} />
                  Regenerate
                </button>
                <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(coverContent)} disabled={!coverContent}>
                  <Copy size={16} />
                  Copy
                </button>
                <button className="btn-primary" onClick={saveCoverLetter} disabled={!coverContent || Boolean(loading)}>
                  <Save size={16} />
                  Save
                </button>
              </div>
            </div>
            <textarea
              className="field min-h-80"
              value={coverContent}
              placeholder="Generate a cover letter, then edit it here before saving."
              onChange={(event) => setCoverContent(event.target.value)}
            />
          </div>
          <Link href="/tracker" className="btn-secondary w-full">
            View in Tracker
          </Link>
        </section>
      </div>
    </>
  );
}

function ScoreRows({ match }: any) {
  const rows = [
    ["Skills", match.skillsScore],
    ["Experience", match.experienceScore],
    ["Role/title", match.roleScore],
    ["Location/remote", match.locationScore],
    ["Salary", match.salaryScore]
  ];
  return (
    <div className="mb-5 grid gap-2">
      {rows.map(([label, score]) => (
        <div key={label} className="grid grid-cols-[120px_1fr_48px] items-center gap-3 text-sm">
          <span className="text-slate-600">{label}</span>
          <span className="h-2 rounded-full bg-slate-100">
            <span className="block h-2 rounded-full bg-teal-600" style={{ width: `${score}%` }} />
          </span>
          <span className="text-right font-semibold">{score}</span>
        </div>
      ))}
    </div>
  );
}

function List({ title, items }: { title: string; items?: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-normal text-slate-500">{title}</h3>
      {items?.length ? (
        <ul className="space-y-2 text-sm text-slate-700">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="rounded-md bg-slate-50 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No items yet.</p>
      )}
    </div>
  );
}
