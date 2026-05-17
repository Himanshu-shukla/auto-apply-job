const DEFAULT_BASE_URL = "http://localhost:3000";
const profileKeys = [
  ["unknown", "Skip / Unknown"],
  ["firstName", "First name"],
  ["lastName", "Last name"],
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
  selectedResumeId: "",
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
  document.getElementById("clickNext").addEventListener("click", clickSafeNext);
  document.getElementById("clickFinalSubmit").addEventListener("click", clickFinalSubmit);
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
    const resumeData = await api("/api/extension/resumes").catch(() => ({ resumes: data.resume ? [data.resume] : [] }));
    state.profile = data.profile;
    state.resumes = resumeData.resumes || (data.resume ? [data.resume] : []);
    state.selectedResumeId = state.resumes.find((resume) => resume.isActive)?.id || state.resumes[0]?.id || "";
    updateStatus();
    renderFields();
    renderResumeHelp();
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
  renderAutomationHint();
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
    renderAutomationHint();
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

async function clickSafeNext() {
  const result = await sendToTab({ type: "CLICK_SAFE_NEXT" });
  message(result.clicked ? `Clicked ${result.label || "next"}. Scan the next step before continuing.` : result.reason || "No safe next action available.");
  await detect();
}

async function clickFinalSubmit() {
  if (!state.capturedJob) await saveJob();
  const policy = finalSubmitPolicy();
  const result = await sendToTab({ type: "CLICK_FINAL_SUBMIT", policy });
  if (result.clicked) {
    await markStatus("APPLIED", true);
    message(`Clicked ${result.label || "submit"} and marked applied.`);
  } else {
    message(result.reason || "Final submit was not clicked.");
  }
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
  const resume = selectedResume();
  const element = document.getElementById("resumeHelp");
  if (!upload) {
    element.textContent = "";
    element.style.display = "none";
    return;
  }
  element.style.display = "block";
  element.innerHTML = resume
    ? `
      <div><strong>Resume upload detected.</strong></div>
      <label for="resumeSelect">Resume</label>
      <select id="resumeSelect">
        ${state.resumes.map((item) => `<option value="${escapeAttribute(item.id)}" ${item.id === resume.id ? "selected" : ""}>${escapeHtml(item.fileName)}${item.isActive ? " · active" : ""}</option>`).join("")}
      </select>
      <div class="row">
        <button id="attachResume" class="primary">Attach Resume</button>
        <a class="button-link" href="${escapeAttribute(absoluteUrl(resume.downloadUrl))}" target="_blank">Download</a>
      </div>
      <p class="hint">If the site blocks attachment, use Download and select the file manually.</p>
    `
    : "Resume upload detected. Upload or activate a resume in the web app, then manually select the file here.";
  const select = document.getElementById("resumeSelect");
  select?.addEventListener("change", (event) => {
    state.selectedResumeId = event.target.value;
    renderResumeHelp();
  });
  document.getElementById("attachResume")?.addEventListener("click", () => attachSelectedResume(upload));
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

async function attachSelectedResume(uploadField) {
  const resume = selectedResume();
  if (!resume) return message("Choose a resume first.");
  try {
    const payload = await fetchResumePayload(resume);
    const result = await sendToTab({ type: "ATTACH_RESUME", selector: uploadField?.selector, resume: payload });
    const logItem = { label: uploadField?.label || "Resume upload", profileKey: "resumeUpload", filled: Boolean(result.attached) };
    if (result.attached) {
      state.filledFields = [...state.filledFields, logItem];
      message(`Attached ${result.fileName || resume.fileName}. Review before submitting.`);
    } else {
      state.skippedFields = [...state.skippedFields, { ...logItem, filled: false, reason: result.reason || "Resume attachment failed." }];
      message(result.reason || "Resume attachment failed. Download and select it manually.");
    }
    if (!state.capturedJob) await saveJob();
    await saveApplicationLog();
  } catch (error) {
    state.skippedFields = [...state.skippedFields, { label: uploadField?.label || "Resume upload", profileKey: "resumeUpload", filled: false, reason: error.message }];
    message(error.message);
  }
}

function renderAutomationHint() {
  const stateInfo = state.page?.automationState;
  const policy = finalSubmitPolicy();
  const hint = document.getElementById("automationHint");
  const parts = [];
  if (stateInfo?.blocker) parts.push(stateInfo.blocker);
  if (stateInfo?.unknownRequiredFields) parts.push(`${stateInfo.unknownRequiredFields} required field(s) need review.`);
  if (!policy.finalSubmitAllowed) parts.push(policy.reason);
  hint.textContent = parts.length ? parts.join(" ") : "Safe next is available for multi-step forms. Final submit is allowed only by saved source policy.";
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
  if (key === "firstName") return splitName().firstName;
  if (key === "lastName") return splitName().lastName;
  const value = state.profile[key];
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

function selectedResume() {
  return state.resumes.find((resume) => resume.id === state.selectedResumeId) || state.resumes[0] || null;
}

async function fetchResumePayload(resume) {
  if (!resume.downloadUrl) throw new Error("Selected resume has no downloadable file. Download and select it manually.");
  const response = await fetch(absoluteUrl(resume.downloadUrl));
  if (!response.ok) throw new Error("Could not fetch the selected resume. Download and select it manually.");
  const buffer = await response.arrayBuffer();
  return {
    fileName: resume.fileName || "resume.pdf",
    fileType: resume.fileType || response.headers.get("Content-Type") || "application/pdf",
    contentBase64: arrayBufferToBase64(buffer)
  };
}

function finalSubmitPolicy() {
  const job = state.capturedJob || {};
  const sourceType = job.sourceType || "";
  const automationLevel = job.automationLevel || "save_only";
  const finalSubmitAllowed =
    sourceType === "company_career_page" && automationLevel === "one_click_apply";
  return {
    sourceType,
    automationLevel,
    finalSubmitAllowed,
    reason: finalSubmitAllowed
      ? ""
      : sourceType
        ? `Final submit blocked for ${sourceType}/${automationLevel}.`
        : "Save the job first so source policy can be checked."
  };
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

function absoluteUrl(path) {
  if (/^https?:\/\//i.test(path || "")) return path;
  return `${state.baseUrl}${path || ""}`;
}

function splitName() {
  const parts = String(state.profile?.fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : ""
  };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
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
