const DEFAULT_BASE_URL = "http://localhost:3000";
const QUEUE_STATE_KEY = "browserQueue";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ safetyMode: true });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ error: error instanceof Error ? error.message : "Queue worker failed." }));
  return true;
});

async function handleMessage(message) {
  if (message.type === "QUEUE_STATUS") return queueStatus();
  if (message.type === "QUEUE_START") return startQueue(message.campaignId);
  if (message.type === "QUEUE_PAUSE") return pauseQueue();
  if (message.type === "QUEUE_RUN_NEXT") return runNextQueueJob(message.campaignId);
  if (message.type === "QUEUE_RETRY") return retryQueueJob(message.campaignId, message.campaignJobId);
  return {};
}

async function queueStatus() {
  const [stored, remote] = await Promise.all([chrome.storage.local.get([QUEUE_STATE_KEY]), loadQueue().catch((error) => ({ error: error.message, campaigns: [] }))]);
  return { state: stored[QUEUE_STATE_KEY] || { running: false, results: [] }, ...remote };
}

async function startQueue(campaignId) {
  const state = { ...(await getQueueState()), campaignId, running: true, lastMessage: "Queue running." };
  await setQueueState(state);
  return runNextQueueJob(campaignId);
}

async function pauseQueue() {
  const state = { ...(await getQueueState()), running: false, lastMessage: "Queue paused." };
  await setQueueState(state);
  return { state };
}

async function retryQueueJob(campaignId, campaignJobId) {
  await api("/api/extension/campaign-retry", {
    method: "POST",
    body: JSON.stringify({ campaignId, campaignJobId })
  });
  return queueStatus();
}

async function runNextQueueJob(campaignId) {
  const state = { ...(await getQueueState()), campaignId: campaignId || (await getQueueState()).campaignId };
  const queue = await loadQueue(state.campaignId);
  const campaign = queue.campaigns.find((item) => item.id === state.campaignId) || queue.campaigns[0];
  const item = campaign?.jobs?.find((job) => job.status === "ready");
  if (!campaign || !item) {
    await setQueueState({ ...state, running: false, lastMessage: "No ready jobs remain." });
    return queueStatus();
  }

  const tab = await activeTab();
  const result = await processQueueItem(tab.id, item);
  const nextState = {
    ...state,
    campaignId: campaign.id,
    running: result.continueRunning ? Boolean(state.running) : false,
    lastJobId: item.id,
    lastMessage: result.message,
    results: [...(state.results || []), { campaignJobId: item.id, title: item.job.title, status: result.status, message: result.message, at: new Date().toISOString() }].slice(-50)
  };
  await setQueueState(nextState);

  if (nextState.running && result.status === "submitted") {
    setTimeout(() => runNextQueueJob(campaign.id).catch(async (error) => {
      await setQueueState({ ...(await getQueueState()), running: false, lastMessage: error.message });
    }), 1500);
  }
  return queueStatus();
}

async function processQueueItem(tabId, item) {
  let detection = null;
  let filledFields = [];
  let skippedFields = [];
  let attachment = null;
  let finalSubmit = { clicked: false, reason: "Manual submit required by source policy." };
  let proofImage = null;
  try {
    await navigate(tabId, item.job.applyUrl);
    detection = await sendToTabWithRetry(tabId, { type: "DETECT_PAGE" });
    const profileData = await api("/api/extension/profile");
    const fields = (detection.fields || [])
      .filter((field) => field.checked && field.profileKey !== "resumeUpload")
      .map((field) => ({ ...field, value: valueFor(profileData.profile, field.profileKey) }))
      .filter((field) => String(field.value ?? "").trim() !== "");
    const fillResult = fields.length ? await sendToTabWithRetry(tabId, { type: "FILL_FIELDS", fields }) : { filled: [], skipped: [] };
    filledFields = fillResult.filled || [];
    skippedFields = fillResult.skipped || [];

    const upload = (detection.fields || []).find((field) => field.profileKey === "resumeUpload");
    if (upload) {
      attachment = await attachResume(tabId, upload);
      const logItem = { label: upload.label || "Resume upload", profileKey: "resumeUpload", filled: Boolean(attachment.attached), reason: attachment.reason };
      if (attachment.attached) filledFields.push(logItem);
      else skippedFields.push(logItem);
    }

    const policy = finalSubmitPolicy(item.job);
    finalSubmit = await sendToTabWithRetry(tabId, { type: "CLICK_FINAL_SUBMIT", policy });
    proofImage = await captureProof().catch(() => null);
    const status = finalSubmit.clicked ? "submitted" : "blocked";
    await saveResult(item, { status, detection, filledFields, skippedFields, attachment, finalSubmit, proofImage, errorMessage: finalSubmit.clicked ? null : finalSubmit.reason });
    return {
      status,
      continueRunning: finalSubmit.clicked,
      message: finalSubmit.clicked ? `Submitted ${item.job.title}.` : `${item.job.title} filled; ${finalSubmit.reason || "manual review required."}`
    };
  } catch (error) {
    proofImage = await captureProof().catch(() => null);
    const message = error instanceof Error ? error.message : "Queue item failed.";
    await saveResult(item, { status: "failed", detection, filledFields, skippedFields, attachment, finalSubmit, proofImage, errorMessage: message }).catch(() => {});
    return { status: "failed", continueRunning: false, message };
  }
}

async function attachResume(tabId, uploadField) {
  const resumesData = await api("/api/extension/resumes");
  const resume = resumesData.resumes?.find((item) => item.preferred) || resumesData.resumes?.find((item) => item.isActive) || resumesData.resumes?.[0];
  if (!resume?.downloadUrl) return { attached: false, reason: "No downloadable resume is available." };
  const response = await fetch(await absoluteUrl(resume.downloadUrl));
  if (!response.ok) return { attached: false, reason: "Could not fetch selected resume." };
  const contentBase64 = await arrayBufferToBase64(await response.arrayBuffer());
  return sendToTabWithRetry(tabId, {
    type: "ATTACH_RESUME",
    selector: uploadField.selector,
    resume: { fileName: resume.fileName, fileType: resume.fileType || "application/pdf", contentBase64 }
  });
}

async function saveResult(item, result) {
  return api("/api/extension/campaign-result", {
    method: "POST",
    body: JSON.stringify({
      campaignId: item.campaignId,
      campaignJobId: item.id,
      applicationId: item.applicationId,
      status: result.status,
      pageUrl: result.detection?.url || item.job.applyUrl,
      filledFields: result.filledFields,
      skippedFields: result.skippedFields,
      attachment: result.attachment,
      automationState: result.detection?.automationState,
      finalSubmitClicked: Boolean(result.finalSubmit?.clicked),
      proofImage: result.proofImage,
      errorMessage: result.errorMessage
    })
  });
}

async function loadQueue(campaignId) {
  return api(`/api/extension/campaign-queue${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ""}`);
}

async function api(path, options = {}) {
  const settings = await chrome.storage.local.get(["baseUrl", "extensionToken"]);
  const baseUrl = normalizeBaseUrl(settings.baseUrl || DEFAULT_BASE_URL);
  if (!settings.extensionToken) throw new Error("Connect with an extension token first.");
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.extensionToken}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Extension API request failed.");
  return data;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  return tab;
}

async function navigate(tabId, url) {
  await chrome.tabs.update(tabId, { url });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for job page to load."));
    }, 30000);
    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1000);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function sendToTabWithRetry(tabId, payload) {
  let lastError = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, payload);
      if (result?.error) throw new Error(result.error);
      return result;
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }
  throw lastError || new Error("Could not communicate with the job page.");
}

async function captureProof() {
  return chrome.tabs.captureVisibleTab(undefined, { format: "jpeg", quality: 55 });
}

function finalSubmitPolicy(job) {
  const finalSubmitAllowed = job.sourceType === "company_career_page" && job.automationLevel === "one_click_apply";
  return {
    sourceType: job.sourceType,
    automationLevel: job.automationLevel,
    finalSubmitAllowed,
    reason: finalSubmitAllowed ? "" : "Source policy requires manual final submit."
  };
}

function valueFor(profile, key) {
  if (key === "firstName") return splitName(profile.fullName).firstName;
  if (key === "lastName") return splitName(profile.fullName).lastName;
  const value = profile[key];
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

function splitName(value) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.length > 1 ? parts.slice(1).join(" ") : "" };
}

async function getQueueState() {
  const stored = await chrome.storage.local.get([QUEUE_STATE_KEY]);
  return stored[QUEUE_STATE_KEY] || { running: false, results: [] };
}

async function setQueueState(state) {
  await chrome.storage.local.set({ [QUEUE_STATE_KEY]: state });
}

async function absoluteUrl(path) {
  if (/^https?:\/\//i.test(path || "")) return path;
  const settings = await chrome.storage.local.get(["baseUrl"]);
  return `${normalizeBaseUrl(settings.baseUrl || DEFAULT_BASE_URL)}${path || ""}`;
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

async function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
