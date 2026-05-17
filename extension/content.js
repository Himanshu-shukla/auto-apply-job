const PROFILE_KEYS = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "currentLocation",
  "targetRole",
  "totalExperience",
  "skills",
  "expectedSalary",
  "noticePeriod",
  "linkedIn",
  "portfolio",
  "github",
  "coverLetter",
  "workAuthorization"
];

const PLATFORM_ADAPTERS = [
  {
    id: "linkedin",
    name: "LinkedIn Easy Apply",
    hostPattern: /(^|\.)linkedin\.com$/i,
    sourcePlatform: "LinkedIn",
    formSelectors: [".jobs-easy-apply-modal", "[data-test-modal]", ".artdeco-modal", "form"],
    safeNext: /\b(next|review|continue)\b/i,
    finalSubmitBlockedReason: "LinkedIn is a restricted platform; review and submit manually.",
    map(field, base) {
      const text = fieldText(field);
      if (/\bfirst\s+name\b/.test(text)) return mapping("firstName", 98, "LinkedIn first name field.");
      if (/\blast\s+name\b/.test(text)) return mapping("lastName", 98, "LinkedIn last name field.");
      if (/\bmobile\s+phone|phone\s+number\b/.test(text)) return mapping("phone", 97, "LinkedIn phone field.");
      if (/\bresume|cv|upload resume\b/.test(text) || field.type === "file") return mapping("resumeUpload", 99, "LinkedIn resume upload detected.");
      return base;
    }
  },
  {
    id: "indeed",
    name: "Indeed Apply",
    hostPattern: /(^|\.)indeed\.com$/i,
    sourcePlatform: "Indeed",
    formSelectors: ["[data-testid*='ApplyForm']", "[class*='ia-']", "form"],
    safeNext: /\b(continue|next|review)\b/i,
    finalSubmitBlockedReason: "Indeed is a restricted platform; review and submit manually.",
    map(field, base) {
      const text = fieldText(field);
      if (/\bfirst\s+name\b/.test(text)) return mapping("firstName", 98, "Indeed first name field.");
      if (/\blast\s+name\b/.test(text)) return mapping("lastName", 98, "Indeed last name field.");
      if (/\bresume|cv|upload|replace resume\b/.test(text) || field.type === "file") return mapping("resumeUpload", 99, "Indeed resume upload detected.");
      if (/\bwork authorization|authorized to work|sponsorship\b/.test(text)) return mapping("workAuthorization", 92, "Indeed work authorization field.");
      return base;
    }
  },
  {
    id: "ziprecruiter",
    name: "ZipRecruiter Apply",
    hostPattern: /(^|\.)ziprecruiter\.com$/i,
    sourcePlatform: "ZipRecruiter",
    formSelectors: ["[class*='apply']", "[id*='apply']", "form"],
    safeNext: /\b(next|continue|review)\b/i,
    finalSubmitBlockedReason: "ZipRecruiter is a restricted platform; review and submit manually.",
    map(field, base) {
      const text = fieldText(field);
      if (/\bfirst\s+name\b/.test(text)) return mapping("firstName", 98, "ZipRecruiter first name field.");
      if (/\blast\s+name\b/.test(text)) return mapping("lastName", 98, "ZipRecruiter last name field.");
      if (/\bresume|cv|upload|attach\b/.test(text) || field.type === "file") return mapping("resumeUpload", 99, "ZipRecruiter resume upload detected.");
      if (/\bdesired pay|desired salary|salary expectation\b/.test(text)) return mapping("expectedSalary", 92, "ZipRecruiter salary field.");
      return base;
    }
  }
];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message.type === "DETECT_PAGE") sendResponse(detectPage());
    if (message.type === "FILL_FIELDS") sendResponse(fillFields(message.fields || []));
    if (message.type === "ATTACH_RESUME") sendResponse(attachResume(message.resume || {}, message.selector));
    if (message.type === "INSERT_ANSWER") sendResponse(insertAnswer(message.selector, message.answer));
    if (message.type === "CLICK_SAFE_NEXT") sendResponse(clickSafeNext());
    if (message.type === "CLICK_FINAL_SUBMIT") sendResponse(clickFinalSubmit(message.policy || {}));
  } catch (error) {
    sendResponse({ error: error instanceof Error ? error.message : "Content script failed." });
  }
  return true;
});

function detectPage() {
  const adapter = currentAdapter();
  const fields = detectFields();
  const job = extractJob();
  return {
    url: location.href,
    sourcePlatform: adapter?.sourcePlatform || inferSourcePlatform(location.href),
    adapter: adapter?.name || "Generic",
    job,
    fields,
    questions: fields.filter((field) => field.profileKey === "customQuestion" || field.tagName === "textarea"),
    hasApplicationForm: fields.length > 0,
    automationState: inspectAutomationState(fields)
  };
}

function detectFields() {
  const adapter = currentAdapter();
  const root = adapterRoot(adapter);
  const inputs = Array.from(root.querySelectorAll("input, textarea, select"));
  return inputs
    .filter(isVisibleField)
    .filter((field) => !isUnsafeField(field))
    .map((field, index) => {
      const detected = describeField(field, index);
      const baseMapping = mapField(detected);
      return { ...detected, ...(adapter?.map(detected, baseMapping) || baseMapping), adapter: adapter?.name || "Generic" };
    });
}

function describeField(field, index) {
  const label = getLabel(field);
  const type = (field.getAttribute("type") || field.tagName).toLowerCase();
  const selector = stableSelector(field, index);
  const options =
    field.tagName === "SELECT"
      ? Array.from(field.options || [])
          .map((option) => option.textContent.trim())
          .filter(Boolean)
      : [];
  return {
    selector,
    label,
    placeholder: field.getAttribute("placeholder") || "",
    name: field.getAttribute("name") || "",
    id: field.id || "",
    nearbyText: nearbyText(field),
    type,
    tagName: field.tagName.toLowerCase(),
    maxLength: field.maxLength > 0 ? field.maxLength : null,
    options,
    value: field.value || "",
    required: Boolean(field.required || field.getAttribute("aria-required") === "true")
  };
}

function mapField(field) {
  const text = fieldText(field);
  if (/\bfirst\s+name\b/.test(text)) return mapping("firstName", 97, "First name field.");
  if (/\blast\s+name\b/.test(text)) return mapping("lastName", 97, "Last name field.");
  if (field.type === "file" || /\b(upload|resume|cv)\b/.test(text)) return mapping("resumeUpload", 99, "Resume upload detected.");
  if (field.type === "email" || /\be-?mail\b/.test(text)) return mapping("email", 99, "Email field.");
  if (field.type === "tel" || /\b(phone|mobile|contact number)\b/.test(text)) return mapping("phone", 96, "Phone field.");
  if (/\b(full name|candidate name|name)\b/.test(text) && !/\bcompany\b/.test(text)) return mapping("fullName", 94, "Name label.");
  if (/\blinkedin|linked in\b/.test(text)) return mapping("linkedIn", 96, "LinkedIn field.");
  if (/\bgithub|git hub\b/.test(text)) return mapping("github", 96, "GitHub field.");
  if (/\b(portfolio|website|personal site)\b/.test(text) || field.type === "url") return mapping("portfolio", 82, "Portfolio or URL field.");
  if (/\b(location|city|address|current location)\b/.test(text)) return mapping("currentLocation", 86, "Location field.");
  if (/\b(expected salary|salary expectation|desired salary|ctc|compensation)\b/.test(text)) return mapping("expectedSalary", 92, "Salary field.");
  if (/\bnotice period|available to start|start date\b/.test(text)) return mapping("noticePeriod", 91, "Notice period field.");
  if (/\b(work authorization|authorized to work|visa|sponsorship)\b/.test(text)) return mapping("workAuthorization", 90, "Work authorization field.");
  if (/\b(years of experience|total experience|experience)\b/.test(text)) return mapping("totalExperience", 83, "Experience field.");
  if (/\b(skills|technologies|tools)\b/.test(text)) return mapping("skills", 82, "Skills field.");
  if (/\b(cover letter|message to hiring|additional information)\b/.test(text)) return mapping("coverLetter", 90, "Cover letter field.");
  if (field.tagName === "textarea" || /\b(why|describe|tell us|explain|interested|hire you)\b/.test(text)) {
    return mapping("customQuestion", 58, "Open-ended question.");
  }
  return mapping("unknown", 20, "No confident rule match.");
}

function mapping(profileKey, confidence, reason) {
  return { profileKey, confidence, reason, checked: confidence >= 80 && profileKey !== "resumeUpload" };
}

function fillFields(fields) {
  const filled = [];
  const skipped = [];
  for (const item of fields) {
    const element = document.querySelector(item.selector);
    if (!element || item.profileKey === "resumeUpload") {
      skipped.push({ label: item.label || item.profileKey, profileKey: item.profileKey, filled: false });
      continue;
    }
    if (isUnsafeField(element) || item.value === undefined || item.value === null || String(item.value).trim() === "") {
      skipped.push({ label: item.label || item.profileKey, profileKey: item.profileKey, filled: false });
      continue;
    }
    setFieldValue(element, String(item.value));
    filled.push({ label: item.label || item.profileKey, profileKey: item.profileKey, filled: true });
  }
  return { filled, skipped };
}

function attachResume(resume, selector) {
  const blocker = automationBlocker();
  if (blocker) return { attached: false, blocked: true, reason: blocker };
  const input = findResumeInput(selector);
  if (!input) return { attached: false, blocked: false, reason: "No visible resume file input found. Use the site's file picker manually." };
  if (!resume?.fileName || !resume?.contentBase64) {
    return { attached: false, blocked: false, reason: "Resume file data was not available. Download and select it manually." };
  }
  try {
    const file = new File([base64ToBytes(resume.contentBase64)], resume.fileName, { type: resume.fileType || "application/pdf" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    const attached = input.files?.length > 0;
    return attached
      ? { attached: true, fileName: resume.fileName, selector: stableSelector(input, 0) }
      : { attached: false, blocked: false, reason: "The site did not accept programmatic file attachment. Use the file picker manually." };
  } catch (_error) {
    return { attached: false, blocked: false, reason: "The site blocked programmatic file attachment. Use the file picker manually." };
  }
}

function insertAnswer(selector, answer) {
  const element = document.querySelector(selector);
  if (!element || isUnsafeField(element)) return { inserted: false };
  setFieldValue(element, answer || "");
  return { inserted: true };
}

function clickSafeNext() {
  const blocker = automationBlocker();
  if (blocker) return { clicked: false, blocked: true, reason: blocker };
  const adapter = currentAdapter();
  const button = findButton(adapter?.safeNext || /\b(next|continue|save and continue|review|proceed)\b/i, /\b(submit|apply|send application|finish)\b/i);
  if (!button) return { clicked: false, blocked: false, reason: "No safe next button found." };
  button.click();
  return { clicked: true, blocked: false, label: button.innerText || button.value || "Next" };
}

function clickFinalSubmit(policy) {
  const blocker = automationBlocker();
  if (blocker) return { clicked: false, blocked: true, reason: blocker };
  const adapter = currentAdapter();
  if (adapter?.finalSubmitBlockedReason) return { clicked: false, blocked: true, reason: adapter.finalSubmitBlockedReason };
  if (!policy.finalSubmitAllowed) return { clicked: false, blocked: true, reason: policy.reason || "Source policy blocks final auto-submit." };
  if (/restricted_platform|unknown/i.test(policy.sourceType || "")) {
    return { clicked: false, blocked: true, reason: "Restricted or unknown sources require assisted apply only." };
  }
  const button = findButton(/\b(submit|apply|send application|finish)\b/i);
  if (!button) return { clicked: false, blocked: false, reason: "No final submit button found." };
  button.click();
  return { clicked: true, blocked: false, label: button.innerText || button.value || "Submit" };
}

function inspectAutomationState(fields) {
  const blocker = automationBlocker();
  return {
    blocker,
    canClickNext: !blocker && Boolean(findButton(/\b(next|continue|save and continue|review|proceed)\b/i, /\b(submit|apply|send application|finish)\b/i)),
    hasFinalSubmit: !blocker && Boolean(findButton(/\b(submit|apply|send application|finish)\b/i)),
    unknownRequiredFields: fields.filter((field) => field.profileKey === "unknown" && requiredLike(field)).length
  };
}

function setFieldValue(element, value) {
  element.focus();
  if (element.tagName === "SELECT") {
    const option = Array.from(element.options).find((item) => item.value === value || item.textContent.trim().toLowerCase() === value.toLowerCase());
    element.value = option ? option.value : value;
  } else if (element.type === "checkbox" || element.type === "radio") {
    element.checked = /^(true|yes|1|checked)$/i.test(value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function extractJob() {
  const title = textFromSelectors(["[data-testid*='title']", "h1", ".posting-headline h2", ".job-title", "[class*='job-title']"]);
  const company = textFromSelectors(["[data-testid*='company']", ".company", "[class*='company']", ".posting-company", "meta[property='og:site_name']"]);
  const locationText = textFromSelectors(["[data-testid*='location']", ".location", "[class*='location']", ".posting-location"]);
  const description = textFromSelectors(["[data-testid*='description']", ".job-description", "[class*='description']", ".posting-page", "main", "body"]);
  return {
    title: title || document.title.split("|")[0].trim(),
    company: company || "",
    location: locationText || "",
    description: description.slice(0, 12000),
    applyUrl: location.href,
    pageUrl: location.href,
    sourcePlatform: inferSourcePlatform(location.href),
    detectedSalary: firstMatch(description, /(?:\$|₹|INR|USD)\s?[\d,.]+(?:\s?(?:-|to)\s?(?:\$|₹|INR|USD)?\s?[\d,.]+)?/i),
    detectedExperienceRequirement: firstMatch(description, /\d+(?:\.\d+)?\+?\s?(?:years?|yrs?)\s+(?:of\s+)?experience/i)
  };
}

function textFromSelectors(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (!element) continue;
    const value = element.tagName === "META" ? element.getAttribute("content") : element.innerText || element.textContent;
    if (value && value.trim()) return value.trim().replace(/\s+/g, " ");
  }
  return "";
}

function firstMatch(text, pattern) {
  const match = text.match(pattern);
  return match ? match[0] : "";
}

function inferSourcePlatform(url) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (/greenhouse/i.test(host)) return "Greenhouse";
  if (/lever/i.test(host)) return "Lever";
  if (/workday/i.test(host)) return "Workday";
  if (/linkedin/i.test(host)) return "LinkedIn";
  if (/indeed/i.test(host)) return "Indeed";
  if (/ziprecruiter/i.test(host)) return "ZipRecruiter";
  if (/glassdoor/i.test(host)) return "Glassdoor";
  if (/naukri/i.test(host)) return "Naukri";
  return host || "Current Page";
}

function isVisibleField(field) {
  const style = window.getComputedStyle(field);
  const rect = field.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && !field.disabled && !field.readOnly;
}

function isUnsafeField(field) {
  const type = (field.getAttribute("type") || "").toLowerCase();
  const text = [field.name, field.id, getLabel(field), field.placeholder].join(" ").toLowerCase();
  return ["password", "hidden", "submit", "button", "reset"].includes(type) || /\b(password|otp|one-time|captcha|ssn|social security|credit card|payment|card number|cvv)\b/.test(text);
}

function automationBlocker() {
  const text = document.body.innerText.toLowerCase();
  if (/\bcaptcha|recaptcha|hcaptcha|i am not a robot\b/.test(text) || document.querySelector("[class*='captcha'], [id*='captcha'], iframe[src*='captcha'], iframe[src*='recaptcha'], iframe[src*='hcaptcha']")) return "CAPTCHA detected.";
  if (/\b(sign in|log in|login|create account|verify email|verify your email|otp|one-time code|verification code|two-factor|2fa)\b/.test(text)) return "Login or verification step detected.";
  const unsafe = Array.from(document.querySelectorAll("input, textarea, select")).find((field) => isVisibleField(field) && isUnsafeAutomationField(field));
  if (unsafe) return "Sensitive or protected field detected.";
  return "";
}

function isUnsafeAutomationField(field) {
  const type = (field.getAttribute("type") || "").toLowerCase();
  const text = [field.name, field.id, getLabel(field), field.placeholder, nearbyText(field)].join(" ").toLowerCase();
  return (
    type === "password" ||
    /\b(password|otp|one-time|verification code|captcha|ssn|social security|date of birth|dob|credit card|payment|card number|cvv|bank account)\b/.test(text) ||
    isSensitiveRequired(field)
  );
}

function isSensitiveRequired(field) {
  const text = [field.name, field.id, getLabel(field), field.placeholder, nearbyText(field)].join(" ").toLowerCase();
  return requiredLike(describeField(field, 0)) && /\b(ssn|social security|date of birth|dob|credit card|payment|password|otp)\b/.test(text);
}

function requiredLike(field) {
  return Boolean(field.required || /\b(required|must answer)\b/i.test(field.nearbyText || ""));
}

function findButton(includePattern, excludePattern) {
  const buttons = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit'], a[role='button']"));
  return buttons.find((button) => {
    if (!isVisibleButton(button)) return false;
    const label = [button.innerText, button.value, button.getAttribute("aria-label"), button.title].join(" ").trim();
    if (!includePattern.test(label)) return false;
    return !excludePattern || !excludePattern.test(label);
  });
}

function isVisibleButton(button) {
  const style = window.getComputedStyle(button);
  const rect = button.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && !button.disabled;
}

function getLabel(field) {
  if (field.id) {
    const direct = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
    if (direct?.textContent?.trim()) return direct.textContent.trim();
  }
  const parent = field.closest("label");
  if (parent?.textContent?.trim()) return parent.textContent.replace(field.value || "", "").trim();
  const aria = field.getAttribute("aria-label") || field.getAttribute("aria-labelledby");
  if (aria) {
    const labelled = document.getElementById(aria);
    return labelled?.textContent?.trim() || aria;
  }
  return "";
}

function nearbyText(field) {
  const container = field.closest("div, li, section, fieldset, form") || field.parentElement;
  return (container?.innerText || container?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function stableSelector(field, index) {
  if (field.id) return `#${CSS.escape(field.id)}`;
  if (field.name) return `${field.tagName.toLowerCase()}[name="${CSS.escape(field.name)}"]`;
  field.dataset.jobCopilotField = field.dataset.jobCopilotField || String(index);
  return `[data-job-copilot-field="${field.dataset.jobCopilotField}"]`;
}

function currentAdapter() {
  const host = location.hostname.replace(/^www\./, "");
  return PLATFORM_ADAPTERS.find((adapter) => adapter.hostPattern.test(host)) || null;
}

function adapterRoot(adapter) {
  if (!adapter) return document;
  for (const selector of adapter.formSelectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return document;
}

function fieldText(field) {
  return [field.label, field.placeholder, field.name, field.id, field.nearbyText, field.type, (field.options || []).join(" ")]
    .join(" ")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
}

function findResumeInput(selector) {
  const selected = selector ? document.querySelector(selector) : null;
  if (selected?.tagName === "INPUT" && selected.type === "file" && isVisibleField(selected) && !isUnsafeField(selected)) return selected;
  return Array.from(document.querySelectorAll("input[type='file']")).find((field) => {
    if (!isVisibleField(field) || isUnsafeField(field)) return false;
    const text = [getLabel(field), field.name, field.id, field.getAttribute("accept"), nearbyText(field)].join(" ").toLowerCase();
    return /\b(resume|cv|curriculum vitae|upload|attach)\b/.test(text);
  });
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
