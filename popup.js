const $ = (id) => document.getElementById(id);
const fields = ["apiKey", "language", "chunkSeconds", "fontSize"];
let running = false;

function render() {
  $("toggle").textContent = running ? "Stop subtitles" : "Start subtitles";
  $("toggle").classList.toggle("stop", running);
}

async function init() {
  const saved = await chrome.storage.local.get(fields);
  for (const f of fields) if (saved[f] !== undefined) $(f).value = saved[f];
  const status = await chrome.runtime.sendMessage({ target: "background", type: "status" });
  running = !!status?.running;
  render();
}

$("toggle").addEventListener("click", async () => {
  $("status").textContent = "";

  if (running) {
    await chrome.runtime.sendMessage({ target: "background", type: "stop" });
    running = false;
    return render();
  }

  const config = {
    apiKey: $("apiKey").value.trim(),
    language: $("language").value,
    chunkSeconds: Math.min(15, Math.max(3, Number($("chunkSeconds").value) || 5)),
    fontSize: Number($("fontSize").value) || 22,
  };
  if (!config.apiKey) {
    $("status").textContent = "Please enter your OpenAI API key.";
    return;
  }
  await chrome.storage.local.set(config);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const res = await chrome.runtime.sendMessage({
    target: "background",
    type: "start",
    tabId: tab.id,
    config,
  });

  if (res?.ok) {
    running = true;
    render();
  } else {
    $("status").textContent = res?.error || "Failed to start.";
  }
});

init();
