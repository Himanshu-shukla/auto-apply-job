import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractResumeText, parseResumeText } from "@/lib/services/resumeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_RESUME_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Resume file is required." }, { status: 400 });
    }

    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"];
    const fileName = file.name || "resume";
    if (!allowed.includes(file.type) && !/\.(pdf|docx|doc)$/i.test(fileName)) {
      return NextResponse.json({ error: "Please upload a PDF or DOCX resume." }, { status: 400 });
    }
    if (file.size > MAX_RESUME_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Resume file must be 5MB or smaller." }, { status: 400 });
    }

    const user = await getCurrentUser();
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = path.join(uploadDir, safeName);
    await writeFile(filePath, buffer);

    const rawText = await extractResumeText(buffer, fileName, file.type);
    const parsedJson = parseResumeText(rawText);

    await prisma.resume.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false }
    });

    const resume = await prisma.resume.create({
      data: {
        userId: user.id,
        fileName,
        fileType: file.type || path.extname(fileName).replace(".", ""),
        filePath: `/uploads/${safeName}`,
        rawText,
        parsedJson,
        totalExperienceYears: parsedJson.totalExperienceYears,
        isActive: true
      }
    });

    return NextResponse.json({ resume });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not parse resume." }, { status: 500 });
  }
}
