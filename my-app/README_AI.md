AI integration (OpenAI) — Secure setup

Never embed your OpenAI API key in the mobile app. Mobile bundles are extractable, and keys can be abused. Use a backend proxy instead.

Recommended pattern
- Create a tiny server with a single /ai endpoint that:
  1) Authenticates the user/session (optional but recommended)
  2) Adds your OpenAI API key (from server env vars)
  3) Forwards the request to OpenAI’s REST API
  4) Returns the response JSON
- Lock down rate limits and usage policies server-side.

Mobile client
- Use src/services/aiClient.js which targets a backend base URL (extra.apiBase).
- Configure app.json (or app.config.js) to include extra.apiBase per environment.

Example backend (Express)

const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

app.post('/ai/chat', async (req, res) => {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(req.body)
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.listen(3000, () => console.log('AI proxy running on :3000'));

Expo config
- In app.json add:

{
  "expo": {
    "extra": {
      "apiBase": "http://10.0.2.2:3000" // Android emulator; use your LAN IP on device
    }
  }
}

Security notes
- Keys in client apps are not secure. Always keep OPENAI_API_KEY on the server.
- Add auth (e.g., Firebase auth tokens) and verify on the server before forwarding requests.
- Set sensible rate limits and input validation.
- Log minimal metadata; avoid logging raw prompts or responses unless necessary for debugging with proper privacy controls.
