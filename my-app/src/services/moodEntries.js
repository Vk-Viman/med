// Mood Entries Service: CRUD + encryption + offline queue
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from '../../firebase/firebaseConfig';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, query, orderBy, limit, startAfter } from 'firebase/firestore';
import CryptoJS from 'crypto-js';

// Deterministic (legacy) key/iv approach retained for compatibility; can be upgraded later.
function getKeyIv(uid){
  const key = CryptoJS.enc.Hex.parse(CryptoJS.SHA256(uid + '-key').toString());
  const iv = CryptoJS.enc.Hex.parse(CryptoJS.SHA256(uid + '-iv').toString().slice(0,32));
  return { key, iv };
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
  const { key, iv } = getKeyIv(uid);
  const encryptedNote = CryptoJS.AES.encrypt(note || '', key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString();
  const id = `${Date.now()}`;
  const payload = { mood, stress, note: encryptedNote, createdAt: serverTimestamp() };
  try{
    await setDoc(doc(db, `users/${uid}/moods`, id), payload);
  }catch(e){
    // enqueue offline create with plain payload (createdAt to be set server side when online not possible; keep client timestamp as fallback)
    await enqueue({ op:'create', id, payload: { ...payload, createdAt: new Date() } });
  }
  return id;
}

export async function updateMoodEntry(id, { mood, stress, note }){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  const { key, iv } = getKeyIv(uid);
  const encryptedNote = CryptoJS.AES.encrypt(note || '', key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString();
  const payload = { mood, stress, note: encryptedNote };
  try{ await updateDoc(doc(db, `users/${uid}/moods`, id), payload); }
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

export function decryptEntry(uid, entry){
  try{
    const { key, iv } = getKeyIv(uid);
    const note = CryptoJS.AES.decrypt(entry.note, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString(CryptoJS.enc.Utf8) || '';
    return { ...entry, note };
  }catch{ return { ...entry, note:'' }; }
}
