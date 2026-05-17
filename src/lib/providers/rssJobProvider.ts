import type { JobProvider } from "@/lib/providers/types";
import type { JobPreferenceInput, NormalizedJob } from "@/lib/types";
import { defaultAutomationLevel } from "@/lib/services/sourcePolicy";

export class RSSJobProvider implements JobProvider {
  sourceName = "RSSJobFeed";
  capabilities = {
    canSearch: true,
    canCapture: true,
    canAssistedApply: true,
    canSubmit: false,
    requiresCredential: false,
    restrictedReason: "RSS feeds can source jobs, but applications happen on the destination site."
  };

  async searchJobs(preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
    const feeds = (process.env.JOB_RSS_FEEDS ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    if (!feeds.length) return [];
    const results = await Promise.all(feeds.map((feed) => fetchFeed(feed, preferences).catch(() => [])));
    return results.flat();
  }

  normalizeJob(rawJob: unknown): NormalizedJob {
    return rawJob as NormalizedJob;
  }

  classifySource() {
    return "partner_feed" as const;
  }

  getAutomationLevel() {
    return defaultAutomationLevel("partner_feed");
  }
}

async function fetchFeed(feedUrl: string, preferences: JobPreferenceInput): Promise<NormalizedJob[]> {
  const response = await fetch(feedUrl, { headers: { "User-Agent": "AI Job Application Copilot RSS Provider" } });
  if (!response.ok) throw new Error(`RSS feed failed: ${response.status}`);
  const xml = await response.text();
  return parseRss(xml, feedUrl).filter((job) => matchesPreferences(job, preferences)).slice(0, 25);
}

export function parseRss(xml: string, feedUrl = "RSSJobFeed"): NormalizedJob[] {
  const blocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  return blocks.map((block, index) => {
    const title = readTag(block, "title") || "RSS Job";
    const link = readTag(block, "link") || readAtomLink(block) || `${feedUrl}#${index}`;
    const description = stripTags(readTag(block, "description") || readTag(block, "summary") || readTag(block, "content") || title);
    const company = readTag(block, "company") || readTag(block, "author") || inferCompany(title);
    const location = readTag(block, "location") || "Not specified";
    return {
      title: title.replace(/\s+[-|@]\s+.*$/, "").trim() || title,
      company,
      location,
      remoteType: /remote/i.test(`${title} ${description} ${location}`) ? "REMOTE" : "FLEXIBLE",
      salaryMin: null,
      salaryMax: null,
      experienceRequired: Number(description.match(/(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)/i)?.[1] ?? 0) || null,
      description,
      applyUrl: link,
      source: "RSSJobFeed",
      sourceType: "partner_feed",
      automationLevel: "save_only",
      postedDate: readTag(block, "pubDate") || readTag(block, "updated") || new Date().toISOString()
    };
  });
}

function matchesPreferences(job: NormalizedJob, preferences: JobPreferenceInput): boolean {
  const terms = [preferences.targetRole, ...preferences.skillsToPrioritize].map((term) => term.toLowerCase()).filter(Boolean);
  if (!terms.length) return true;
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function readTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<[^>]*${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*${tag}>`, "i"));
  return decodeXml(stripCdata(match?.[1] ?? "")).trim();
}

function readAtomLink(block: string): string {
  return decodeXml(block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? "").trim();
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function stripTags(value: string): string {
  return decodeXml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function inferCompany(title: string): string {
  return title.match(/\s(?:at|@)\s(.+)$/i)?.[1]?.trim() || "RSS Company";
}
