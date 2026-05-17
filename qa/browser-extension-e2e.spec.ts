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

  test("extension API denies requests without bearer token", async ({ request }) => {
    const response = await request.get(`${appUrl}/api/extension/profile`);
    expect(response.status()).toBe(401);
  });
});
