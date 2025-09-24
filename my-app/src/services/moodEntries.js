// Mood Entries Service: CRUD + encryption + offline queue
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from '../../firebase/firebaseConfig';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, query, orderBy, limit, startAfter } from 'firebase/firestore';
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
async function getOrCreateSecureKey(){
  if(memoryKey) return memoryKey;
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
  for(const item of queue){
    try{
      if(item.op === 'create'){
        await setDoc(doc(db, `users/${uid}/moods`, item.id), item.payload);
      } else if(item.op === 'update') {
        await updateDoc(doc(db, `users/${uid}/moods`, item.id), item.payload);
      } else if(item.op === 'delete') {
        await deleteDoc(doc(db, `users/${uid}/moods`, item.id));
      }
    }catch(e){
      // Keep failed item for next attempt
      remaining.push(item);
    }
  }
  await saveQueue(remaining);
}

export async function createMoodEntry({ mood, stress, note }){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  const { cipher, iv, encVer, alg } = await encryptV2(note || '');
  const id = `${Date.now()}`;
  const payload = { mood, stress, noteCipher: cipher, noteIv: iv, encVer, noteAlg: alg, createdAt: serverTimestamp(), noteLen: (note||'').length };
  try {
    await setDoc(doc(db, `users/${uid}/moods`, id), payload);
  } catch(e){
    await enqueue({ op:'create', id, payload: { ...payload, createdAt: new Date() } });
  }
  return id;
}

export async function updateMoodEntry(id, { mood, stress, note, legacyToV2=false }){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  let payload;
  if(legacyToV2){
    const { cipher, iv, encVer, alg } = await encryptV2(note || '');
    payload = { mood, stress, noteCipher: cipher, noteIv: iv, encVer, noteAlg: alg, note: null, noteLen: (note||'').length };
  } else {
    const { cipher, iv, encVer, alg } = await encryptV2(note || '');
    payload = { mood, stress, noteCipher: cipher, noteIv: iv, encVer, noteAlg: alg, noteLen: (note||'').length };
  }
  try { await updateDoc(doc(db, `users/${uid}/moods`, id), payload); }
  catch(e){ await enqueue({ op:'update', id, payload }); }
}

export async function deleteMoodEntry(id){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  try{ await deleteDoc(doc(db, `users/${uid}/moods`, id)); }
  catch(e){ await enqueue({ op:'delete', id, payload:{} }); }
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
