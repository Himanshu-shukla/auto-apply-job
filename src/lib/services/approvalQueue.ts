import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/services/audit";
import { createNotification } from "@/lib/services/notifications";

export async function createApprovalQueueItem(input: {
  userId: string;
  jobId: string;
  applicationId?: string | null;
  riskWarnings: string[];
  recommendedAction: string;
  generatedPayload: unknown;
}) {
  const item = await (prisma as any).approvalQueueItem.create({
    data: {
      userId: input.userId,
      jobId: input.jobId,
      applicationId: input.applicationId ?? null,
      riskWarnings: input.riskWarnings,
      recommendedAction: input.recommendedAction,
      generatedPayload: input.generatedPayload ?? {}
    }
  });
  await createNotification({
    userId: input.userId,
    type: "approval_pending",
    title: "Application pending approval",
    message: "Review the generated application before anything is sent.",
    link: "/approval-queue"
  });
  await logAudit({ userId: input.userId, action: "user_approved", entityType: "ApprovalQueueItem", entityId: item.id, metadata: { status: "pending_review", createdOnly: true } });
  return item;
}

export async function listApprovalQueue(userId: string) {
  return (prisma as any).approvalQueueItem.findMany({
    where: { userId },
    include: { job: { include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } } }, application: true },
    orderBy: { createdAt: "desc" }
  });
}

export async function approveQueueItem(userId: string, id: string) {
  await (prisma as any).approvalQueueItem.updateMany({ where: { id, userId }, data: { status: "approved", approvedAt: new Date() } });
  const item = await (prisma as any).approvalQueueItem.findFirst({ where: { id, userId } });
  if (!item) throw new Error("Approval item not found.");
  await logAudit({ userId, action: "user_approved", entityType: "ApprovalQueueItem", entityId: id, metadata: { status: "approved" } });
  return item;
}

export async function rejectQueueItem(userId: string, id: string) {
  await (prisma as any).approvalQueueItem.updateMany({ where: { id, userId }, data: { status: "rejected" } });
  const item = await (prisma as any).approvalQueueItem.findFirst({ where: { id, userId } });
  if (!item) throw new Error("Approval item not found.");
  await logAudit({ userId, action: "automation_blocked", entityType: "ApprovalQueueItem", entityId: id, metadata: { status: "rejected_by_user" } });
  return item;
}
