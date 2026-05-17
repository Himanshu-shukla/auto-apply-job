chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ safetyMode: true });
});
