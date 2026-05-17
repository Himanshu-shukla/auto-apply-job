const PROFILE_KEYS = [
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message.type === "DETECT_PAGE") sendResponse(detectPage());
    if (message.type === "FILL_FIELDS") sendResponse(fillFields(message.fields || []));
    if (message.type === "INSERT_ANSWER") sendResponse(insertAnswer(message.selector, message.answer));
  } catch (error) {
    sendResponse({ error: error instanceof Error ? error.message : "Content script failed." });
  }
  return true;
});

function detectPage() {
  const fields = detectFields();
  const job = extractJob();
  return {
    url: location.href,
    sourcePlatform: inferSourcePlatform(location.href),
    job,
    fields,
    questions: fields.filter((field) => field.profileKey === "customQuestion" || field.tagName === "textarea"),
    hasApplicationForm: fields.length > 0
  };
}

function detectFields() {
  const inputs = Array.from(document.querySelectorAll("input, textarea, select"));
  return inputs
    .filter(isVisibleField)
    .filter((field) => !isUnsafeField(field))
    .map((field, index) => {
      const detected = describeField(field, index);
      return { ...detected, ...mapField(detected) };
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
    value: field.value || ""
  };
}

function mapField(field) {
  const text = [field.label, field.placeholder, field.name, field.id, field.nearbyText, field.type, (field.options || []).join(" ")]
    .join(" ")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
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

function insertAnswer(selector, answer) {
  const element = document.querySelector(selector);
  if (!element || isUnsafeField(element)) return { inserted: false };
  setFieldValue(element, answer || "");
  return { inserted: true };
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
  return ["password", "hidden", "submit", "button", "reset"].includes(type) || /\b(password|otp|captcha|ssn|credit card)\b/.test(text);
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
