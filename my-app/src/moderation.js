// Simple moderation utility that calls server-side function (protects API key),
// with a local heuristic fallback if the call fails.
import { auth } from "../firebase/firebaseConfig";

export async function ensurePostIsSafe(text) {
  const trimmed = (text||'').trim();
  if (!trimmed) return { ok: false, reason: "Empty post" };

  // Local heuristic quick check
  const banned = ["hate", "kill", "suicide", "terror", "racist", "sexist"];
  const lower = trimmed.toLowerCase();
  if (banned.some(w => lower.includes(w))) {
    return { ok: false, reason: "Contains disallowed terms" };
  }

  // Call Cloud Function (requires Firebase ID token). If it fails, allow but unflagged.
  try {
    const token = await auth.currentUser?.getIdToken?.();
    const resp = await fetch("https://us-central1-" + (auth?.app?.options?.projectId || "") + ".cloudfunctions.net/moderateText", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ text: trimmed })
    });
    if(!resp.ok) throw new Error('Moderation HTTP ' + resp.status);
    const data = await resp.json();
    if(data?.blocked) return { ok:false, reason: data?.reason || 'Blocked' };
    return { ok:true, flagged: !!data?.flagged };
  } catch(e){
    // Fallback to allow with no flag if server not reachable
    return { ok:true, flagged:false };
  }
}
