const DEFAULT_BASE_URL = "http://localhost:3000";
const profileKeys = [
  ["unknown", "Skip / Unknown"],
  ["fullName", "Full name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["currentLocation", "Current location"],
  ["targetRole", "Target role"],
  ["totalExperience", "Total experience"],
  ["skills", "Skills"],
  ["expectedSalary", "Expected salary"],
  ["noticePeriod", "Notice period"],
  ["workAuthorization", "Work authorization"],
  ["linkedIn", "LinkedIn URL"],
  ["portfolio", "Portfolio URL"],
  ["github", "GitHub URL"],
  ["coverLetter", "Cover letter"],
  ["resumeUpload", "Resume upload"],
  ["customQuestion", "Question"]
];

const state = {
  baseUrl: DEFAULT_BASE_URL,
  token: "",
  profile: null,
  resumes: [],
  page: null,
  capturedJob: null,
  application: null,
  filledFields: [],
  skippedFields: [],
  answers: []
};

document.addEventListener("DOMContentLoaded", async () => {
  bindTabs();
  bindActions();
  await loadSettings();
  await detect();
});

function bindTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === button.dataset.tab));
    });
  });
}

function bindActions() {
  document.getElementById("refresh").addEventListener("click", detect);
  document.getElementById("saveToken").addEventListener("click", saveToken);
  document.getElementById("clearToken").addEventListener("click", clearToken);
  document.getElementById("saveJob").addEventListener("click", saveJob);
  document.getElementById("matchJob").addEventListener("click", matchJob);
  document.getElementById("autofillSelected").addEventListener("click", autofillSelected);
  document.getElementById("saveMapping").addEventListener("click", saveMappingPattern);
  document.getElementById("markSaved").addEventListener("click", () => markStatus("READY_TO_APPLY", false));
  document.getElementById("markApplied").addEventListener("click", () => markStatus("APPLIED", true));
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(["baseUrl", "extensionToken"]);
  state.baseUrl = stored.baseUrl || DEFAULT_BASE_URL;
  state.token = stored.extensionToken || "";
  document.getElementById("baseUrl").value = state.baseUrl;
  document.getElementById("token").value = state.token;
  updateStatus();
  if (state.token) await loadProfile();
}

async function saveToken() {
  state.baseUrl = normalizeBaseUrl(document.getElementById("baseUrl").value || DEFAULT_BASE_URL);
  state.token = document.getElementById("token").value.trim();
  await chrome.storage.local.set({ baseUrl: state.baseUrl, extensionToken: state.token });
  await loadProfile();
  updateStatus();
}

async function clearToken() {
  state.token = "";
  state.profile = null;
  await chrome.storage.local.remove(["extensionToken"]);
  document.getElementById("token").value = "";
  updateStatus();
  message("Disconnected.");
}

async function loadProfile() {
  try {
    const data = await api("/api/extension/profile");
    state.profile = data.profile;
    state.resumes = data.resume ? [data.resume] : [];
    updateStatus();
    renderFields();
    message("Connected to web app profile.");
  } catch (error) {
    message(error.message);
  }
}

async function detect() {
  const response = await sendToTab({ type: "DETECT_PAGE" });
  if (response?.error) {
    message(response.error);
    return;
  }
  state.page = response;
  await applySavedMappingPattern();
  renderJob();
  renderFields();
  renderQuestions();
  renderResumeHelp();
  message(response?.hasApplicationForm ? "Application fields detected." : "Page scanned.");
}

async function sendToTab(payload) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  return chrome.tabs.sendMessage(tab.id, payload);
}

async function api(path, options = {}) {
  if (!state.token) throw new Error("Connect with an extension token first.");
  const response = await fetch(`${state.baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.token}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Extension API request failed.");
  return data;
}

async function saveJob() {
  if (!state.page?.job) return message("No job details detected.");
  try {
    const data = await api("/api/extension/capture-job", {
      method: "POST",
      body: JSON.stringify(state.page.job)
    });
    state.capturedJob = data.job;
    state.application = data.application;
    renderJob(data.match);
    message("Job saved to tracker.");
  } catch (error) {
    message(error.message);
  }
}

async function matchJob() {
  if (!state.capturedJob) await saveJob();
  if (!state.capturedJob) return;
  try {
    const data = await api("/api/extension/match-job", {
      method: "POST",
      body: JSON.stringify({ jobId: state.capturedJob.id })
    });
    renderJob(data.match);
    message("Match score generated.");
  } catch (error) {
    message(error.message);
  }
}

async function autofillSelected() {
  if (!state.profile) return message("Connect to fetch profile data first.");
  const selected = Array.from(document.querySelectorAll(".field-card"))
    .map((card) => {
      const checkbox = card.querySelector("input[type='checkbox']");
      const select = card.querySelector("select");
      const preview = card.querySelector("input.preview");
      const field = state.page.fields.find((item) => item.selector === card.dataset.selector);
      return checkbox.checked && field
        ? { ...field, profileKey: select.value, value: preview.value }
        : null;
    })
    .filter(Boolean);
  if (!selected.length) return message("Select at least one field.");

  const result = await sendToTab({ type: "FILL_FIELDS", fields: selected });
  state.filledFields = result.filled || [];
  state.skippedFields = result.skipped || [];
  await saveApplicationLog();
  message(`Filled ${state.filledFields.length} field(s). Review before submitting manually.`);
}

async function generateAnswer(field) {
  try {
    if (!state.capturedJob) await saveJob();
    const data = await api("/api/extension/generate-answer", {
      method: "POST",
      body: JSON.stringify({
        question: field.label || field.nearbyText || field.placeholder,
        fieldLimit: field.maxLength,
        tone: document.getElementById("tone").value,
        jobId: state.capturedJob?.id,
        jobDescription: state.page?.job?.description,
        jobTitle: state.page?.job?.title,
        company: state.page?.job?.company
      })
    });
    const textarea = document.querySelector(`[data-answer-for="${cssEscape(field.selector)}"]`);
    if (textarea) textarea.value = data.answer;
    upsertAnswer(field, data.answer, data.answer, data.needsConfirmation);
    message(data.needsConfirmation ? "Answer generated and marked for confirmation." : "Answer generated.");
  } catch (error) {
    message(error.message);
  }
}

async function insertAnswer(field) {
  const textarea = document.querySelector(`[data-answer-for="${cssEscape(field.selector)}"]`);
  const answer = textarea?.value || "";
  if (!answer.trim()) return message("Generate or type an answer first.");
  const result = await sendToTab({ type: "INSERT_ANSWER", selector: field.selector, answer });
  upsertAnswer(field, textarea.dataset.generated || answer, answer, false);
  await saveApplicationLog();
  message(result.inserted ? "Answer inserted. Review it before submitting." : "Could not insert answer.");
}

async function saveApplicationLog() {
  if (!state.capturedJob) return;
  try {
    const data = await api("/api/extension/save-application", {
      method: "POST",
      body: JSON.stringify({
        jobId: state.capturedJob.id,
        pageUrl: state.page?.url,
        sourcePlatform: state.page?.sourcePlatform,
        filledFields: state.filledFields,
        skippedFields: state.skippedFields,
        answers: state.answers
      })
    });
    state.application = data.application;
  } catch (error) {
    message(error.message);
  }
}

async function markStatus(status, markApplied) {
  if (!state.application) {
    await saveJob();
    await saveApplicationLog();
  }
  if (!state.application?.id) return message("Save the job before updating tracker status.");
  try {
    const data = await api("/api/extension/application-status", {
      method: "PATCH",
      body: JSON.stringify({
        applicationId: state.application.id,
        status,
        markApplied,
        notes: document.getElementById("notes").value,
        followUpDate: document.getElementById("followUpDate").value || null
      })
    });
    state.application = data.application;
    message(markApplied ? "Marked as applied after your confirmation." : "Tracker updated.");
  } catch (error) {
    message(error.message);
  }
}

function renderJob(match) {
  const job = state.page?.job;
  const saved = state.capturedJob;
  document.getElementById("jobSummary").innerHTML = job
    ? `<h2>${escapeHtml(job.title || "Detected job")}</h2>
      <p>${escapeHtml(job.company || "Company not detected")} · ${escapeHtml(job.location || "Location not detected")}</p>
      <p>${escapeHtml(job.sourcePlatform || state.page.sourcePlatform || "Current page")}</p>
      ${match ? `<span class="pill">Match ${match.overallScore}/100</span>` : saved?.matches?.[0] ? `<span class="pill">Saved</span>` : ""}`
    : `<p>No job details detected yet.</p>`;
}

function renderResumeHelp() {
  const upload = state.page?.fields?.find((field) => field.profileKey === "resumeUpload");
  const resume = state.resumes?.[0];
  const element = document.getElementById("resumeHelp");
  if (!upload) {
    element.textContent = "";
    element.style.display = "none";
    return;
  }
  element.style.display = "block";
  element.innerHTML = resume
    ? `Resume upload detected. Recommended version: <strong>${escapeHtml(resume.fileName)}</strong>. <a href="${escapeAttribute(state.baseUrl + resume.downloadUrl)}" target="_blank">Download resume</a>, then manually select it in the upload field.`
    : "Resume upload detected. Upload or activate a resume in the web app, then manually select the file here.";
}

function renderFields() {
  const container = document.getElementById("fields");
  const fields = state.page?.fields || [];
  document.getElementById("fieldCount").textContent = `${fields.length} field${fields.length === 1 ? "" : "s"}`;
  container.innerHTML = "";
  for (const field of fields) {
    const card = document.createElement("div");
    card.className = "field-card";
    card.dataset.selector = field.selector;
    const value = valueFor(field.profileKey);
    card.innerHTML = `
      <div class="field-top">
        <input type="checkbox" ${field.checked && value ? "checked" : ""} ${field.profileKey === "resumeUpload" ? "disabled" : ""} />
        <div>
          <div class="field-title">${escapeHtml(field.label || field.placeholder || field.name || field.type)}</div>
          <div class="field-meta">${escapeHtml(field.reason)} · ${field.confidence}%</div>
        </div>
      </div>
      <select>${profileKeys.map(([key, label]) => `<option value="${key}" ${key === field.profileKey ? "selected" : ""}>${label}</option>`).join("")}</select>
      <input class="preview" value="${escapeAttribute(value)}" placeholder="Preview value" ${field.profileKey === "resumeUpload" ? "disabled" : ""} />
    `;
    card.querySelector("select").addEventListener("change", (event) => {
      const next = event.target.value;
      card.querySelector(".preview").value = valueFor(next);
    });
    container.appendChild(card);
  }
}

function renderQuestions() {
  const container = document.getElementById("questions");
  const questions = state.page?.questions || [];
  container.innerHTML = questions.length ? "" : `<p class="hint">No open-ended questions detected.</p>`;
  for (const field of questions) {
    const card = document.createElement("div");
    card.className = "question-card";
    card.innerHTML = `
      <div class="field-title">${escapeHtml(field.label || field.nearbyText || "Application question")}</div>
      <div class="field-meta">${escapeHtml(field.placeholder || field.name || "")}</div>
      <textarea data-answer-for="${escapeAttribute(field.selector)}"></textarea>
      <div class="answer-actions">
        <button data-action="generate">Generate Answer</button>
        <button data-action="insert" class="primary">Insert Answer</button>
      </div>
    `;
    card.querySelector("[data-action='generate']").addEventListener("click", () => generateAnswer(field));
    card.querySelector("[data-action='insert']").addEventListener("click", () => insertAnswer(field));
    container.appendChild(card);
  }
}

function valueFor(key) {
  if (!state.profile) return "";
  const value = state.profile[key];
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

async function saveMappingPattern() {
  const pattern = {};
  document.querySelectorAll(".field-card").forEach((card) => {
    const field = state.page.fields.find((item) => item.selector === card.dataset.selector);
    const signature = fieldSignature(field);
    if (signature) pattern[signature] = card.querySelector("select").value;
  });
  const key = mappingKey();
  const stored = await chrome.storage.local.get(["mappingPatterns"]);
  await chrome.storage.local.set({ mappingPatterns: { ...(stored.mappingPatterns || {}), [key]: pattern } });
  message("Mapping pattern saved for this platform.");
}

async function applySavedMappingPattern() {
  const key = mappingKey();
  const stored = await chrome.storage.local.get(["mappingPatterns"]);
  const pattern = stored.mappingPatterns?.[key];
  if (!pattern || !state.page?.fields) return;
  state.page.fields = state.page.fields.map((field) => {
    const saved = pattern[fieldSignature(field)];
    return saved ? { ...field, profileKey: saved, checked: saved !== "unknown" && saved !== "resumeUpload" } : field;
  });
}

function fieldSignature(field) {
  return [field?.label, field?.placeholder, field?.name, field?.id, field?.type].filter(Boolean).join("|").toLowerCase();
}

function mappingKey() {
  try {
    return new URL(state.page?.url || "").hostname;
  } catch {
    return "default";
  }
}

function upsertAnswer(field, generatedAnswer, finalAnswer, needsConfirmation) {
  const question = field.label || field.nearbyText || field.placeholder || "Application question";
  state.answers = state.answers.filter((item) => item.question !== question);
  state.answers.push({ question, generatedAnswer, finalAnswer, needsConfirmation });
}

function updateStatus() {
  document.getElementById("status").textContent = state.token && state.profile ? `Connected as ${state.profile.email || "profile"}` : "Not connected";
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function cssEscape(value) {
  return String(value).replace(/["\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function message(text) {
  document.getElementById("message").textContent = text || "";
}
