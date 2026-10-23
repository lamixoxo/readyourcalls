# Call Subtitles

A Chrome/Edge extension (Manifest V3) that adds **live subtitles to any browser-based call**
(Google Meet, Zoom Web, Microsoft Teams, Discord, Whereby…). It captures the tab's audio,
transcribes it in short chunks with OpenAI Whisper, and shows the text as an overlay.

## Install (developer mode)

1. Clone this repo: `git clone https://github.com/<you>/call-subtitles.git`
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the project folder.

## Use

1. Open your call tab.
2. Click the extension icon, paste your [OpenAI API key](https://platform.openai.com/api-keys), pick the spoken language.
3. Click **Start subtitles**. Click **Stop subtitles** when done.

## How it works

| File | Role |
|------|------|
| `src/background.js` | Service worker; gets the tab stream ID and routes messages |
| `src/offscreen.js`  | Captures audio, records chunks, calls the Whisper API |
| `src/content.js`    | Draws the subtitle overlay on the call page |
| `src/popup.*`       | Settings UI |

## Notes & privacy

- Audio is sent to OpenAI for transcription. Tell participants and follow local recording/consent laws.
- Your API key is stored locally via `chrome.storage.local` and only sent to `api.openai.com`.
- Only the **other participants' audio** (the tab's output) is captured, not your microphone.
- Shorter chunks = lower delay but less accurate; 5 s is a good default.
- Silent chunks are skipped to save cost.

## Ideas / roadmap

- Local transcription with Whisper WASM (no API key)
- Draggable overlay, export transcript as `.srt`
- Firefox port

## License

MIT
