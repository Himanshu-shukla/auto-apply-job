import { prisma } from "@/lib/prisma";

export async function logAudit(input: {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  source?: string | null;
  metadata?: unknown;
}) {
  return (prisma as any).auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      source: input.source ?? null,
      metadata: input.metadata ?? {}
    }
  });
}

export async function listAuditLogs(userId: string, take = 100) {
  return (prisma as any).auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take
  });
}
