// Service worker: coordinates popup, offscreen audio capture and the subtitle overlay.

const OFFSCREEN_URL = "src/offscreen.html";

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (existing.length) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["USER_MEDIA"],
    justification: "Capture tab audio to transcribe it into subtitles.",
  });
}

async function startCapture(tabId, config) {
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  await ensureOffscreen();
  await chrome.scripting.executeScript({ target: { tabId }, files: ["src/content.js"] });
  await chrome.tabs.sendMessage(tabId, { type: "config", fontSize: config.fontSize });
  await chrome.storage.session.set({ activeTabId: tabId });
  chrome.runtime.sendMessage({ target: "offscreen", type: "start", streamId, config });
}

async function stopCapture() {
  const { activeTabId } = await chrome.storage.session.get("activeTabId");
  chrome.runtime.sendMessage({ target: "offscreen", type: "stop" });
  if (activeTabId != null) {
    chrome.tabs.sendMessage(activeTabId, { type: "clear" }).catch(() => {});
  }
  await chrome.storage.session.remove("activeTabId");
  setTimeout(() => chrome.offscreen.closeDocument().catch(() => {}), 500);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "background") return;

  (async () => {
    try {
      if (msg.type === "start") {
        await startCapture(msg.tabId, msg.config);
        sendResponse({ ok: true });
      } else if (msg.type === "stop") {
        await stopCapture();
        sendResponse({ ok: true });
      } else if (msg.type === "status") {
        const { activeTabId } = await chrome.storage.session.get("activeTabId");
        sendResponse({ running: activeTabId != null, tabId: activeTabId });
      } else if (msg.type === "subtitle" || msg.type === "error") {
        const { activeTabId } = await chrome.storage.session.get("activeTabId");
        if (activeTabId != null) {
          chrome.tabs.sendMessage(activeTabId, msg).catch(() => {});
        }
        sendResponse({ ok: true });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err.message || err) });
    }
  })();

  return true; // async response
});

// Stop automatically if the captured tab is closed.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { activeTabId } = await chrome.storage.session.get("activeTabId");
  if (tabId === activeTabId) stopCapture();
});
