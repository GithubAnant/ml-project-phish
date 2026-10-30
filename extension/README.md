# PhishGuard Chrome Extension (Manifest V3)

Local dev extension that scores the active tab URL via the PhishGuard FastAPI backend.

## Load unpacked

1. Start the API: `python3 -m uvicorn api.main:app --host 127.0.0.1 --port 8000`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select this `extension/` directory
5. Pin **PhishGuard** — badge shows `OK` or `!` after each navigation

## Behavior

- `background.js` calls `POST http://127.0.0.1:8000/predict` on tab load
- Popup lists verdict, confidence, and human-readable reasons
- `content.js` outlines on-page links when the current page URL is classified as phishing (visual demo only)

## Permissions

- `activeTab`, `storage`, `scripting`
- Host access limited to `localhost:8000` for predictions
