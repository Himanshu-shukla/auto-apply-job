import { prisma } from "@/lib/prisma";
import { generateAIResponse } from "@/lib/ai";
import { logAudit } from "@/lib/services/audit";
import { checkCooldown, checkDailyLimit } from "@/lib/services/rateLimits";
import { createApprovalQueueItem } from "@/lib/services/approvalQueue";
import { deliverEmail } from "@/lib/services/emailDelivery";
import { ensureDefaultResumeVersion } from "@/lib/services/resumeVersions";
import { getAutomationSetting, getEmailSetting } from "@/lib/services/settings";
import { evaluateAutomationRisk } from "@/lib/services/risk";
import { isAutomationAllowed } from "@/lib/services/sourcePolicy";

export type GeneratedApplicationEmail = {
  subject: string;
  body: string;
  riskWarnings: string[];
};

export async function generateApplicationEmail(userId: string, applicationId: string): Promise<GeneratedApplicationEmail & { emailApplication: any }> {
  const application = await (prisma as any).application.findFirst({
    where: { id: applicationId, userId },
    include: { job: { include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } } } }
  });
  if (!application) throw new Error("Application not found.");
  if (application.job.sourceType !== "direct_email") throw new Error("Email applications are only available for direct email jobs.");
  const to = application.job.recruiterEmail;
  if (!to) throw new Error("No recruiter or HR email is stored for this job.");

  const [resumeVersion, settings, emailSettings] = await Promise.all([
    ensureDefaultResumeVersion(userId),
    getAutomationSetting(userId),
    getEmailSetting(userId)
  ]);
  if (!resumeVersion) throw new Error("Create a resume version before generating an email application.");

  const fallback = fallbackApplicationEmail({
    candidateName: emailSettings.senderName || "Candidate",
    role: application.job.title,
    company: application.job.company,
    signature: emailSettings.emailSignature,
    resumeText: resumeVersion.rawText
  });

  const ai = await generateAIResponse<GeneratedApplicationEmail>(
    [
      "Generate a truthful direct job application email as JSON.",
      "Do not invent experience, employers, education, work authorization, salary, links, or skills.",
      "If information is missing, keep the wording general and add a risk warning.",
      "Use the requested tone and keep the email concise."
    ].join(" "),
    JSON.stringify({
      resumeVersion: { name: resumeVersion.name, targetRole: resumeVersion.targetRole, rawText: resumeVersion.rawText, parsedJson: resumeVersion.parsedJson },
      job: { role: application.job.title, company: application.job.company, description: application.job.description },
      userTone: settings.aiTone,
      signature: emailSettings.emailSignature,
      subjectTemplate: emailSettings.defaultSubjectTemplate
    }),
    { subject: "string", body: "string", riskWarnings: ["string"] }
  );

  const generated = typeof ai === "object" && ai && "subject" in ai ? ai : fallback;
  const risk = evaluateAutomationRisk(application.job, generated, application.job.sourceType);
  const emailApplication = await (prisma as any).emailApplication.create({
    data: {
      userId,
      applicationId,
      to,
      cc: [],
      subject: generated.subject || fallback.subject,
      body: generated.body || fallback.body,
      attachmentResumeVersionId: resumeVersion.id,
      attachments: [{ type: "resume_version", resumeVersionId: resumeVersion.id, name: resumeVersion.name }],
      status: "draft",
      followUpDate: addDays(new Date(), 7)
    }
  });
  await (prisma as any).application.update({ where: { id: applicationId }, data: { resumeVersionId: resumeVersion.id, approvalStatus: "pending_review" } });
  await createApprovalQueueItem({
    userId,
    jobId: application.jobId,
    applicationId,
    riskWarnings: [...(generated.riskWarnings ?? []), ...risk.warnings],
    recommendedAction: risk.allowedAction,
    generatedPayload: { emailApplicationId: emailApplication.id, subject: emailApplication.subject, body: emailApplication.body }
  });
  await logAudit({ userId, action: "email_generated", entityType: "EmailApplication", entityId: emailApplication.id, source: application.job.source, metadata: { riskLevel: risk.riskLevel } });
  return { subject: emailApplication.subject, body: emailApplication.body, riskWarnings: [...(generated.riskWarnings ?? []), ...risk.warnings], emailApplication };
}

export async function sendEmailApplication(userId: string, applicationId: string, body: Record<string, unknown>) {
  const email = await (prisma as any).emailApplication.findFirst({
    where: { applicationId, userId },
    include: { application: { include: { job: true } } },
    orderBy: { createdAt: "desc" }
  });
  if (!email) throw new Error("Generate an email before sending.");
  const job = email.application.job;
  const manualSend = body.manual === true;
  const setting = await getAutomationSetting(userId);
  if (!manualSend && !setting.automationEnabled) throw new Error("Automation is disabled globally.");
  if (job.sourceType !== "direct_email" || !isAutomationAllowed(job.automationLevel, "auto_send_email")) {
    throw new Error("Backend blocked send: this source is not approved for direct email automation.");
  }
  if (!manualSend) {
    const approved = await (prisma as any).approvalQueueItem.findFirst({
      where: {
        userId,
        applicationId,
        status: "approved",
        generatedPayload: { path: ["emailApplicationId"], equals: email.id }
      }
    });
    if (!approved) throw new Error("Approve this generated email in the approval queue before auto-send.");
  }
  const daily = await checkDailyLimit(userId, "email", job.source);
  if (!daily.allowed) throw new Error(daily.reason ?? "Daily email limit reached.");
  const cooldown = await checkCooldown(userId);
  if (!cooldown.allowed) throw new Error(cooldown.reason ?? "Cooldown active.");
  const emailSettings = await getEmailSetting(userId);
  const subject = typeof body.subject === "string" ? body.subject : email.subject;
  const emailBody = typeof body.body === "string" ? body.body : email.body;
  const delivery = await deliverEmail({
    to: email.to,
    cc: email.cc ?? [],
    subject,
    body: emailBody,
    replyTo: emailSettings.replyToEmail
  });
  const status = manualSend ? "sent" : "sent";
  const sentAt = new Date();
  const updated = await (prisma as any).emailApplication.update({
    where: { id: email.id },
    data: {
      subject,
      body: emailBody,
      status,
      sentAt
    }
  });
  await (prisma as any).application.update({
    where: { id: applicationId },
    data: { status: "APPLIED", appliedDate: sentAt, submittedAt: sentAt, automationUsed: !manualSend, approvalStatus: "sent" }
  });
  await logAudit({ userId, action: "email_sent", entityType: "EmailApplication", entityId: email.id, source: job.source, metadata: { manualSend, remainingDailyEmails: daily.remaining - 1, delivery } });
  return updated;
}

export async function listEmailApplications(userId: string, applicationId: string) {
  return (prisma as any).emailApplication.findMany({ where: { userId, applicationId }, orderBy: { createdAt: "desc" } });
}

function fallbackApplicationEmail(input: { candidateName: string; role: string; company: string; signature: string; resumeText: string }): GeneratedApplicationEmail {
  const subject = `Application for ${input.role} - ${input.candidateName}`;
  const body = [
    `Hello,`,
    ``,
    `I am writing to apply for the ${input.role} role at ${input.company}. My resume is attached for your review, and I would welcome the chance to discuss how my background aligns with the needs of the team.`,
    ``,
    `Thank you for your time and consideration.`,
    input.signature ? `\n${input.signature}` : `\n${input.candidateName}`
  ].join("\n");
  const riskWarnings = input.resumeText.trim() ? [] : ["Resume text is missing; review before sending."];
  return { subject, body, riskWarnings };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
