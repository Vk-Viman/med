// Mood Entries Service: CRUD + encryption + offline queue
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { db, auth } from '../../firebase/firebaseConfig';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, query, orderBy, limit, startAfter, where, Timestamp } from 'firebase/firestore';
import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';
import * as ExpoCrypto from 'expo-crypto';

// Legacy deterministic key/iv (v1)
function getLegacyKeyIv(uid){
  const key = CryptoJS.enc.Hex.parse(CryptoJS.SHA256(uid + '-key').toString());
  const iv = CryptoJS.enc.Hex.parse(CryptoJS.SHA256(uid + '-iv').toString().slice(0,32));
  return { key, iv };
}

// SecureStore key (v2) management with in-memory + AsyncStorage fallback cache
const SECURE_KEY_ID = 'secure_mood_key_v1'; // base64 encoded 32 random bytes
const SECURE_KEY_CACHE_KEY = 'secure_mood_key_cache_b64';
let memoryKey = null;
// Optional passphrase protection (wrap device key, never store plaintext at rest)
const PASS_WRAP_ENABLED_KEY = 'e2e_passphrase_enabled_v1';
const PASS_WRAP_BLOB_KEY = 'e2e_passphrase_blob_v1'; // JSON string of { encDeviceKey, encIv, kdfSalt, kdfIter, ... }
const PASS_WRAP_BLOB_CACHE_KEY = 'e2e_passphrase_blob_cache_v1';
const LOCAL_ONLY_KEY = 'privacy_local_only_v1';
async function isLocalOnly(){
  try { const v = await AsyncStorage.getItem(LOCAL_ONLY_KEY); return v === '1'; } catch { return false; }
}
export async function setLocalOnlyMode(enabled){
  try { await AsyncStorage.setItem(LOCAL_ONLY_KEY, enabled? '1':'0'); } catch {}
  DeviceEventEmitter.emit('local-only-changed', { enabled });

}
export async function getLocalOnlyMode(){ return isLocalOnly(); }
async function isPassphraseProtectionEnabled(){
  try { const v = await AsyncStorage.getItem(PASS_WRAP_ENABLED_KEY); return v === '1'; } catch { return false; }
}

async function getOrCreateSecureKey(){
  if(memoryKey) return memoryKey;
  // If passphrase wrapping is enabled, we never return a key unless unlocked
  if(await isPassphraseProtectionEnabled()){
    // Attempt to detect if an unlocked session exists; otherwise, signal locked state
    if(memoryKey) return memoryKey;
    const err = new Error('Encryption key locked. Unlock with passphrase.');
    err.code = 'EKEYLOCKED';
    throw err;
  }
  let k = await SecureStore.getItemAsync(SECURE_KEY_ID);
  if(!k){
    // fallback: maybe stored in AsyncStorage cache (e.g., emulator wiped secure store)
    k = await AsyncStorage.getItem(SECURE_KEY_CACHE_KEY);
  }
  if(!k){
    const random = await ExpoCrypto.getRandomBytesAsync(32);
    const keyWA = CryptoJS.lib.WordArray.create(random);
    const b64 = CryptoJS.enc.Base64.stringify(keyWA);
    try { await SecureStore.setItemAsync(SECURE_KEY_ID, b64, { keychainService: SECURE_KEY_ID }); } catch {}
    try { await AsyncStorage.setItem(SECURE_KEY_CACHE_KEY, b64); } catch {}
    k = b64;
  }
  memoryKey = k;
  return k;
}

function base64ToWordArray(b64){
  return CryptoJS.enc.Base64.parse(b64);
}

function randomIvBase64(){
  // 16 bytes IV
  return ExpoCrypto.getRandomBytesAsync(16).then(bytes => {
    const wa = CryptoJS.lib.WordArray.create(bytes);
    return { ivWA: wa, ivB64: CryptoJS.enc.Base64.stringify(wa) };
  });
}

async function encryptV2(plain){
  const base64Key = await getOrCreateSecureKey();
  const keyWA = base64ToWordArray(base64Key); // 32 bytes
  const { ivWA, ivB64 } = await randomIvBase64();
  const ct = CryptoJS.AES.encrypt(plain || '', keyWA, { iv: ivWA, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  return { cipher: ct.toString(), iv: ivB64, encVer: 2, alg: 'aes-256-cbc-pkcs7' };
}

async function decryptV2(cipher, b64Iv){
  try {
    const base64Key = await getOrCreateSecureKey();
    const keyWA = base64ToWordArray(base64Key);
    const ivWA = base64ToWordArray(b64Iv);
    const out = CryptoJS.AES.decrypt(cipher, keyWA, { iv: ivWA, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
    return out.toString(CryptoJS.enc.Utf8);
  } catch { return ''; }
}

const QUEUE_KEY = 'offlineMoodQueue';

async function loadQueue(){
  try{ const raw = await AsyncStorage.getItem(QUEUE_KEY); return raw? JSON.parse(raw): []; }catch{ return []; }
}
async function saveQueue(q){ try{ await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }catch{} }

export async function enqueue(entry){
  const queue = await loadQueue();
  queue.push(entry);
  await saveQueue(queue);
}

export async function flushQueue(){
  const uid = auth.currentUser?.uid; if(!uid) return;
  let queue = await loadQueue();
  if(!queue.length) return;
  const remaining = [];
  let mutated = false;
  for(const item of queue){
    try{
      if(item.op === 'create'){
        await setDoc(doc(db, `users/${uid}/moods`, item.id), item.payload);
        mutated = true;
      } else if(item.op === 'update') {
        await updateDoc(doc(db, `users/${uid}/moods`, item.id), item.payload);
        mutated = true;
      } else if(item.op === 'delete') {
        await deleteDoc(doc(db, `users/${uid}/moods`, item.id));
        mutated = true;
      }
    }catch(e){
      // Keep failed item for next attempt
      remaining.push(item);
    }
  }
  await saveQueue(remaining);
  if(mutated){ try{ await bumpChartCacheVersion(); }catch{} }
}

export async function createMoodEntry({ mood, stress, note }){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  const { cipher, iv, encVer, alg } = await encryptV2(note || '');
  const id = `${Date.now()}`;
  // Derive a numeric moodScore when possible to support insights
  const moodScore = deriveMoodScore(mood);
  const payload = { mood, moodScore, stress, noteCipher: cipher, noteIv: iv, encVer, noteAlg: alg, createdAt: serverTimestamp() };
  if(await isLocalOnly()){
    // queue only (simulate offline) with concrete date
    await enqueue({ op:'create', id, payload: { ...payload, createdAt: new Date() } });
  } else {
    try { await setDoc(doc(db, `users/${uid}/moods`, id), payload); try{ await bumpChartCacheVersion(); }catch{} }
    catch(e){ await enqueue({ op:'create', id, payload: { ...payload, createdAt: new Date() } }); }
  }
  return id;
}

export async function updateMoodEntry(id, { mood, stress, note, legacyToV2=false }){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  let payload;
  if(legacyToV2){
    const { cipher, iv, encVer, alg } = await encryptV2(note || '');
    const moodScore = deriveMoodScore(mood);
    payload = { mood, moodScore, stress, noteCipher: cipher, noteIv: iv, encVer, noteAlg: alg, note: null };
  } else {
    const { cipher, iv, encVer, alg } = await encryptV2(note || '');
    const moodScore = deriveMoodScore(mood);
    payload = { mood, moodScore, stress, noteCipher: cipher, noteIv: iv, encVer, noteAlg: alg };
  }
  if(await isLocalOnly()){
    await enqueue({ op:'update', id, payload });
  } else {
    try { await updateDoc(doc(db, `users/${uid}/moods`, id), payload); try{ await bumpChartCacheVersion(); }catch{} }
    catch(e){ await enqueue({ op:'update', id, payload }); }
  }
}

// --- Helpers ---
function deriveMoodScore(mood){
  if(mood == null) return null;
  if(typeof mood === 'number') return mood;
  // parse numeric string
  const n = parseFloat(mood);
  if(Number.isFinite(n)) return n;
  // map common labels
  const t = String(mood).toLowerCase();
  if(t.includes('happy')) return 9;
  if(t.includes('calm')) return 8;
  if(t.includes('ok') || t.includes('neutral')) return 6;
  if(t.includes('stress')) return 4;
  if(t.includes('sad')) return 2;
  return 5;
}

export async function deleteMoodEntry(id){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  if(await isLocalOnly()){
    await enqueue({ op:'delete', id, payload:{} });
  } else {
    try{ await deleteDoc(doc(db, `users/${uid}/moods`, id)); try{ await bumpChartCacheVersion(); }catch{} }
    catch(e){ await enqueue({ op:'delete', id, payload:{} }); }
  }
}

export async function listMoodEntriesPage({ pageSize=20, after=null }){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  // Basic pagination; 'after' should be a DocumentSnapshot externally, but for simplicity we can return the last snapshot ref
  let qRef = query(collection(db, `users/${uid}/moods`), orderBy('createdAt','desc'), limit(pageSize));
  if(after) qRef = query(collection(db, `users/${uid}/moods`), orderBy('createdAt','desc'), startAfter(after), limit(pageSize));
  const snap = await getDocs(qRef);
  const docs = [];
  snap.forEach(d => docs.push(d));
  return { docs, last: snap.docs[snap.docs.length-1] || null };
}

// Retrieve all entries within the last N days (inclusive) ordered ascending by createdAt for charting
export async function listMoodEntriesSince({ days=7 }){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // today 00:00
  start.setDate(start.getDate() - (days - 1));
  const startTs = Timestamp.fromDate(start);
  // createdAt may be null for unsynced offline entries; those will be excluded
  const qRef = query(collection(db, `users/${uid}/moods`), where('createdAt','>=', startTs), orderBy('createdAt','asc'));
  const snap = await getDocs(qRef);
  const docs = [];
  snap.forEach(d => docs.push(d));
  return docs; // array of DocumentSnapshots
}

// Between inclusive start/end (Date objects with time 00:00 recommended)
export async function listMoodEntriesBetween({ startDate, endDate }){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  if(!startDate || !endDate) return [];
  const startTs = Timestamp.fromDate(startDate);
  // end inclusive -> move to end of day by adding 23:59:59.999
  const endBoundary = new Date(endDate.getTime());
  endBoundary.setHours(23,59,59,999);
  const endTs = Timestamp.fromDate(endBoundary);
  const qRef = query(collection(db, `users/${uid}/moods`), where('createdAt','>=', startTs), where('createdAt','<=', endTs), orderBy('createdAt','asc'));
  const snap = await getDocs(qRef);
  const docs = [];
  snap.forEach(d => docs.push(d));
  return docs;
}

// ===== Lightweight caching for chart-friendly public data (mood, stress, createdAt) =====
// We avoid caching decrypted notes (sensitive). Cache TTL defaults to 5 minutes.
const CHART_CACHE_PREFIX = 'cache_chart_v1';
const CHART_CACHE_VER_PREFIX = 'cache_chart_ver_v1';
function chartVerKey(uid){ return `${CHART_CACHE_VER_PREFIX}:${uid}`; }
async function getChartCacheVersion(uid){
  try { const v = await AsyncStorage.getItem(chartVerKey(uid)); return v ? Number(v) : 1; } catch { return 1; }
}
async function bumpChartCacheVersion(){
  const uid = auth.currentUser?.uid; if(!uid) return;
  try { const cur = await getChartCacheVersion(uid); await AsyncStorage.setItem(chartVerKey(uid), String(cur + 1)); } catch {}
}
function chartCacheKey(kind, uid, extra, ver){
  return `${CHART_CACHE_PREFIX}:v${ver}:${kind}:${uid}:${extra}`;
}
async function cacheGet(key){
  try{ const raw = await AsyncStorage.getItem(key); if(!raw) return null; const parsed = JSON.parse(raw); return parsed || null; }catch{ return null; }
}
async function cacheSet(key, value){
  try{ await AsyncStorage.setItem(key, JSON.stringify(value)); }catch{}
}

// Returns [{ createdAtSec, mood, moodScore, stress }]
export async function getChartDataSince({ days = 7, ttlMs = 5 * 60 * 1000 } = {}){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  const ver = await getChartCacheVersion(uid);
  const key = chartCacheKey('since', uid, days, ver);
  const now = Date.now();
  const cached = await cacheGet(key);
  if(cached && (now - (cached.ts || 0) < ttlMs)){
    return cached.rows || [];
  }
  const docs = await listMoodEntriesSince({ days });
  const rows = docs.map(d => {
    const data = d.data();
    const createdAtSec = data.createdAt?.seconds || null;
    const mood = data.mood;
    const stressRaw = data.stress ?? data.stressScore;
    const stress = typeof stressRaw === 'string' ? parseFloat(stressRaw) : stressRaw;
    const moodScore = data.moodScore ?? deriveMoodScore(mood);
    return { createdAtSec, mood, moodScore, stress: Number.isFinite(stress) ? stress : null };
  });
  await cacheSet(key, { ts: now, rows });
  return rows;
}

export async function getChartDataBetween({ startDate, endDate, ttlMs = 5 * 60 * 1000 } = {}){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  if(!startDate || !endDate) return [];
  const ver = await getChartCacheVersion(uid);
  const extra = `${startDate.toISOString().slice(0,10)}_${endDate.toISOString().slice(0,10)}`;
  const key = chartCacheKey('between', uid, extra, ver);
  const now = Date.now();
  const cached = await cacheGet(key);
  if(cached && (now - (cached.ts || 0) < ttlMs)){
    return cached.rows || [];
  }
  const docs = await listMoodEntriesBetween({ startDate, endDate });
  const rows = docs.map(d => {
    const data = d.data();
    const createdAtSec = data.createdAt?.seconds || null;
    const mood = data.mood;
    const stressRaw = data.stress ?? data.stressScore;
    const stress = typeof stressRaw === 'string' ? parseFloat(stressRaw) : stressRaw;
    const moodScore = data.moodScore ?? deriveMoodScore(mood);
    return { createdAtSec, mood, moodScore, stress: Number.isFinite(stress) ? stress : null };
  });
  await cacheSet(key, { ts: now, rows });
  return rows;
}

// Public invalidation API for other modules if needed
export async function invalidateChartCache(){
  await bumpChartCacheVersion();
}

export async function decryptEntry(uid, entry){
  // v2 path
  if(entry.encVer === 2 && entry.noteCipher && entry.noteIv){
    const note = await decryptV2(entry.noteCipher, entry.noteIv);
    return { ...entry, note };
  }
  // legacy fallback
  try {
    if(!entry.note) return { ...entry, note:'' };
    const { key, iv } = getLegacyKeyIv(uid);
    const note = CryptoJS.AES.decrypt(entry.note, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString(CryptoJS.enc.Utf8) || '';
    return { ...entry, note, legacy:true };
  } catch { return { ...entry, note:'', legacy:true }; }
}

// Export: fetch ALL entries (paginated manually) decrypt and return plain objects
export async function exportAllMoodEntries(){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  // naive full collection scan ordered by createdAt asc
  const qRef = query(collection(db, `users/${uid}/moods`), orderBy('createdAt','asc'));
  const snap = await getDocs(qRef);
  const out = [];
  for(const d of snap.docs){
    const base = { id:d.id, ...d.data() };
    const dec = await decryptEntry(uid, base);
    out.push({
      id: dec.id,
      mood: dec.mood,
      stress: dec.stress,
      note: dec.note || '',
      createdAt: dec.createdAt?.seconds ? new Date(dec.createdAt.seconds*1000).toISOString() : null,
      encVer: dec.encVer || 2,
      legacy: !!dec.legacy
    });
  }
  return out;
}

// Export: only entries within inclusive date range (Date objects, recommended 00:00 for start)
export async function exportMoodEntriesBetween({ startDate, endDate }){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  if(!startDate || !endDate) return [];
  const docs = await listMoodEntriesBetween({ startDate, endDate });
  const out = [];
  for(const d of docs){
    const base = { id:d.id, ...d.data() };
    const dec = await decryptEntry(uid, base);
    out.push({
      id: dec.id,
      mood: dec.mood,
      stress: dec.stress,
      note: dec.note || '',
      createdAt: dec.createdAt?.seconds ? new Date(dec.createdAt.seconds*1000).toISOString() : null,
      encVer: dec.encVer || 2,
      legacy: !!dec.legacy
    });
  }
  return out;
}

export function buildMoodCSV(rows){
  const header = 'id,date,mood,stress,noteLength,encVer,legacy';
  const lines = rows.map(r=>{
    const date = r.createdAt || '';
    const mood = (r.mood||'').replace(/,/g,' ');
    const noteLen = r.note? r.note.length:0;
    return `${r.id},${date},${mood},${r.stress},${noteLen},${r.encVer},${r.legacy}`;
  });
  return [header, ...lines].join('\n');
}

export function buildMoodMarkdown(rows){
  const lines = ['# Mood Entries Export','', `Exported: ${new Date().toISOString()}`,''];
  rows.forEach(r=>{
    lines.push(`## ${r.createdAt || 'Unknown Date'} — Mood: ${r.mood} (Stress: ${r.stress})`);
    if(r.note){ lines.push('', r.note.trim(), ''); } else { lines.push('', '_No note_', ''); }
  });
  return lines.join('\n');
}

export async function deleteAllMoodEntries(){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  const qRef = query(collection(db, `users/${uid}/moods`));
  const snap = await getDocs(qRef);
  // Firestore has no multi-delete in one request without batch; small batches here
  const batchSize = 400; // safety limit
  let current = [];
  for(const d of snap.docs){
    current.push(d);
    if(current.length === batchSize){
      await Promise.all(current.map(docSnap=> deleteDoc(doc(db, `users/${uid}/moods`, docSnap.id))));
      current = [];
    }
  }
  if(current.length){
    await Promise.all(current.map(docSnap=> deleteDoc(doc(db, `users/${uid}/moods`, docSnap.id))));
  }
  // also clear offline queue since stale operations might recreate data
  try { await AsyncStorage.removeItem('offlineMoodQueue'); } catch {}
  try { await bumpChartCacheVersion(); } catch {}
}

// Lightweight summary: latest mood entry & streak (consecutive days including today)
export async function getMoodSummary({ streakLookbackDays = 14 } = {}){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  // Fetch last N days ascending
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - (streakLookbackDays - 1));
  const startTs = Timestamp.fromDate(start);
  const qRef = query(collection(db, `users/${uid}/moods`), where('createdAt','>=', startTs), orderBy('createdAt','asc'));
  const snap = await getDocs(qRef);
  const items = [];
  snap.forEach(d=> items.push({ id:d.id, ...d.data() }));
  // Latest
  let latest = null;
  if(items.length){
    const last = items[items.length-1];
    latest = { id:last.id, mood:last.mood, stress:last.stress, createdAt: last.createdAt?.seconds? new Date(last.createdAt.seconds*1000): null };
  }
  // Streak calc: count back from today consecutive days that have at least one entry
  const byDay = new Map();
  items.forEach(it=>{ if(it.createdAt?.seconds){ const dt = new Date(it.createdAt.seconds*1000); const key = dt.toISOString().slice(0,10); byDay.set(key, true); }});
  let streak = 0;
  for(let i=0; i<streakLookbackDays; i++){
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    if(byDay.has(key)) streak++; else break;
  }
  return { latest, streak };
}

// --- Debug / Dev only functions ---
export async function __getExistingDeviceKeyBase64(){
  return getOrCreateSecureKey();
}

// --- Key Escrow (passphrase protected export/import) ---
// Derive 32-byte key via PBKDF2 (CryptoJS) using 100k iterations SHA256
function pbkdf2Key(passphrase, saltB64){
  const salt = CryptoJS.enc.Base64.parse(saltB64);
  const key = CryptoJS.PBKDF2(passphrase, salt, { keySize: 256/32, iterations: 100000, hasher: CryptoJS.algo.SHA256 });
  return key; // WordArray
}
export async function escrowEncryptDeviceKey(passphrase){
  const deviceKeyB64 = await getOrCreateSecureKey();
  const saltBytes = await ExpoCrypto.getRandomBytesAsync(16);
  const saltWA = CryptoJS.lib.WordArray.create(saltBytes);
  const saltB64 = CryptoJS.enc.Base64.stringify(saltWA);
  const derived = pbkdf2Key(passphrase, saltB64);
  // Encrypt device key string with derived key using random IV
  const { ivWA, ivB64 } = await randomIvBase64();
  const ct = CryptoJS.AES.encrypt(deviceKeyB64, derived, { iv: ivWA, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  return { encDeviceKey: ct.toString(), encIv: ivB64, kdfSalt: saltB64, kdfIter: 100000, kdfAlg:'pbkdf2-sha256', encAlg:'aes-256-cbc-pkcs7' };
}
export async function escrowDecryptDeviceKey(passphrase, { encDeviceKey, encIv, kdfSalt }){
  try {
    const derived = pbkdf2Key(passphrase, kdfSalt);
    const ivWA = CryptoJS.enc.Base64.parse(encIv);
    const pt = CryptoJS.AES.decrypt(encDeviceKey, derived, { iv: ivWA, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString(CryptoJS.enc.Utf8);
    // If escrow import is used to restore this device key, persist it
    if(pt){
      try { await SecureStore.setItemAsync(SECURE_KEY_ID, pt, { keychainService: SECURE_KEY_ID }); } catch {}
      try { await AsyncStorage.setItem(SECURE_KEY_CACHE_KEY, pt); } catch {}
      memoryKey = pt;
      return pt;
    }
    return null;
  } catch { return null; }
}

// ===== Optional Passphrase Protection (wrap device key locally) =====
export async function getEncryptionStatus(){
  const passEnabled = await isPassphraseProtectionEnabled();
  return { encVer: 2, algorithm: 'aes-256-cbc-pkcs7', passphraseProtected: passEnabled };
}

export async function enablePassphraseProtection(passphrase){
  if(!passphrase || passphrase.length < 6) throw new Error('Passphrase must be at least 6 characters.');
  // Ensure we have a device key; if passphrase already enabled, try to use current memoryKey (unlocked)
  let deviceKeyB64;
  if(await isPassphraseProtectionEnabled()){
    if(!memoryKey){ const err = new Error('Key is locked. Unlock first.'); err.code = 'EKEYLOCKED'; throw err; }
    deviceKeyB64 = memoryKey;
  } else {
    deviceKeyB64 = await getOrCreateSecureKey();
  }
  // Wrap it
  const saltBytes = await ExpoCrypto.getRandomBytesAsync(16);
  const saltWA = CryptoJS.lib.WordArray.create(saltBytes);
  const saltB64 = CryptoJS.enc.Base64.stringify(saltWA);
  const derived = pbkdf2Key(passphrase, saltB64);
  const { ivWA, ivB64 } = await randomIvBase64();
  const ct = CryptoJS.AES.encrypt(deviceKeyB64, derived, { iv: ivWA, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  const blob = JSON.stringify({ encDeviceKey: ct.toString(), encIv: ivB64, kdfSalt: saltB64, kdfIter: 100000, kdfAlg:'pbkdf2-sha256', encAlg:'aes-256-cbc-pkcs7' });
  // Persist wrapped blob, and remove plaintext at rest
  try { await SecureStore.setItemAsync(PASS_WRAP_BLOB_KEY, blob, { keychainService: PASS_WRAP_BLOB_KEY }); } catch {}
  try { await AsyncStorage.setItem(PASS_WRAP_BLOB_CACHE_KEY, blob); } catch {}
  try { await AsyncStorage.setItem(PASS_WRAP_ENABLED_KEY, '1'); } catch {}
  // Remove plaintext device key from storage (keep in-memory for current session)
  try { await SecureStore.deleteItemAsync(SECURE_KEY_ID, { keychainService: SECURE_KEY_ID }); } catch {}
  try { await AsyncStorage.removeItem(SECURE_KEY_CACHE_KEY); } catch {}
  // Keep memoryKey as-is for current session (already set above)
  return true;
}

export async function unlockWithPassphrase(passphrase){
  if(!passphrase) throw new Error('Passphrase required');
  if(!(await isPassphraseProtectionEnabled())) return true; // nothing to do
  // Load blob
  let blob = await SecureStore.getItemAsync(PASS_WRAP_BLOB_KEY);
  if(!blob){ blob = await AsyncStorage.getItem(PASS_WRAP_BLOB_CACHE_KEY); }
  if(!blob) throw new Error('No wrapped key found on this device.');
  let parsed; try { parsed = JSON.parse(blob); } catch { throw new Error('Wrapped key is corrupt.'); }
  const { encDeviceKey, encIv, kdfSalt } = parsed;
  const derived = pbkdf2Key(passphrase, kdfSalt);
  const ivWA = CryptoJS.enc.Base64.parse(encIv);
  const pt = CryptoJS.AES.decrypt(encDeviceKey, derived, { iv: ivWA, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString(CryptoJS.enc.Utf8);
  if(!pt) throw new Error('Incorrect passphrase.');
  // Cache in memory for this session only
  memoryKey = pt;
  return true;
}

export async function disablePassphraseProtection(){
  if(!(await isPassphraseProtectionEnabled())) return true;
  if(!memoryKey){ const err = new Error('Key is locked. Unlock first.'); err.code='EKEYLOCKED'; throw err; }
  // Re-store plaintext device key back to secure storage (maintain AsyncStorage cache as fallback)
  try { await SecureStore.setItemAsync(SECURE_KEY_ID, memoryKey, { keychainService: SECURE_KEY_ID }); } catch {}
  try { await AsyncStorage.setItem(SECURE_KEY_CACHE_KEY, memoryKey); } catch {}
  try { await AsyncStorage.setItem(PASS_WRAP_ENABLED_KEY, '0'); } catch {}
  try { await SecureStore.deleteItemAsync(PASS_WRAP_BLOB_KEY, { keychainService: PASS_WRAP_BLOB_KEY }); } catch {}
  try { await AsyncStorage.removeItem(PASS_WRAP_BLOB_CACHE_KEY); } catch {}
  return true;
}

export function lockEncryptionKey(){ memoryKey = null; return true; }

// ===== Migration: Legacy deterministic (v1) -> v2 (random key + per-entry IV) =====
export async function migrateLegacyToV2({ dryRun=false } = {}){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  const qRef = query(collection(db, `users/${uid}/moods`));
  const snap = await getDocs(qRef);
  let total=0, legacyFound=0, migrated=0, failed=0;
  for(const d of snap.docs){
    total++;
    const data = d.data();
    const isLegacy = !!data.note && !(data.encVer === 2 && data.noteCipher && data.noteIv);
    if(!isLegacy) continue;
    legacyFound++;
    if(dryRun) continue;
    try{
      const { key, iv } = getLegacyKeyIv(uid);
      const note = CryptoJS.AES.decrypt(data.note, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString(CryptoJS.enc.Utf8) || '';
      const { cipher, iv: newIv, encVer, alg } = await encryptV2(note || '');
      await updateDoc(doc(db, `users/${uid}/moods`, d.id), { noteCipher: cipher, noteIv: newIv, encVer, noteAlg: alg, note: null });
      migrated++;
    }catch(e){ failed++; }
  }
  return { total, legacyFound, migrated, failed, dryRun };
}

// ===== Backfill: Populate numeric moodScore for historical entries =====
// Computes moodScore from stored mood field when missing, limited to a recent window
// Returns a summary: { scanned, updated, skipped, days }
export async function backfillMoodScores({ days = 90 } = {}){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  if(days && (!Number.isFinite(days) || days <= 0)) days = 90;
  // Build time window starting at 00:00 for (days-1) days ago
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - (days - 1));
  const startTs = Timestamp.fromDate(start);
  const qRef = query(collection(db, `users/${uid}/moods`), where('createdAt','>=', startTs), orderBy('createdAt','asc'));
  const snap = await getDocs(qRef);
  let scanned = 0, updated = 0, skipped = 0;
  for(const d of snap.docs){
    scanned++;
    const data = d.data();
    // Only backfill if moodScore missing or null and mood exists
    const hasScore = data.moodScore !== undefined && data.moodScore !== null;
    if(hasScore){ skipped++; continue; }
    const score = deriveMoodScore(data.mood);
    if(score === null || score === undefined){ skipped++; continue; }
    try {
      await updateDoc(doc(db, `users/${uid}/moods`, d.id), { moodScore: score });
      updated++;
    } catch(e){ skipped++; }
  }
  try { if(updated>0) await bumpChartCacheVersion(); } catch {}
  return { scanned, updated, skipped, days };
}
