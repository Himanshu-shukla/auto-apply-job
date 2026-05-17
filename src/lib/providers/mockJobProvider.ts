import type { JobProvider } from "@/lib/providers/types";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";
import { includesTerm } from "@/lib/services/text";

const sampleJobs: NormalizedJob[] = [
  {
    title: "Backend Developer",
    company: "Northstar Payroll",
    location: "Austin, TX",
    remoteType: "HYBRID",
    salaryMin: 105000,
    salaryMax: 135000,
    experienceRequired: 3,
    description:
      "Build Node.js APIs with PostgreSQL, Prisma, REST services, CI/CD, Docker, and secure authentication for payroll workflows.",
    applyUrl: "https://careers.example.com/northstar/backend-developer",
    source: "MockJobs",
    postedDate: new Date()
  },
  {
    title: "Node.js Developer",
    company: "LedgerCloud",
    location: "Remote",
    remoteType: "REMOTE",
    salaryMin: 95000,
    salaryMax: 125000,
    experienceRequired: 2,
    description:
      "Own TypeScript and Node.js services, GraphQL endpoints, Redis queues, PostgreSQL persistence, and automated testing.",
    applyUrl: "https://careers.example.com/ledgercloud/nodejs-developer",
    source: "MockJobs",
    postedDate: new Date()
  },
  {
    title: "Data Analyst",
    company: "BrightCart",
    location: "New York, NY",
    remoteType: "HYBRID",
    salaryMin: 80000,
    salaryMax: 105000,
    experienceRequired: 2,
    description:
      "Analyze product funnels using SQL, Excel, Tableau, Power BI, experimentation data, and stakeholder-ready dashboards.",
    applyUrl: "https://careers.example.com/brightcart/data-analyst",
    source: "MockJobs",
    postedDate: new Date()
  },
  {
    title: "Frontend Developer",
    company: "Muse Studio",
    location: "Remote",
    remoteType: "REMOTE",
    salaryMin: 90000,
    salaryMax: 120000,
    experienceRequired: 2,
    description:
      "Create accessible React, Next.js, TypeScript, Tailwind, HTML, and CSS interfaces with excellent UX polish.",
    applyUrl: "https://careers.example.com/musestudio/frontend-developer",
    source: "MockJobs",
    postedDate: new Date()
  },
  {
    title: "Full Stack Developer",
    company: "CarePilot",
    location: "San Francisco, CA",
    remoteType: "FLEXIBLE",
    salaryMin: 120000,
    salaryMax: 160000,
    experienceRequired: 4,
    description:
      "Ship full stack features across Next.js, React, Node.js, PostgreSQL, Prisma, REST APIs, testing, and cloud deployment.",
    applyUrl: "https://careers.example.com/carepilot/full-stack-developer",
    source: "MockJobs",
    postedDate: new Date()
  },
  {
    title: "AI Engineer",
    company: "PromptWorks",
    location: "Seattle, WA",
    remoteType: "HYBRID",
    salaryMin: 135000,
    salaryMax: 180000,
    experienceRequired: 3,
    description:
      "Prototype LLM products with OpenAI-compatible APIs, Python, TypeScript, evaluation pipelines, PostgreSQL, and safety reviews.",
    applyUrl: "https://careers.example.com/promptworks/ai-engineer",
    source: "MockJobs",
    postedDate: new Date()
  },
  {
    title: "DevOps Engineer",
    company: "HarborOps",
    location: "Remote",
    remoteType: "REMOTE",
    salaryMin: 115000,
    salaryMax: 150000,
    experienceRequired: 4,
    description:
      "Maintain AWS infrastructure, Docker, Kubernetes, Linux systems, CI/CD pipelines, observability, and incident response.",
    applyUrl: "https://careers.example.com/harborops/devops-engineer",
    source: "MockJobs",
    postedDate: new Date()
  },
  {
    title: "Product Analyst",
    company: "MetricNest",
    location: "Chicago, IL",
    remoteType: "ONSITE",
    salaryMin: 85000,
    salaryMax: 115000,
    experienceRequired: 2,
    description:
      "Partner with product teams using SQL, analytics, experimentation, dashboards, Excel, and concise executive storytelling.",
    applyUrl: "https://careers.example.com/metricnest/product-analyst",
    source: "MockJobs",
    postedDate: new Date()
  },
  {
    title: "QA Engineer",
    company: "ShipSure",
    location: "Remote",
    remoteType: "REMOTE",
    salaryMin: 75000,
    salaryMax: 100000,
    experienceRequired: 2,
    description:
      "Design QA strategy with automated testing, Playwright, Jest, regression plans, API testing, and release quality reporting.",
    applyUrl: "https://careers.example.com/shipsure/qa-engineer",
    source: "MockJobs",
    postedDate: new Date()
  },
  {
    title: "Technical Support Engineer",
    company: "StackBridge",
    location: "Denver, CO",
    remoteType: "HYBRID",
    salaryMin: 70000,
    salaryMax: 92000,
    experienceRequired: 1,
    description:
      "Resolve customer issues across Linux, SQL, REST APIs, logs, support workflows, troubleshooting, and clear technical writing.",
    applyUrl: "https://careers.example.com/stackbridge/technical-support-engineer",
    source: "MockJobs",
    postedDate: new Date()
  }
];

export class MockJobProvider implements JobProvider<NormalizedJob> {
  sourceName = "MockJobs";
  capabilities = {
    canSearch: true,
    canCapture: true,
    canAssistedApply: true,
    canSubmit: false,
    requiresCredential: false,
    restrictedReason: "Mock jobs are for local testing and cannot be submitted."
  };

  async searchJobs(preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
    const terms = [
      preferences.targetRole,
      ...preferences.skillsToPrioritize,
      ...preferences.preferredLocations
    ].filter(Boolean);

    const filtered = sampleJobs.filter((job) => {
      const haystack = `${job.title} ${job.location} ${job.description}`;
      return terms.length === 0 || terms.some((term) => includesTerm(haystack, term));
    });

    return filtered.length >= 3 ? filtered : sampleJobs;
  }

  normalizeJob(rawJob: NormalizedJob): NormalizedJob {
    return rawJob;
  }
}

export { sampleJobs };
