import { prisma } from "@/lib/prisma";
import { generateAIResponse } from "@/lib/ai";
import { logAudit } from "@/lib/services/audit";
import { deliverEmail } from "@/lib/services/emailDelivery";
import { checkCooldown, checkDailyLimit } from "@/lib/services/rateLimits";
import { getAutomationSetting, getEmailSetting } from "@/lib/services/settings";
import { isAutomationAllowed } from "@/lib/services/sourcePolicy";

const blockedStatuses = ["REJECTED", "INTERVIEW", "OFFER"];

export function canFollowUpStatus(status: string, userDisabled = false) {
  return !userDisabled && !blockedStatuses.includes(status);
}

export async function listDueFollowUps(userId: string) {
  await createMissingFollowUps(userId);
  return (prisma as any).followUp.findMany({
    where: { userId, status: { in: ["due", "pending_review", "approved"] }, dueDate: { lte: new Date() } },
    include: { application: { include: { job: true } }, emailApplication: true },
    orderBy: { dueDate: "asc" }
  });
}

export async function createMissingFollowUps(userId: string, days = 7) {
  const candidates = await (prisma as any).emailApplication.findMany({
    where: {
      userId,
      status: "sent",
      followUpDate: { lte: new Date() },
      application: { status: { notIn: blockedStatuses } }
    },
    include: { application: true }
  });
  for (const email of candidates) {
    const existing = await (prisma as any).followUp.findFirst({ where: { userId, emailApplicationId: email.id } });
    if (!existing) {
      await (prisma as any).followUp.create({
        data: {
          userId,
          applicationId: email.applicationId,
          emailApplicationId: email.id,
          dueDate: email.followUpDate ?? addDays(email.sentAt ?? new Date(), days),
          status: "due"
        }
      });
      await logAudit({ userId, action: "follow_up_generated", entityType: "EmailApplication", entityId: email.id });
    }
  }
}

export async function generateFollowUpEmail(userId: string, followUpId: string) {
  const followUp = await (prisma as any).followUp.findFirst({
    where: { id: followUpId, userId },
    include: { application: { include: { job: true } }, emailApplication: true }
  });
  if (!followUp) throw new Error("Follow-up not found.");
  if (!canFollowUpStatus(followUp.application.status)) throw new Error("Follow-ups are disabled for this application status.");
  const emailSettings = await getEmailSetting(userId);
  const daysSince = Math.max(1, Math.round((Date.now() - new Date(followUp.emailApplication?.sentAt ?? followUp.application.appliedDate ?? followUp.createdAt).getTime()) / 86400000));
  const fallback = {
    subject: `Following up on ${followUp.application.job.title}`,
    body: [
      "Hello,",
      "",
      `I wanted to politely follow up on my application for the ${followUp.application.job.title} role. I remain interested in the opportunity and would be grateful for any update when convenient.`,
      "",
      "Thank you for your time.",
      emailSettings.emailSignature ? `\n${emailSettings.emailSignature}` : ""
    ].join("\n")
  };
  const ai = await generateAIResponse<{ subject: string; body: string }>(
    "Generate a short, polite follow-up email. Do not add new facts or pressure. Return JSON.",
    JSON.stringify({
      application: { role: followUp.application.job.title, company: followUp.application.job.company, status: followUp.application.status },
      previousEmail: followUp.emailApplication?.body ?? "",
      daysSinceApplication: daysSince,
      template: emailSettings.followUpTemplate
    }),
    { subject: "string", body: "string" }
  );
  const generated = typeof ai === "object" && ai && "subject" in ai ? ai : fallback;
  const updated = await (prisma as any).followUp.update({
    where: { id: followUp.id },
    data: { subject: generated.subject || fallback.subject, body: generated.body || fallback.body, status: "pending_review" }
  });
  await logAudit({ userId, action: "follow_up_generated", entityType: "FollowUp", entityId: followUp.id });
  return updated;
}

export async function sendFollowUp(userId: string, followUpId: string) {
  const followUp = await (prisma as any).followUp.findFirst({
    where: { id: followUpId, userId },
    include: { application: { include: { job: true } }, emailApplication: true }
  });
  if (!followUp) throw new Error("Follow-up not found.");
  if (!canFollowUpStatus(followUp.application.status)) throw new Error("Follow-up blocked for current application status.");
  const setting = await getAutomationSetting(userId);
  if (!setting.automationEnabled) throw new Error("Automation is disabled globally.");
  if (followUp.application.job.sourceType !== "direct_email" || !isAutomationAllowed(followUp.application.job.automationLevel, "auto_send_email")) {
    throw new Error("Follow-up auto-send is only allowed for approved direct-email jobs.");
  }
  const daily = await checkDailyLimit(userId, "follow_up", followUp.application.job.source);
  if (!daily.allowed) throw new Error(daily.reason ?? "Follow-up daily limit reached.");
  const cooldown = await checkCooldown(userId);
  if (!cooldown.allowed) throw new Error(cooldown.reason ?? "Cooldown active.");
  const emailSettings = await getEmailSetting(userId);
  const to = followUp.emailApplication?.to ?? followUp.application.job.recruiterEmail;
  if (!to) throw new Error("No recipient is stored for this follow-up.");
  const delivery = await deliverEmail({
    to,
    subject: followUp.subject ?? `Following up on ${followUp.application.job.title}`,
    body: followUp.body ?? "",
    replyTo: emailSettings.replyToEmail
  });
  const sentAt = new Date();
  const updated = await (prisma as any).followUp.update({ where: { id: followUp.id }, data: { status: "sent", sentAt } });
  await (prisma as any).application.update({ where: { id: followUp.applicationId }, data: { lastFollowUpAt: sentAt } });
  await logAudit({ userId, action: "follow_up_sent", entityType: "FollowUp", entityId: followUp.id, metadata: { delivery } });
  return updated;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
