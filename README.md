# AI Job Application Copilot

Phase 3 assisted-apply SaaS for uploading resume versions, saving job preferences, sourcing safe jobs, scoring fit, generating truthful application content, reviewing an approval queue, sending approved direct-email applications, scheduling follow-ups, and tracking analytics. The Chrome extension helps users fill selected form fields after review; unsafe automation is blocked server-side.

## Stack

- Next.js 14 App Router
- PostgreSQL + Prisma
- Tailwind CSS
- Local file storage for resume uploads
- `pdf-parse` and `mammoth` for resume text extraction
- OpenAI-compatible AI wrapper with graceful fallback when no API key is configured
- Provider-based job search with mock jobs, RSS/career page placeholders, and manual import
- Manifest V3 Chrome extension in `extension/`
- Revocable extension API tokens stored as SHA-256 hashes
- Controlled automation rules, source policy, approval queue, rate limits, audit logs, and notification center

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
```

`EMAIL_PROVIDER=log` records delivery in audit logs for local development. Use `resend` or `sendgrid` with the matching API key and verified `EMAIL_FROM` for real delivery.

## Assisted Apply Flow

1. Upload a PDF or DOCX resume at `/resume`.
2. Review and edit parsed profile data.
3. Save preferences at `/preferences`.
4. Save answer templates at `/answer-templates` for notice period, salary expectation, relocation, work authorization, introduction, and common short answers.
5. Open a job page in Chrome.
6. Use the extension **Current Job** tab to capture the job and generate a match score.
7. Use **Autofill** to inspect detected fields, adjust mappings, and fill selected fields only.
8. Use **Answers** to generate short, truthful answers for custom questions, edit them, then insert them.
9. For resume upload fields, download the recommended resume and manually select it in the browser file picker.
10. Manually review and submit the application yourself.
11. Use **Tracker** in the extension to mark the application as applied.
12. Review the saved record at `/tracker` or `/applications/[id]`.

## Safety Rules

- No mass auto-apply workflow.
- No bypassing LinkedIn, Indeed, Glassdoor, Naukri, or similar platform restrictions.
- Restricted platforms default to assisted apply only. Unknown sources default to save only.
- Direct email can auto-send only after the source is explicitly approved and daily/cooldown limits pass.
- Official APIs can apply only when credentials and an allowed integration exist.
- Company career pages can use one-click apply only when the user explicitly marks the domain as allowed.
- No automatic third-party submit clicks unless source policy explicitly allows that workflow.
- No password, OTP, CAPTCHA, SSN, or payment fields are filled.
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
  searchJobs(preferences): Promise<NormalizedJob[]>;
  getJobDetails?(jobIdOrUrl): Promise<NormalizedJob | null>;
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
- `GET /api/extension/cover-letters`
- `POST /api/extension/capture-job`
- `POST /api/extension/match-job`
- `POST /api/extension/generate-answer`
- `POST /api/extension/save-application`
- `PATCH /api/extension/application-status`

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
- Workday-style form: detect visible fields without touching password or login fields.
- Generic company career page: capture job details from `h1`, visible company/location text, and body description.
- Manual job paste: import through `/jobs`, generate match, cover letter, and tracker card.
- Extension flow: connect token, save job, autofill selected fields, generate answer, insert answer, manually submit, mark applied.

## Tests

```bash
npm run test
```

The included tests cover resume parsing, match score calculation, preference normalization, application status history, automation rule filtering, source policy enforcement, risk evaluation, daily limit math, follow-up status blocking, and analytics calculations.
