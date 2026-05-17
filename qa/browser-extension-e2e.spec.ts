import { expect, test } from "@playwright/test";
import path from "node:path";

const appUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const contentScriptPath = path.resolve(__dirname, "../extension/content.js");

test.describe("Chrome extension assisted apply", () => {
  test("content script detects fields, skips unsafe controls, and fills selected values only", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          onMessage: {
            addListener(listener: unknown) {
              (window as any).__jobCopilotListener = listener;
            }
          }
        }
      };
    });
    await page.setContent(`
      <main>
        <h1>Backend Engineer</h1>
        <p class="company">Acme Careers</p>
        <p class="location">Remote</p>
        <section class="job-description">Node.js and PostgreSQL role. Email recruiter@example.com.</section>
        <form>
          <label for="fullName">Full name</label><input id="fullName" name="fullName" />
          <label for="email">Email</label><input id="email" type="email" />
          <label for="captcha">Captcha</label><input id="captcha" name="captcha" />
          <input type="hidden" name="csrf" value="secret" />
          <label for="resume">Resume</label><input id="resume" type="file" />
          <label for="why">Why should we hire you?</label><textarea id="why"></textarea>
        </form>
      </main>
    `);
    await page.addScriptTag({ path: contentScriptPath });

    const detection = await page.evaluate(() => (window as any).detectPage());
    expect(JSON.stringify(detection)).not.toContain("csrf");
    expect(JSON.stringify(detection)).not.toContain("captcha");
    expect(JSON.stringify(detection)).toContain("resumeUpload");

    const result = await page.evaluate(() =>
      (window as any).fillFields([
        { selector: "#fullName", profileKey: "fullName", value: "Priya Shah" },
        { selector: "#email", profileKey: "email", value: "priya@example.com" },
        { selector: "#resume", profileKey: "resumeUpload", value: "/tmp/resume.pdf" },
        { selector: "#captcha", profileKey: "unknown", value: "123456" }
      ])
    );

    await expect(page.locator("#fullName")).toHaveValue("Priya Shah");
    await expect(page.locator("#email")).toHaveValue("priya@example.com");
    await expect(page.locator("#captcha")).toHaveValue("");
    expect(result.filled).toHaveLength(2);
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ profileKey: "resumeUpload" }),
        expect.objectContaining({ profileKey: "unknown" })
      ])
    );
  });

  test("content script attaches a resume to a normal visible file input", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          onMessage: {
            addListener(listener: unknown) {
              (window as any).__jobCopilotListener = listener;
            }
          }
        }
      };
    });
    await page.setContent(`
      <main>
        <h1>Frontend Engineer</h1>
        <form>
          <label for="resume">Resume</label><input id="resume" type="file" />
        </form>
      </main>
    `);
    await page.addScriptTag({ path: contentScriptPath });

    const result = await page.evaluate(() =>
      (window as any).attachResume({ fileName: "resume.pdf", fileType: "application/pdf", contentBase64: "SGVsbG8=" }, "#resume")
    );
    const fileName = await page.locator("#resume").evaluate((input: HTMLInputElement) => input.files?.[0]?.name);

    expect(result.attached).toBe(true);
    expect(fileName).toBe("resume.pdf");
  });

  test("restricted platform adapters map common fields but block final submit", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          onMessage: {
            addListener(listener: unknown) {
              (window as any).__jobCopilotListener = listener;
            }
          }
        }
      };
    });
    await page.route("https://www.linkedin.com/jobs/view/123", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: `
          <main class="jobs-easy-apply-modal">
            <h1>Backend Engineer</h1>
            <form>
              <label for="first">First name</label><input id="first" />
              <label for="last">Last name</label><input id="last" />
              <label for="resume">Upload resume</label><input id="resume" type="file" />
              <button type="submit">Submit application</button>
            </form>
          </main>
        `
      });
    });
    await page.goto("https://www.linkedin.com/jobs/view/123");
    await page.addScriptTag({ path: contentScriptPath });

    const detection = await page.evaluate(() => (window as any).detectPage());
    const submit = await page.evaluate(() =>
      (window as any).clickFinalSubmit({ sourceType: "restricted_platform", automationLevel: "assisted_apply", finalSubmitAllowed: false })
    );

    expect(detection.sourcePlatform).toBe("LinkedIn");
    expect(detection.adapter).toBe("LinkedIn Easy Apply");
    expect(detection.fields).toEqual(expect.arrayContaining([expect.objectContaining({ profileKey: "firstName" })]));
    expect(detection.fields).toEqual(expect.arrayContaining([expect.objectContaining({ profileKey: "resumeUpload" })]));
    expect(submit.clicked).toBe(false);
    expect(submit.blocked).toBe(true);
  });

  test("protected steps block next, submit, and resume attachment", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          onMessage: {
            addListener(listener: unknown) {
              (window as any).__jobCopilotListener = listener;
            }
          }
        }
      };
    });
    await page.setContent(`
      <main>
        <form>
          <p>Complete this CAPTCHA before continuing.</p>
          <label for="resume">Resume</label><input id="resume" type="file" />
          <button type="button">Next</button>
          <button type="submit">Submit application</button>
        </form>
      </main>
    `);
    await page.addScriptTag({ path: contentScriptPath });

    const next = await page.evaluate(() => (window as any).clickSafeNext());
    const attach = await page.evaluate(() =>
      (window as any).attachResume({ fileName: "resume.pdf", fileType: "application/pdf", contentBase64: "SGVsbG8=" }, "#resume")
    );

    expect(next.clicked).toBe(false);
    expect(next.blocked).toBe(true);
    expect(attach.attached).toBe(false);
    expect(attach.blocked).toBe(true);
  });

  test("extension API denies requests without bearer token", async ({ request }) => {
    const response = await request.get(`${appUrl}/api/extension/profile`);
    expect(response.status()).toBe(401);
  });
});
