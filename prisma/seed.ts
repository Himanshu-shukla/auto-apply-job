import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { sampleJobs } from "../src/lib/providers/mockJobProvider";
import { parseResumeText } from "../src/lib/services/resumeParser";
import { calculateRuleBasedMatchScore } from "../src/lib/services/matchScoring";
import { classifySource, defaultAutomationLevel } from "../src/lib/services/sourcePolicy";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/ai_job_copilot?schema=public";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const sampleResumeText = `
Alex Morgan
alex.morgan@example.com
+1 555 010 2020
Remote, United States

Skills
TypeScript, JavaScript, Node.js, React, Next.js, PostgreSQL, Prisma, REST, Docker, Git, Testing

Experience
Full Stack Developer, Acme SaaS, 2021 - 2026
- Built customer-facing React and Next.js workflows backed by Node.js APIs and PostgreSQL.
- Improved release reliability with automated testing, Docker, and CI/CD.
Backend Developer, Studio Apps, 2019 - 2021
- Designed REST services and database models for subscription products.

Education
B.S. Computer Science

Projects
AI job matching dashboard using TypeScript, Prisma, and OpenAI-compatible APIs.
`;

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@jobcopilot.local" },
    update: {},
    create: {
      email: "demo@jobcopilot.local",
      name: "Demo User",
      passwordHash: "clerk-placeholder"
    }
  });

  const preferences = await prisma.jobPreference.create({
    data: {
      userId: user.id,
      targetRole: "Full Stack Developer",
      preferredLocations: ["Remote", "Austin", "Seattle"],
      remotePreference: "FLEXIBLE",
      minimumSalary: 95000,
      experienceLevel: "MID",
      jobType: "FULL_TIME",
      skillsToPrioritize: ["TypeScript", "Node.js", "React", "PostgreSQL", "Prisma"],
      skillsToAvoid: ["heavy travel"],
      sourcePreferences: ["MockJobs", "ManualImport"]
    }
  });

  await prisma.resume.updateMany({ where: { userId: user.id }, data: { isActive: false } });
  const parsedJson = parseResumeText(sampleResumeText);
  const resume = await prisma.resume.create({
    data: {
      userId: user.id,
      fileName: "sample-resume.txt",
      fileType: "text/plain",
      filePath: "/uploads/sample-resume.txt",
      rawText: sampleResumeText,
      parsedJson,
      totalExperienceYears: parsedJson.totalExperienceYears,
      isActive: true
    }
  });

  for (const normalized of sampleJobs) {
    const sourceType = classifySource(normalized);
    const automationLevel = defaultAutomationLevel(sourceType);
    const jobData = {
      title: normalized.title,
      company: normalized.company,
      location: normalized.location,
      remoteType: normalized.remoteType,
      salaryMin: normalized.salaryMin,
      salaryMax: normalized.salaryMax,
      experienceRequired: normalized.experienceRequired,
      description: normalized.description,
      applyUrl: normalized.applyUrl,
      source: normalized.source,
      postedDate: normalized.postedDate ? new Date(normalized.postedDate) : null,
      sourceType,
      automationLevel,
      riskFlags: sourceType === "unknown" ? ["Unknown source: save-only until classified."] : []
    };
    const existing = await prisma.job.findFirst({
      where: { userId: user.id, source: normalized.source, applyUrl: normalized.applyUrl }
    });
    const job = existing
      ? await prisma.job.update({
          where: { id: existing.id },
          data: { ...jobData, userId: user.id }
        })
      : await prisma.job.create({
          data: { ...jobData, userId: user.id }
        });

    const score = calculateRuleBasedMatchScore(parsedJson, job, preferences);
    await prisma.jobMatchScore.create({ data: { ...score, jobId: job.id, resumeId: resume.id } });
    await prisma.application.upsert({
      where: { userId_jobId: { userId: user.id, jobId: job.id } },
      update: { sourceUrl: job.applyUrl },
      create: { userId: user.id, jobId: job.id, sourceUrl: job.applyUrl, status: "SAVED" }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seeded demo user, preferences, resume, jobs, match scores, and tracker records.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
