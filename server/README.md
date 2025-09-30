CalmSpace Backend (Express)

Minimal server providing an AI plan endpoint for the mobile app.

Endpoints
- GET /health - health check
- POST /api/ai/plan - returns a weekly plan using OpenAI (if key set) or a deterministic fallback; supports Firebase auth and Firestore caching.

Setup (Windows PowerShell)
1) Env file
   Copy .env.example to .env and set what you need:
   - PORT=3000
   - OPENAI_API_KEY=sk-...  OR
   - GEMINI_API_KEY=AIza... (and optionally GEMINI_MODEL=gemini-1.5-flash)
   - AI_PROVIDER=openai|gemini (optional; auto-picks openai if OPENAI_API_KEY set else gemini if GEMINI_API_KEY set)
   - GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json  OR
   - FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...} (JSON string)

2) Install deps
   npm install

3) Start the server
   npm run dev

4) Configure the mobile app base URL
   - Android emulator: http://10.0.2.2:3000 (already set in my-app/app.json extra.apiBase)
   - Real device: http://YOUR_LAN_IP:3000 (update my-app/app.json or set EXPO_PUBLIC_API_BASE)
   - Web: http://localhost:3000 (set EXPO_PUBLIC_API_BASE)

Auth & caching
- If Firebase Admin is configured (via GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT):
  - The server verifies the Bearer ID token sent from the client (Authorization: Bearer <idToken>)
  - Cached plan is read/written at users/{uid}/private/aiPlan with updatedAt serverTimestamp
  - Optional body flag forceRefresh: true will ignore cache and regenerate
- If Admin is not configured, requests proceed unauthenticated and no caching occurs.

Production guards
- Rate limiting: simple in-memory limiter (20 req/min per IP). For multi-instance production, use a shared store (Redis) and a library like express-rate-limit.
- API key: set SERVER_API_KEY in env and send x-api-key header from trusted clients or gateways.

Mobile client base URL order
1) EXPO_PUBLIC_API_BASE
2) expo.extra.apiBase (in my-app/app.json)
3) Fallback http://10.0.2.2:3000
