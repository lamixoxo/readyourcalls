// Injected into the call tab: renders the subtitle overlay.
(() => {
  if (window.__callSubtitlesInjected) return;
  window.__callSubtitlesInjected = true;

  const box = document.createElement("div");
  box.id = "call-subtitles-overlay";
  Object.assign(box.style, {
    position: "fixed",
    left: "50%",
    bottom: "90px",
    transform: "translateX(-50%)",
    maxWidth: "70vw",
    padding: "8px 16px",
    background: "rgba(0,0,0,0.78)",
    color: "#fff",
    font: "500 22px/1.35 system-ui, sans-serif",
    textAlign: "center",
    borderRadius: "8px",
    zIndex: "2147483647",
    pointerEvents: "none",
    display: "none",
  });
  document.documentElement.appendChild(box);

  let hideTimer = null;
  const lines = [];

  function show(text, isError = false) {
    if (isError) {
      lines.length = 0;
      box.style.color = "#ffb4b4";
      lines.push(text);
    } else {
      box.style.color = "#fff";
      lines.push(text);
      if (lines.length > 2) lines.shift();
    }
    box.textContent = lines.join(" ");
    box.style.display = "block";
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      box.style.display = "none";
      lines.length = 0;
    }, isError ? 6000 : 7000);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "subtitle") show(msg.text);
    else if (msg.type === "error") show(msg.text, true);
    else if (msg.type === "config") box.style.fontSize = (msg.fontSize || 22) + "px";
    else if (msg.type === "clear") {
      box.style.display = "none";
      lines.length = 0;
    }
  });
})();
