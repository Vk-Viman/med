import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

dotenv.config();

// Firebase Admin init (optional for local dev)
let adminApp = null;
try {
  const hasCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!admin.apps.length && hasCreds) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(svc)
      });
    } else {
      adminApp = admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    }
  }
} catch (e) {
  console.warn('Firebase admin not initialized:', e?.message || e);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*'}));
app.use(express.json({ limit: '1mb' }));

// Minimal in-memory rate limiter per IP (window: 1 minute, limit: 20)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const ipHits = new Map();
app.use((req, res, next) => {
  const now = Date.now();
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const rec = ipHits.get(ip) || { count: 0, reset: now + RATE_LIMIT_WINDOW_MS };
  if (now > rec.reset) {
    rec.count = 0; rec.reset = now + RATE_LIMIT_WINDOW_MS;
  }
  rec.count += 1;
  ipHits.set(ip, rec);
  if (rec.count > RATE_LIMIT_MAX) return res.status(429).json({ error: 'Too many requests' });
  next();
});

// Optional server API key guard (set SERVER_API_KEY in env and send x-api-key header)
app.use((req, res, next) => {
  const requiredKey = process.env.SERVER_API_KEY;
  if (!requiredKey) return next();
  const sent = req.headers['x-api-key'];
  if (sent && sent === requiredKey) return next();
  return res.status(401).json({ error: 'Unauthorized' });
});

function resolveProvider(){
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const p = (process.env.AI_PROVIDER || '').toLowerCase();
  if (p === 'openai' || p === 'gemini' || p === 'fallback') return p;
  if (OPENAI_API_KEY) return 'openai';
  if (GEMINI_API_KEY) return 'gemini';
  return 'fallback';
}

app.get('/health', (req, res) => res.json({
  ok: true,
  uptime: process.uptime(),
  provider: resolveProvider(),
  hasOpenAI: !!process.env.OPENAI_API_KEY,
  hasGemini: !!process.env.GEMINI_API_KEY
}));
// Push: send a test message to a device token
app.post('/api/push/test', async (req, res) => {
  try {
    if (!adminApp) return res.status(400).json({ error: 'firebase-admin not initialized' });
    const { token, title = 'Test', body = 'Hello', data = {} } = req.body || {};
    if (!token) return res.status(400).json({ error: 'token required' });
    const msg = {
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k,v]) => [String(k), String(v)])),
      android: {
        priority: 'high',
        notification: { channelId: 'default' }
      },
    };
    const id = await admin.messaging().send(msg);
    return res.json({ ok: true, id });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

// Push: send to a user by UID (reads saved fcmToken from Firestore at users/{uid}/private/push)
app.post('/api/push/user/:uid', async (req, res) => {
  try {
    if (!adminApp) return res.status(400).json({ error: 'firebase-admin not initialized' });
    const { uid } = req.params;
    const { title = 'Reminder', body = 'Time to meditate', data = {} } = req.body || {};
    const snap = await admin.firestore().doc(`users/${uid}/private/push`).get();
    const doc = snap.exists ? snap.data() : null;
    const token = doc?.fcmToken || null;
    if (!token) return res.status(404).json({ error: 'no fcmToken for user' });
    const msg = {
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k,v]) => [String(k), String(v)])),
      android: { priority: 'high', notification: { channelId: 'default' } },
    };
    const id = await admin.messaging().send(msg);
    return res.json({ ok: true, id });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

// Debug endpoint: list Gemini models visible to this API key (names + methods)
app.get('/debug/models', async (req, res) => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return res.status(400).json({ error: 'No GEMINI_API_KEY configured' });
  const versions = ['v1beta', 'v1'];
  const out = [];
  for (const v of versions) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/${v}/models?key=${GEMINI_API_KEY}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error?.message || JSON.stringify(data));
      const items = (data.models || []).map(m => ({ name: m.name, version: v, methods: m.supportedGenerationMethods }));
      out.push(...items);
    } catch (e) {
      out.push({ version: v, error: String(e?.message || e) });
    }
  }
  return res.json({ models: out });
});

// POST /api/ai/plan — proxies to OpenAI; falls back to deterministic plan
app.post('/api/ai/plan', async (req, res) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const payload = sanitizePayload(req.body || {});
  const forceRefresh = !!payload.forceRefresh;

  // Verify Firebase ID token (if admin available)
  let uid = null;
  try {
    const authz = req.headers['authorization'] || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
    if (token && adminApp) {
      const decoded = await admin.auth().verifyIdToken(token);
      uid = decoded.uid;
    }
  } catch (e) {
    // In dev without admin, continue unauthenticated; otherwise require auth
    if (adminApp) return res.status(401).json({ error: 'Invalid auth token' });
  }

  // If authenticated and not forceRefresh, try to read cached plan
  if (adminApp && uid && !forceRefresh) {
    try {
      const docRef = admin.firestore().doc(`users/${uid}/private/aiPlan`);
      const snap = await docRef.get();
      const data = snap.exists ? snap.data() : null;
      // Return cached if present and fresh (<= 7 days old)
      if (data?.plan && data?.updatedAt) {
        const ageMs = Date.now() - (data.updatedAt._seconds ? data.updatedAt._seconds * 1000 : data.updatedAt);
        if (ageMs <= (7 * 24 * 60 * 60 * 1000)) {
          return res.status(200).json({ plan: data.plan, source: 'cache' });
        }
      }
    } catch (e) {
      console.warn('Cache read failed:', e?.message || e);
    }
  }

  const provider = resolveProvider();
  console.log('[AI] provider:', provider);
  if (provider === 'fallback') {
    const plan = buildFallbackPlan(payload, { forceRefresh });
    return res.status(200).json({ plan, source: 'fallback' });
  }

  try {
    const system = `You are a helpful meditation coach. Generate a personalized weekly meditation plan.\nReturn STRICT JSON that matches this TypeScript type exactly:\n{\n  version: string;\n  rationale: string;\n  week: Array<{ day: 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun'; totalMinutes: number; blocks: Array<{ title: string; theme: string; minutes: number; type: 'guided'|'breath'|'music'|'silent' }>}>;\n}\nRules: Keep weekly minutes close to availability; use preferences & goals for cold start; adjust difficulty for streak/history; vary themes; prefer 1-2 blocks/day.`;
    const user = `User context JSON:\n${JSON.stringify(payload)}`;
    let parsed = null;
    let source = provider;
    if (provider === 'openai') {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      };
      if (process.env.OPENAI_ORG) headers['OpenAI-Organization'] = process.env.OPENAI_ORG;
      if (process.env.OPENAI_PROJECT) headers['OpenAI-Project'] = process.env.OPENAI_PROJECT;
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: payload.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error?.message || `OpenAI error ${r.status}`);
      const raw = data?.choices?.[0]?.message?.content || '{}';
      try { parsed = JSON.parse(raw); } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : null;
      }
      if (!parsed?.week) throw new Error('AI returned unexpected format');
      source = 'openai';
    } else if (provider === 'gemini') {
      // Try multiple API versions and model aliases for better compatibility with AI Studio keys.
      const baseModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      let modelsToTry = Array.from(new Set([
        baseModel,
        baseModel.endsWith('-latest') ? baseModel : `${baseModel}-latest`,
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro-latest',
        'gemini-1.5-flash-001',
        'gemini-1.5-pro-001',
        'gemini-1.0-pro',
        'gemini-pro'
      ].filter(Boolean)));
      const apiVersions = ['v1beta', 'v1'];
      const attemptErrors = [];
      let success = false;
      // Discover models dynamically via ListModels and prepend those that support generateContent
      try {
        const discovered = [];
        for (const apiVer of apiVersions) {
          const listUrl = `https://generativelanguage.googleapis.com/${apiVer}/models?key=${GEMINI_API_KEY}`;
          const lr = await fetch(listUrl);
          const ld = await lr.json();
          if (lr.ok && Array.isArray(ld.models)) {
            ld.models.forEach(m => {
              const name = m.name?.split('/').pop();
              const methods = m.supportedGenerationMethods || [];
              if (name && methods.includes('generateContent')) discovered.push(name);
            });
          }
        }
        if (discovered.length) {
          const set = new Set([...discovered, ...modelsToTry]);
          modelsToTry = Array.from(set);
        }
      } catch {}
      console.log('[AI][gemini] trying apiVersions=', apiVersions, 'models=', modelsToTry);
      for (const apiVer of apiVersions) {
        for (const mdl of modelsToTry) {
          try {
            const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${mdl}:generateContent?key=${GEMINI_API_KEY}`;
            const r = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  { role: 'user', parts: [{ text: `${system}\n\n${user}` }] }
                ]
              })
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error?.message || JSON.stringify(data) || `Gemini error ${r.status}`);
            const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            try { parsed = JSON.parse(raw); } catch {
              const m = raw?.match && raw.match(/\{[\s\S]*\}/);
              parsed = m ? JSON.parse(m[0]) : null;
            }
            if (!parsed?.week) throw new Error('AI returned unexpected format');
            source = 'gemini';
            // annotate for debugging (non-breaking for client)
            parsed._meta = { provider: 'gemini', model: mdl, apiVersion: apiVer };
            success = true;
            break;
          } catch (e) {
            attemptErrors.push(`[${apiVer}/${mdl}] ${e?.message || e}`);
          }
        }
        if (success) break;
      }
      if (!success) throw new Error(attemptErrors.join(' | '));
    }

    // Persist if authenticated and admin available
    if (adminApp && uid) {
      try {
        const docRef = admin.firestore().doc(`users/${uid}/private/aiPlan`);
        await docRef.set({ plan: parsed, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      } catch (e) {
        console.warn('Cache write failed:', e?.message || e);
      }
    }
    return res.status(200).json({ plan: parsed, source });
  } catch (e) {
    console.warn('[AI] error:', e?.message || e);
    const plan = buildFallbackPlan(payload);
    // Persist fallback as well (optional), so user still sees consistency
    if (adminApp && uid) {
      try {
        const docRef = admin.firestore().doc(`users/${uid}/private/aiPlan`);
        await docRef.set({ plan, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      } catch {}
    }
    return res.status(200).json({ plan, source: 'fallback', error: String(e?.message || e) });
  }
});

function sanitizePayload(body){
  const { profile = {}, history = {}, preferences = {}, availability = {}, model } = body || {};
  return { profile, history, preferences, availability, model };
}

function buildFallbackPlan(input, { forceRefresh = false } = {}){
  const mins = Number(input?.availability?.weeklyMinutes || 70) || 70;
  const perDay = Math.max(5, Math.round(mins / 7));
  const themesBase = (input?.preferences?.themes && input.preferences.themes.length)
    ? input.preferences.themes
    : ['breath', 'calm', 'focus', 'gratitude', 'sleep', 'stress-relief', 'mindfulness'];
  // Rotate themes when forcing refresh to add small variation without AI
  const offset = forceRefresh ? Math.floor(Math.random() * themesBase.length) : 0;
  const themes = themesBase.map((_, i) => themesBase[(i + offset) % themesBase.length]);
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const deltaPattern = forceRefresh ? [0,1,0,-1,0,1,0] : [0,0,0,0,0,0,0];
  const blocks = d => [{ title: 'Daily Practice', theme: themes[d % themes.length] || 'mindfulness', minutes: Math.max(5, perDay + deltaPattern[d % deltaPattern.length]), type: 'guided' }];
  return { version: 'v1-fallback', rationale: forceRefresh ? 'Refreshed fallback plan with slight variation.' : 'Fallback plan based on availability and generic themes.', week: days.map((day,i)=> { const m = Math.max(5, perDay + deltaPattern[i % deltaPattern.length]); return ({ day, totalMinutes: m, blocks: blocks(i) }); }) };
}

app.listen(PORT, () => console.log(`CalmSpace server listening on :${PORT}`));
