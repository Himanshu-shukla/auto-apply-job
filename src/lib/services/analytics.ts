import { prisma } from "@/lib/prisma";

const responseStatuses = ["INTERVIEW", "OFFER", "REJECTED"];

export async function getAnalyticsOverview(userId: string) {
  const [jobs, applications] = await Promise.all([
    prisma.job.findMany({ where: { userId }, include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    (prisma as any).application.findMany({ where: { userId }, include: { job: true, resumeVersionRecord: true } })
  ]);
  const totalApplications = applications.filter((app: any) => app.status !== "SAVED").length;
  const responses = applications.filter((app: any) => responseStatuses.includes(app.status)).length;
  const interviews = applications.filter((app: any) => app.status === "INTERVIEW" || app.status === "OFFER").length;
  const offers = applications.filter((app: any) => app.status === "OFFER").length;
  const rejections = applications.filter((app: any) => app.status === "REJECTED").length;
  const averageMatchScore = jobs.length ? Math.round(jobs.reduce((sum, job) => sum + (job.matches[0]?.overallScore ?? 0), 0) / jobs.length) : 0;
  return {
    totalSavedJobs: jobs.length,
    totalApplications,
    applicationsBySource: groupCount(applications, (app: any) => app.job.sourceType ?? app.job.source),
    averageMatchScore,
    responseRate: rate(responses, totalApplications),
    interviewConversionRate: rate(interviews, totalApplications),
    offerConversionRate: rate(offers, totalApplications),
    rejectionRate: rate(rejections, totalApplications),
    applicationsPerWeek: applicationsPerWeek(applications),
    topPerformingResumeVersion: topPerformance(applications, (app: any) => app.resumeVersionRecord?.name ?? app.resumeVersion ?? "Unassigned"),
    topPerformingJobTitle: topPerformance(applications, (app: any) => app.job.title),
    bestSourceByInterviewRate: bestSourceByInterviewRate(applications)
  };
}

export async function getFunnel(userId: string) {
  const applications = await (prisma as any).application.findMany({ where: { userId } });
  return [
    { label: "Saved", value: applications.length },
    { label: "Ready", value: applications.filter((app: any) => app.status === "READY_TO_APPLY").length },
    { label: "Applied", value: applications.filter((app: any) => ["APPLIED", "INTERVIEW", "OFFER", "REJECTED"].includes(app.status)).length },
    { label: "Interview", value: applications.filter((app: any) => ["INTERVIEW", "OFFER"].includes(app.status)).length },
    { label: "Offer", value: applications.filter((app: any) => app.status === "OFFER").length }
  ];
}

export async function getSourcePerformance(userId: string) {
  const applications = await (prisma as any).application.findMany({ where: { userId }, include: { job: true } });
  return performanceBy(applications, (app: any) => app.job.sourceType ?? app.job.source);
}

export async function getResumePerformance(userId: string) {
  const applications = await (prisma as any).application.findMany({ where: { userId }, include: { resumeVersionRecord: true } });
  return performanceBy(applications, (app: any) => app.resumeVersionRecord?.name ?? app.resumeVersion ?? "Unassigned");
}

export function calculatePerformanceRows<T>(items: T[], groupBy: (item: T) => string, isApplied: (item: T) => boolean, isInterview: (item: T) => boolean) {
  const groups = new Map<string, { label: string; applications: number; interviews: number }>();
  for (const item of items) {
    const label = groupBy(item) || "Unknown";
    const group = groups.get(label) ?? { label, applications: 0, interviews: 0 };
    if (isApplied(item)) group.applications += 1;
    if (isInterview(item)) group.interviews += 1;
    groups.set(label, group);
  }
  return [...groups.values()].map((row) => ({ ...row, interviewRate: rate(row.interviews, row.applications) }));
}

function performanceBy(applications: any[], groupBy: (app: any) => string) {
  return calculatePerformanceRows(
    applications,
    groupBy,
    (app) => app.status !== "SAVED",
    (app) => app.status === "INTERVIEW" || app.status === "OFFER"
  ).sort((a, b) => b.interviewRate - a.interviewRate);
}

function groupCount(items: any[], groupBy: (item: any) => string) {
  return items.reduce((acc, item) => {
    const key = groupBy(item) || "Unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function rate(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function applicationsPerWeek(applications: any[]) {
  const buckets = groupCount(
    applications.filter((app) => app.status !== "SAVED"),
    (app) => weekKey(new Date(app.submittedAt ?? app.appliedDate ?? app.updatedAt))
  );
  return Object.entries(buckets).map(([week, count]) => ({ week, count })).sort((a, b) => a.week.localeCompare(b.week));
}

function weekKey(date: Date) {
  const first = new Date(date);
  first.setDate(date.getDate() - date.getDay());
  return first.toISOString().slice(0, 10);
}

function topPerformance(applications: any[], groupBy: (app: any) => string) {
  return performanceBy(applications, groupBy)[0]?.label ?? "Not enough data";
}

function bestSourceByInterviewRate(applications: any[]) {
  return performanceBy(applications, (app) => app.job.sourceType ?? app.job.source)[0]?.label ?? "Not enough data";
}
