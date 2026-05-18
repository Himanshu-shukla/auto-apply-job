import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthContext, validateExtensionRequest } from "@/lib/services/extensionAuth";
import { listAnswerTemplates } from "@/lib/services/phase2Storage";
import { extensionProfileFromSources, getApplicantProfile } from "@/lib/services/applicantProfile";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await validateExtensionRequest(request);
  if (!isAuthContext(auth)) return auth;

  const [user, resume, preferences, templates] = await Promise.all([
    prisma.user.findUnique({ where: { id: auth.userId }, select: { id: true, email: true, name: true } }),
    prisma.resume.findFirst({ where: { userId: auth.userId, isActive: true }, orderBy: { createdAt: "desc" } }),
    prisma.jobPreference.findFirst({ where: { userId: auth.userId }, orderBy: { updatedAt: "desc" } }),
    listAnswerTemplates(auth.userId)
  ]);
  const profileRecord = await getApplicantProfile(auth.userId);

  return NextResponse.json({
    profile: extensionProfileFromSources({
      user,
      profile: profileRecord,
      resume,
      preferences,
      noticePeriod: templateAnswer(templates, "notice_period")
    }),
    resume: resume
      ? {
          id: resume.id,
          fileName: resume.fileName,
          fileType: resume.fileType,
          totalExperienceYears: resume.totalExperienceYears,
          createdAt: resume.createdAt,
          downloadUrl: resume.filePath
        }
      : null,
    preferences,
    answerTemplates: templates.map((template: any) => ({
      id: template.id,
      label: template.label,
      questionType: template.questionType,
      answer: template.answer,
      updatedAt: template.updatedAt
    }))
  });
}

function templateAnswer(templates: Array<{ questionType: string; answer: string }>, type: string): string {
  return templates.find((template) => template.questionType === type)?.answer ?? "";
}
