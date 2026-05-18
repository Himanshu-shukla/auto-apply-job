# AI Job Application Copilot

Phase 3 assisted-apply SaaS for uploading resume versions, saving job preferences, sourcing safe jobs, scoring fit, generating truthful application content, reviewing bulk application campaigns, sending approved direct-email/API applications, scheduling follow-ups, and tracking analytics. The Chrome extension helps users fill selected form fields after review; unsafe automation is blocked server-side.

## Stack

- Next.js 14 App Router
- PostgreSQL + Prisma
- Tailwind CSS
- Local file storage for resume uploads
- `pdf-parse` and `mammoth` for resume text extraction
- OpenAI-compatible AI wrapper with graceful fallback when no API key is configured
- Provider-based job search with mock jobs, RSS feeds, Greenhouse, Lever, Ashby, company career pages, restricted-platform capture adapters, and manual import
- Manifest V3 Chrome extension in `extension/`
- Revocable extension API tokens stored as SHA-256 hashes
- Controlled bulk campaigns, automation rules, source policy, approval queue, rate limits, audit logs, and notification center

## Setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run seed
npm run dev
```

Open `http://localhost:3000`.

## Phase 3 Setup

Run the Phase 3 migration and regenerate the Prisma client:

```bash
npx prisma migrate dev
npm run prisma:generate
npm run seed
```

Key pages:

- `/campaigns` for 50/100/500-job bulk review queues
- `/profile` for structured applicant details used by extension autofill and queue runs
- `/automation` for automation rules and daily quota visibility
- `/sources` for allowed company domains, direct-email sources, official APIs, and partner feeds
- `/approval-queue` for generated applications requiring review
- `/resume-versions` for targeted resume versions
- `/follow-ups` for due follow-up reminders and drafts
- `/analytics` for funnel, source, resume, and weekly application metrics
- `/settings/automation` and `/settings/email` for user controls
- `/notifications` and `/audit-logs` for operational visibility

## Chrome Extension Setup

1. Run the web app locally.
2. Open `/settings/extension`.
3. Click **Generate Token** and copy the token.
4. In Chrome, open `chrome://extensions`.
5. Enable **Developer mode**.
6. Click **Load unpacked** and select this repo's `extension/` folder.
7. Open the Job Copilot extension popup, keep Backend URL as `http://localhost:3000`, paste the token, and click **Connect**.

The extension token is stored in `chrome.storage.local`. The backend stores only `tokenHash`, not the plaintext token. Use `/settings/extension` to revoke active tokens.

## Environment

Set `DATABASE_URL` to a PostgreSQL database. AI features use deterministic local fallbacks unless `OPENAI_API_KEY` is present. Email sending is modeled and logged in-app; wire a real transactional provider behind `src/lib/services/emailApplications.ts` before production sends.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_job_copilot?schema=public"
OPENAI_API_KEY=""
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4o-mini"
EMAIL_PROVIDER="log"
EMAIL_FROM="applications@example.com"
RESEND_API_KEY=""
SENDGRID_API_KEY=""
JOB_RSS_FEEDS=""
GREENHOUSE_BOARD_TOKENS=""
GREENHOUSE_JOB_BOARD_API_KEY=""
LEVER_SITE_NAMES=""
LEVER_API_KEY=""
ASHBY_BOARD_NAMES=""
```

`EMAIL_PROVIDER=log` records delivery in audit logs for local development. Use `resend` or `sendgrid` with the matching API key and verified `EMAIL_FROM` for real delivery.

Greenhouse, Lever, and Ashby search adapters use official public ATS endpoints when board/site names are configured. Greenhouse and Lever submission remain disabled unless official API keys are provided. LinkedIn, Indeed, Glassdoor, ZipRecruiter, Naukri, Monster, and similar restricted platforms stay assisted-only without explicit official access.

## Bulk Campaign Flow

1. Upload an active resume and save job preferences.
2. Configure allowed sources at `/sources`; restricted platforms do not become auto-submit sources.
3. Open `/campaigns`, choose 50, 100, or 500 jobs, set a minimum match score, and create the queue.
4. The campaign imports provider jobs, dedupes them, scores them, applies automation rules, and prepares review packets.
5. Review each queued job, then approve or skip it.
6. Start the campaign and click **Run Next** to process one approved item at a time.
7. Direct-email and official API jobs can submit only when source policy, credentials, approval, daily limits, and cooldown checks pass.
8. Company career pages use the extension multi-step assistant. Final submit is clicked only for explicitly allowed `one_click_apply` domains.
9. Restricted or unknown sources are blocked from backend and extension final submit; open them for assisted apply only.

## Assisted Apply Flow

1. Upload a PDF or DOCX resume at `/resume`.
2. Review parsed resume data, then complete structured details at `/profile`.
3. Save preferences at `/preferences`.
4. Save answer templates at `/answer-templates` for notice period, salary expectation, relocation, work authorization, introduction, and common short answers.
5. Open a job page in Chrome.
6. Use the extension **Current Job** tab to capture the job and generate a match score.
7. Use **Autofill** to inspect detected fields, adjust mappings, and fill selected fields only.
8. Use **Answers** to generate short, truthful answers for custom questions, edit them, then insert them.
9. For resume upload fields, click **Attach Resume** to try browser-supported file attachment from your saved resume. If the site blocks it, download the recommended resume and manually select it in the browser file picker.
10. Use **Safe Next** for allowed multi-step forms after reviewing each page.
11. Use **Policy Submit** only when the saved job's source policy allows one-click apply; otherwise submit manually.
12. Use **Tracker** in the extension to mark the application as applied when you submit yourself.
13. Review the saved record at `/tracker` or `/applications/[id]`.

## Browser Queue Flow

1. Create a campaign, review jobs, and approve the items you want to run.
2. Open the extension **Queue** tab and refresh campaigns.
3. Select a campaign and click **Start** or **Run Next**.
4. The background worker opens the next approved job, fills safe fields from `/profile`, attempts resume attachment, captures proof, and records the result.
5. Restricted platforms pause after assisted filling so you can review and submit manually.
6. Explicitly allowed company career pages can use policy submit; blocked or failed jobs can be retried from the Queue tab.

## Safety Rules

- Bulk campaigns prepare 50/100/500-job queues, but they are review-gated and source-policy-gated.
- No bypassing LinkedIn, Indeed, Glassdoor, Naukri, or similar platform restrictions.
- Restricted platforms default to assisted apply only. Unknown sources default to save only.
- Direct email can auto-send only after the source is explicitly approved and daily/cooldown limits pass.
- Official APIs can apply only when credentials and an allowed integration exist.
- Company career pages can use one-click apply only when the user explicitly marks the domain as allowed.
- No automatic third-party submit clicks unless source policy explicitly allows that workflow.
- Campaign attempts record pending, submitted, failed, and blocked states for retry/audit visibility.
- No password, OTP, CAPTCHA, SSN, payment fields, or verification steps are filled or bypassed.
- Autofill requires a visible preview and a user click.
- Application answers must not fabricate experience. Sensitive answers such as work authorization and relocation are marked for confirmation when not explicitly known.
- Autofill logs store field labels and mapping keys only, not filled values.
- Every generated/sent/blocked automation event is audit logged.
- Default limits are 10 applications/day, 10 direct emails/day, 5 follow-ups/day, and a minimum 3-minute send cooldown.

## Source Policy System

Every job has:

- `sourceType`: `restricted_platform`, `official_api`, `company_career_page`, `direct_email`, `user_imported`, `partner_feed`, or `unknown`
- `automationLevel`: `view_only`, `save_only`, `assisted_apply`, `one_click_apply`, `auto_send_email`, or `api_apply`

The backend clamps requested levels to the safe maximum for each source. UI badges show the current policy on job cards, tracker cards, applications, approvals, and sources.

Provider capabilities expose `canSearch`, `canCapture`, `canAssistedApply`, `canSubmit`, `requiresCredential`, and optional `restrictedReason` so campaigns and the extension know which actions are allowed.

## Email Applications

Direct-email jobs need a recruiter or HR email detected in the URL/description or stored on the job. The application detail page can generate, preview, edit, and send the email. A resume version is attached by reference, the generated draft enters the approval queue, and sending is blocked unless:

- the job is classified as `direct_email`
- the source policy allows `auto_send_email`
- the user has approved the queue item or explicitly performs the send flow
- daily limits and cooldown pass

The default subject format is `Application for [Role] - [Candidate Name]`, configurable at `/settings/email`.

## Follow-Up Automation

Follow-ups are created for sent direct-email applications when due. They never send for `REJECTED`, `INTERVIEW`, `OFFER`, or disabled records. Users can generate and review short follow-up drafts at `/follow-ups`; auto-send uses the same direct-email policy, daily limit, and cooldown checks.

## Adding Real Job Providers

Add a provider under `src/lib/providers` that implements:

```ts
interface JobProvider {
  sourceName: string;
  enabled?: boolean;
  capabilities?: ProviderCapabilities;
  searchJobs(preferences): Promise<NormalizedJob[]>;
  getJobDetails?(jobIdOrUrl): Promise<NormalizedJob | null>;
  getApplicationSchema?(jobIdOrUrl): Promise<ApplicationSchema | null>;
  submitApplication?(input): Promise<SubmitApplicationResult>;
  normalizeJob(rawJob): NormalizedJob;
  classifySource?(job): SourceType;
  getAutomationLevel?(sourceType, job): AutomationLevel;
}
```

Register it in `src/lib/providers/index.ts`. Keep each adapter limited to official APIs, approved RSS feeds, partner feeds, direct user imports, or career pages that explicitly permit access. Use placeholders only for unavailable third-party official APIs, and keep credentials/source-specific terms inside the provider.

## Adding a Company Career Source Safely

1. Add the company domain and career URL at `/sources`.
2. Mark it explicitly allowed only if the company workflow permits automation.
3. Start with `assisted_apply`; raise to `one_click_apply` only for configured allowed domains.
4. Import jobs manually or through an allowed feed/API.
5. Confirm the extension sees the job policy before filling forms.

## Extension APIs

All `/api/extension/*` routes require:

```http
Authorization: Bearer jacp_...
```

Implemented routes:

- `POST /api/extension/token/create`
- `POST /api/extension/token/revoke`
- `GET /api/extension/profile`
- `GET /api/extension/preferences`
- `GET /api/extension/resumes`
- `GET /api/extension/campaign-queue`
- `POST /api/extension/campaign-result`
- `POST /api/extension/campaign-retry`
- `GET /api/extension/cover-letters`
- `POST /api/extension/capture-job`
- `POST /api/extension/match-job`
- `POST /api/extension/generate-answer`
- `POST /api/extension/save-application`
- `PATCH /api/extension/application-status`

## Campaign APIs

- `GET /api/campaigns`
- `POST /api/campaigns`
- `GET /api/campaigns/[id]`
- `POST /api/campaigns/[id]/start`
- `POST /api/campaigns/[id]/pause`
- `POST /api/campaigns/[id]/run-next`
- `POST /api/campaigns/[id]/jobs/[jobId]/approve`
- `POST /api/campaigns/[id]/jobs/[jobId]/reject`

## Field Mapping

Rule-based mapping lives in `src/lib/services/fieldMapping.ts` and the extension content script mirrors those rules for in-page detection. To add a platform-specific mapping:

1. Capture labels/placeholders/name/id/nearby text from the platform form.
2. Add a targeted rule before generic rules.
3. Add a test in `tests/fieldMapping.test.ts`.
4. Load the extension, scan the form, manually adjust mappings, then click **Save Mapping** to persist that host pattern in Chrome storage.

## Manual Testing Checklist

- Create an automation rule, then verify restricted or unknown jobs do not match safe automation.
- Add a direct-email source, import a job with an HR/recruiter email, generate an email, approve it, and send under the daily limit.
- Confirm the sent email appears in the tracker and analytics.
- Move the sent application date back or set a due follow-up, then generate and send a reviewed follow-up.
- Create two resume versions and link one to an application; verify resume performance appears in analytics.
- Add a restricted source URL and verify auto-send/one-click actions are blocked with an audit log.
- Disable automation globally at `/settings/automation` and verify automated sends are blocked.
- Greenhouse form: detect name, email, phone, resume upload, open-ended questions.
- Lever form: capture title/company/location, save job, generate match score, detect resume upload.
- LinkedIn/Indeed/ZipRecruiter assisted forms: detect platform-specific fields and resume upload, block final submit, and stop on CAPTCHA/login/verification steps.
- Workday-style form: detect visible fields without touching password or login fields.
- Generic company career page: capture job details from `h1`, visible company/location text, and body description.
- Manual job paste: import through `/jobs`, generate match, cover letter, and tracker card.
- Campaign flow: create a 50-job campaign, approve one allowed job, start the campaign, run next, and verify blocked/submitted attempts.
- Extension flow: connect token, save job, autofill selected fields, generate answer, insert answer, use Safe Next on a multi-step form, verify Policy Submit blocks restricted/unknown sources, mark applied after manual submit.

## Tests

```bash
npm run test
```

The included tests cover resume parsing, match score calculation, preference normalization, application status history, automation rule filtering, source policy enforcement, provider capabilities, campaign queue decisions, risk evaluation, daily limit math, follow-up status blocking, and analytics calculations.
