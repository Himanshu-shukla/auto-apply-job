import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export type ExtensionTokenRow = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
};

export type AnswerTemplateRow = {
  id: string;
  userId: string;
  label: string;
  questionType: string;
  answer: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function createExtensionTokenRecord(userId: string, tokenHash: string): Promise<ExtensionTokenRow> {
  const id = crypto.randomUUID();
  const rows = await prisma.$queryRaw<ExtensionTokenRow[]>`
    INSERT INTO "ExtensionToken" ("id", "userId", "tokenHash")
    VALUES (${id}, ${userId}, ${tokenHash})
    RETURNING "id", "userId", "tokenHash", "createdAt", "revokedAt", "lastUsedAt"
  `;
  return rows[0];
}

export async function findExtensionTokenByHash(tokenHash: string): Promise<ExtensionTokenRow | null> {
  const rows = await prisma.$queryRaw<ExtensionTokenRow[]>`
    SELECT "id", "userId", "tokenHash", "createdAt", "revokedAt", "lastUsedAt"
    FROM "ExtensionToken"
    WHERE "tokenHash" = ${tokenHash}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function touchExtensionToken(id: string): Promise<void> {
  await prisma.$executeRaw`UPDATE "ExtensionToken" SET "lastUsedAt" = NOW() WHERE "id" = ${id}`;
}

export async function revokeExtensionTokens(userId: string, id?: string): Promise<number> {
  if (id) {
    return prisma.$executeRaw`
      UPDATE "ExtensionToken" SET "revokedAt" = NOW()
      WHERE "id" = ${id} AND "userId" = ${userId} AND "revokedAt" IS NULL
    `;
  }
  return prisma.$executeRaw`
    UPDATE "ExtensionToken" SET "revokedAt" = NOW()
    WHERE "userId" = ${userId} AND "revokedAt" IS NULL
  `;
}

export async function listAnswerTemplates(userId: string): Promise<AnswerTemplateRow[]> {
  return prisma.$queryRaw<AnswerTemplateRow[]>`
    SELECT "id", "userId", "label", "questionType", "answer", "createdAt", "updatedAt"
    FROM "AnswerTemplate"
    WHERE "userId" = ${userId}
    ORDER BY "updatedAt" DESC
  `;
}

export async function createAnswerTemplate(userId: string, label: string, questionType: string, answer: string): Promise<AnswerTemplateRow> {
  const id = crypto.randomUUID();
  const rows = await prisma.$queryRaw<AnswerTemplateRow[]>`
    INSERT INTO "AnswerTemplate" ("id", "userId", "label", "questionType", "answer", "updatedAt")
    VALUES (${id}, ${userId}, ${label}, ${questionType}, ${answer}, NOW())
    RETURNING "id", "userId", "label", "questionType", "answer", "createdAt", "updatedAt"
  `;
  return rows[0];
}

export async function findAnswerTemplate(id: string, userId: string): Promise<AnswerTemplateRow | null> {
  const rows = await prisma.$queryRaw<AnswerTemplateRow[]>`
    SELECT "id", "userId", "label", "questionType", "answer", "createdAt", "updatedAt"
    FROM "AnswerTemplate"
    WHERE "id" = ${id} AND "userId" = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function updateAnswerTemplate(id: string, label: string, questionType: string, answer: string): Promise<AnswerTemplateRow> {
  const rows = await prisma.$queryRaw<AnswerTemplateRow[]>`
    UPDATE "AnswerTemplate"
    SET "label" = ${label}, "questionType" = ${questionType}, "answer" = ${answer}, "updatedAt" = NOW()
    WHERE "id" = ${id}
    RETURNING "id", "userId", "label", "questionType", "answer", "createdAt", "updatedAt"
  `;
  return rows[0];
}

export async function deleteAnswerTemplate(id: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "AnswerTemplate" WHERE "id" = ${id}`;
}

export async function setJobExtensionFields(jobId: string, fields: { sourcePlatform?: string; capturedFromExtension?: boolean; originalPageUrl?: string }) {
  await prisma.$executeRaw`
    UPDATE "Job"
    SET "sourcePlatform" = ${fields.sourcePlatform ?? null},
        "capturedFromExtension" = ${fields.capturedFromExtension ?? false},
        "originalPageUrl" = ${fields.originalPageUrl ?? null}
    WHERE "id" = ${jobId}
  `;
}

export async function getJobPhase2Fields(jobIds: string[]): Promise<Record<string, { sourcePlatform: string | null; capturedFromExtension: boolean; originalPageUrl: string | null }>> {
  if (!jobIds.length) return {};
  const rows = await prisma.$queryRaw<Array<{ id: string; sourcePlatform: string | null; capturedFromExtension: boolean; originalPageUrl: string | null }>>`
    SELECT "id", "sourcePlatform", "capturedFromExtension", "originalPageUrl"
    FROM "Job"
    WHERE "id" = ANY(${jobIds})
  `;
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

export async function setApplicationExtensionFields(applicationId: string, fields: { appliedViaExtension?: boolean; submittedAt?: Date | null }) {
  await prisma.$executeRaw`
    UPDATE "Application"
    SET "appliedViaExtension" = COALESCE(${fields.appliedViaExtension ?? null}, "appliedViaExtension"),
        "submittedAt" = COALESCE(${fields.submittedAt ?? null}, "submittedAt")
    WHERE "id" = ${applicationId}
  `;
}

export async function getApplicationPhase2Fields(applicationIds: string[]): Promise<Record<string, { appliedViaExtension: boolean; submittedAt: Date | null }>> {
  if (!applicationIds.length) return {};
  const rows = await prisma.$queryRaw<Array<{ id: string; appliedViaExtension: boolean; submittedAt: Date | null }>>`
    SELECT "id", "appliedViaExtension", "submittedAt"
    FROM "Application"
    WHERE "id" = ANY(${applicationIds})
  `;
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

export async function createAutofillLog(input: {
  applicationId: string;
  pageUrl: string;
  sourcePlatform?: string | null;
  filledFields: unknown;
  skippedFields: unknown;
}) {
  await prisma.$executeRaw`
    INSERT INTO "AutofillLog" ("id", "applicationId", "pageUrl", "sourcePlatform", "filledFields", "skippedFields")
    VALUES (${crypto.randomUUID()}, ${input.applicationId}, ${input.pageUrl}, ${input.sourcePlatform ?? null}, ${JSON.stringify(input.filledFields)}::jsonb, ${JSON.stringify(input.skippedFields)}::jsonb)
  `;
}

export async function createApplicationAnswer(input: {
  applicationId: string;
  question: string;
  generatedAnswer: string;
  finalAnswer?: string | null;
  needsConfirmation: boolean;
}) {
  await prisma.$executeRaw`
    INSERT INTO "ApplicationAnswer" ("id", "applicationId", "question", "generatedAnswer", "finalAnswer", "needsConfirmation")
    VALUES (${crypto.randomUUID()}, ${input.applicationId}, ${input.question}, ${input.generatedAnswer}, ${input.finalAnswer ?? null}, ${input.needsConfirmation})
  `;
}

export async function listApplicationAnswers(applicationId: string) {
  return prisma.$queryRaw<any[]>`
    SELECT "id", "applicationId", "question", "generatedAnswer", "finalAnswer", "needsConfirmation", "createdAt"
    FROM "ApplicationAnswer"
    WHERE "applicationId" = ${applicationId}
    ORDER BY "createdAt" DESC
  `;
}

export async function listAutofillLogs(applicationId: string) {
  return prisma.$queryRaw<any[]>`
    SELECT "id", "applicationId", "pageUrl", "sourcePlatform", "filledFields", "skippedFields", "createdAt"
    FROM "AutofillLog"
    WHERE "applicationId" = ${applicationId}
    ORDER BY "createdAt" DESC
  `;
}
