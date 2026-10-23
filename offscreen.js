// Offscreen document: captures tab audio, cuts it into chunks and sends them to Whisper.

const SILENCE_PEAK = 0.01; // chunks quieter than this are skipped (saves cost, avoids hallucinations)

let stream = null;
let audioCtx = null;
let analyser = null;
let running = false;
let cfg = null;
let lastText = "";

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "start") start(msg.streamId, msg.config);
  if (msg.type === "stop") stop();
});

function report(type, payload) {
  chrome.runtime.sendMessage({ target: "background", type, ...payload });
}

async function start(streamId, config) {
  if (running) stop();
  cfg = config;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: { chromeMediaSource: "tab", chromeMediaStreamId: streamId },
      },
      video: false,
    });
  } catch (e) {
    report("error", { text: "Could not capture tab audio: " + e.message });
    return;
  }

  // Capturing a tab mutes it for the user, so route the audio back to the speakers.
  audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(audioCtx.destination);
  analyser = audioCtx.createAnalyser();
  source.connect(analyser);

  running = true;
  loop();
}

function stop() {
  running = false;
  stream?.getTracks().forEach((t) => t.stop());
  audioCtx?.close().catch(() => {});
  stream = audioCtx = analyser = null;
  lastText = "";
}

// Each chunk is recorded by a fresh MediaRecorder so it is a complete, valid audio file.
function recordChunk(ms) {
  return new Promise((resolve) => {
    const parts = [];
    let peak = 0;
    const buf = new Float32Array(analyser.fftSize);
    const meter = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
    }, 100);

    const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    rec.onstop = () => {
      clearInterval(meter);
      resolve({ blob: new Blob(parts, { type: "audio/webm" }), peak });
    };
    rec.start();
    setTimeout(() => rec.state !== "inactive" && rec.stop(), ms);
  });
}

async function loop() {
  while (running) {
    const { blob, peak } = await recordChunk(cfg.chunkSeconds * 1000);
    if (!running) break;
    if (peak < SILENCE_PEAK) continue;
    transcribe(blob); // intentionally not awaited so recording never pauses
  }
}

async function transcribe(blob) {
  try {
    const form = new FormData();
    form.append("file", blob, "chunk.webm");
    form.append("model", "whisper-1");
    form.append("response_format", "json");
    if (cfg.language) form.append("language", cfg.language);
    if (lastText) form.append("prompt", lastText.slice(-200)); // continuity between chunks

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const { text } = await res.json();
    const clean = (text || "").trim();
    if (clean.length > 1) {
      lastText = clean;
      report("subtitle", { text: clean });
    }
  } catch (e) {
    report("error", { text: "Transcription failed: " + e.message });
  }
}
