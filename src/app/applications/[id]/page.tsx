import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ScoreBadge } from "@/components/ScoreBadge";
import { EmailApplicationPanel } from "@/components/EmailApplicationPanel";
import { AutomationBadge, PolicyBadge } from "@/components/Phase3Badges";
import { getDemoUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApplicationPhase2Fields, getJobPhase2Fields, listApplicationAnswers, listAutofillLogs } from "@/lib/services/phase2Storage";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const user = await getDemoUser();
  const application = await prisma.application.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      job: { include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } } }
    }
  });
  if (!application) notFound();
  const [appPhase2, jobPhase2, answers, autofillLogs] = await Promise.all([
    getApplicationPhase2Fields([application.id]),
    getJobPhase2Fields([application.job.id]),
    listApplicationAnswers(application.id),
    listAutofillLogs(application.id)
  ]);
  const phase2 = appPhase2[application.id] ?? { appliedViaExtension: false, submittedAt: null };
  const jobExtra = jobPhase2[application.job.id] ?? { sourcePlatform: null };

  return (
    <>
      <PageHeader
        title={application.job.title}
        subtitle={`${application.job.company} · ${application.status}`}
        action={
          <Link className="btn-secondary" href="/tracker">
            Back to Tracker
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="space-y-6">
          <div className="panel p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Application</h2>
                <p className="mt-1 text-sm text-slate-600">{application.job.location}</p>
              </div>
              <ScoreBadge score={application.job.matches?.[0]?.overallScore} />
            </div>
            <dl className="grid gap-3 text-sm">
              <Row label="Source platform" value={jobExtra.sourcePlatform || application.job.source} />
              <div className="grid gap-2">
                <dt className="label">Source policy</dt>
                <dd className="flex flex-wrap gap-2">
                  <PolicyBadge value={(application.job as any).sourceType} />
                  <AutomationBadge value={(application.job as any).automationLevel} />
                </dd>
              </div>
              <Row label="Recruiter email" value={(application.job as any).recruiterEmail || "Not stored"} />
              <Row label="Applied via extension" value={phase2.appliedViaExtension ? "Yes" : "No"} />
              <Row label="Submitted" value={phase2.submittedAt ? phase2.submittedAt.toISOString().slice(0, 10) : "Not recorded"} />
              <Row label="Follow-up" value={application.followUpDate ? application.followUpDate.toISOString().slice(0, 10) : "Not scheduled"} />
              <Row label="Source URL" value={application.sourceUrl} />
            </dl>
          </div>

          <div className="panel p-5">
            <h2 className="mb-3 text-base font-semibold text-ink">Notes</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{application.notes || "No notes saved."}</p>
          </div>
        </section>

        <section className="space-y-6">
          <EmailApplicationPanel
            applicationId={application.id}
            directEmailAllowed={(application.job as any).sourceType === "direct_email" && Boolean((application.job as any).recruiterEmail)}
          />

          <div className="panel p-5">
            <h2 className="mb-4 text-base font-semibold text-ink">Application Answers</h2>
            <div className="space-y-3">
              {answers.length ? (
                answers.map((answer: any) => (
                  <article key={answer.id} className="rounded-md bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-ink">{answer.question}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{answer.finalAnswer || answer.generatedAnswer}</p>
                    {answer.needsConfirmation ? <p className="mt-2 text-xs font-semibold text-amber-700">Needs confirmation</p> : null}
                  </article>
                ))
              ) : (
                <p className="text-sm text-slate-600">No generated answers recorded yet.</p>
              )}
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="mb-4 text-base font-semibold text-ink">Autofill Logs</h2>
            <div className="space-y-3">
              {autofillLogs.length ? (
                autofillLogs.map((log: any) => (
                  <article key={log.id} className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                    <div className="mb-2 flex flex-wrap justify-between gap-2">
                      <span className="font-semibold text-ink">{log.sourcePlatform || "Application page"}</span>
                      <span className="text-xs text-slate-500">{log.createdAt.toISOString().slice(0, 10)}</span>
                    </div>
                    <p className="break-all text-xs text-slate-500">{log.pageUrl}</p>
                    <LogList title="Filled" items={log.filledFields} />
                    <LogList title="Skipped" items={log.skippedFields} />
                  </article>
                ))
              ) : (
                <p className="text-sm text-slate-600">No autofill activity recorded yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="label">{label}</dt>
      <dd className="break-words text-slate-700">{value}</dd>
    </div>
  );
}

function LogList({ title, items }: { title: string; items: unknown }) {
  const rows = Array.isArray(items) ? items : [];
  return (
    <div className="mt-3">
      <h3 className="label mb-2">{title}</h3>
      {rows.length ? (
        <ul className="flex flex-wrap gap-2">
          {rows.map((item: any, index) => (
            <li key={`${title}-${index}`} className="rounded-md bg-white px-2 py-1 text-xs text-slate-600">
              {item.label || item.profileKey || "Field"}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">None</p>
      )}
    </div>
  );
}
