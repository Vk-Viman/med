// AI Client — mobile-safe pattern
// Do NOT embed your OpenAI API key in this client or anywhere in the app bundle.
// Instead, expose a minimal server endpoint that proxies requests to OpenAI.
// This keeps your key private and lets you add rate limits, auth, and guardrails.

import Constants from 'expo-constants';
import { auth } from '../../firebase/firebaseConfig';

// Config: set your backend URL via app config or hardcode for dev
// Recommended: use extra.apiBase in app.json/app.config.js and read via expo-constants.
const API_BASE =
  // Prefer public env var on web/static
  (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_API_BASE) ||
  // Expo runtime constants
  Constants?.expoConfig?.extra?.apiBase ||
  Constants?.manifest?.extra?.apiBase ||
  // Sensible local default (Android emulator)
  'http://10.0.2.2:3000';

// Optional API key guard support
const SERVER_API_KEY =
  (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_SERVER_API_KEY) ||
  Constants?.expoConfig?.extra?.serverApiKey ||
  Constants?.manifest?.extra?.serverApiKey ||
  null;

/**
 * callAI
 * - path: backend route, e.g. "/ai/chat" or "/ai/embeddings"
 * - body: JSON payload (e.g., { messages: [...] })
 * The backend must attach the OpenAI key and forward request to OpenAI's API.
 */
export async function callAI(path, body, { signal, timeoutMs = 6000, includeAuth = true } = {}){
  if(!path.startsWith('/')) path = `/${path}`;
  const url = `${API_BASE}${path}`;
  // If no signal provided, create a timeout to fail fast on mobile when backend is not set
  let controller;
  let timer;
  if (!signal && timeoutMs > 0 && typeof AbortController !== 'undefined') {
    controller = new AbortController();
    timer = setTimeout(()=> controller.abort('timeout'), timeoutMs);
  }
  const doFetch = async (withAuth) => {
    const headers = { 'Content-Type': 'application/json' };
    if (SERVER_API_KEY) headers['x-api-key'] = SERVER_API_KEY;
    if (withAuth && auth?.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch {}
    }
    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body||{}),
      signal: signal || controller?.signal,
    });
  };

  let res = await doFetch(includeAuth);
  // If auth token was rejected (e.g., admin misconfig), retry once without Authorization
  if (!res.ok && res.status === 401 && includeAuth) {
    try { res = await doFetch(false); } catch {}
  }
  if (timer) clearTimeout(timer);
  if(!res.ok){
    const txt = await res.text().catch(()=> '');
    throw new Error(`AI request failed (${res.status}): ${txt}`);
  }
  return res.json();
}

/**
 * Example usage:
 *
 * import { callAI } from '../services/aiClient';
 * const reply = await callAI('/ai/chat', {
 *   model: 'gpt-4o-mini',
 *   messages: [
 *     { role: 'system', content: 'You are a helpful meditation coach.' },
 *     { role: 'user', content: 'Help me unwind in 5 minutes.' }
 *   ]
 * });
 * console.log(reply);
 */
