import { prisma } from "@/lib/prisma";
import type { ParsedResume } from "@/lib/types";
import { logAudit } from "@/lib/services/audit";

export async function ensureDefaultResumeVersion(userId: string) {
  const existing = await (prisma as any).resumeVersion.findFirst({ where: { userId, isDefault: true } });
  if (existing) return existing;
  const resume = await prisma.resume.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "desc" } });
  if (!resume) return null;
  return createResumeVersion(userId, {
    resumeId: resume.id,
    name: "Default resume",
    targetRole: null,
    fileUrl: resume.filePath,
    rawText: resume.rawText,
    parsedJson: resume.parsedJson as ParsedResume,
    isDefault: true
  });
}

export async function createResumeVersion(userId: string, input: {
  resumeId?: string | null;
  name: string;
  targetRole?: string | null;
  fileUrl?: string | null;
  rawText: string;
  parsedJson: unknown;
  isDefault?: boolean;
}) {
  if (input.isDefault) {
    await (prisma as any).resumeVersion.updateMany({ where: { userId }, data: { isDefault: false } });
  }
  const version = await (prisma as any).resumeVersion.create({
    data: {
      userId,
      resumeId: input.resumeId ?? null,
      name: input.name.trim().slice(0, 120),
      targetRole: input.targetRole?.trim() || null,
      fileUrl: input.fileUrl ?? null,
      rawText: input.rawText,
      parsedJson: input.parsedJson ?? {},
      isDefault: Boolean(input.isDefault)
    }
  });
  await logAudit({ userId, action: "resume_version_selected", entityType: "ResumeVersion", entityId: version.id, metadata: { isDefault: version.isDefault } });
  return version;
}

export async function listResumeVersions(userId: string) {
  await ensureDefaultResumeVersion(userId);
  return (prisma as any).resumeVersion.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
}

export async function setDefaultResumeVersion(userId: string, id: string) {
  await (prisma as any).resumeVersion.updateMany({ where: { userId }, data: { isDefault: false } });
  const updated = await (prisma as any).resumeVersion.update({ where: { id }, data: { isDefault: true } });
  await logAudit({ userId, action: "resume_version_selected", entityType: "ResumeVersion", entityId: id, metadata: { isDefault: true } });
  return updated;
}
