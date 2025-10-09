import { auth, db } from '../../firebase/firebaseConfig';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, updateDoc, doc, where, deleteDoc } from 'firebase/firestore';

// Inbox entry shape:
// { type:'reply'|'badge'|'milestone'|'digest'|'mention'|'digest_summary', title, body, data?, createdAt, read:false }
// data.route can hold a navigation path for deep linking.

const PRUNE_THRESHOLD = 300; // keep at most 300 notifications
const PRUNE_TARGET = 240;    // after pruning reduce to this many (remove oldest read first)

function userInboxRef(uid){
  return collection(db, 'users', uid, 'inbox');
}

export async function inboxAdd({ uid, type, title, body, data }){
  try {
    if(!uid) uid = auth.currentUser?.uid;
    if(!uid) return { ok:false, reason:'no-auth' };
    const ref = userInboxRef(uid);
    await addDoc(ref, { type, title, body, data: data||null, read:false, createdAt: serverTimestamp() });
    // Prune asynchronously (best-effort)
    try {
      const snap = await getDocs(query(ref, orderBy('createdAt','desc'), limit(PRUNE_THRESHOLD+10)));
      if(snap.size > PRUNE_THRESHOLD){
        // Collect read docs beyond PRUNE_TARGET from the tail
        const docs = snap.docs; // newest -> oldest
        const toDelete = [];
        for(let i=PRUNE_TARGET;i<docs.length;i++){
          const d = docs[i]; const data = d.data();
            if(data.read){ toDelete.push(d); }
        }
        // If not enough read, still delete oldest to enforce cap
        if(toDelete.length < (docs.length-PRUNE_TARGET)){
          for(let i=docs.length-1; i>=PRUNE_TARGET && toDelete.length < (docs.length-PRUNE_TARGET); i--){
            if(!toDelete.includes(docs[i])) toDelete.push(docs[i]);
          }
        }
        for(const d of toDelete){ try { await deleteDoc(d.ref); } catch {} }
      }
    } catch {}
    return { ok:true };
  } catch(e){
    try {
      const { DeviceEventEmitter } = await import('react-native');
      DeviceEventEmitter.emit('app-toast', { message: 'Notification failed: ' + (e?.message||'error'), type:'error' });
    } catch {}
    return { ok:false, error: e?.message||String(e) };
  }
}

export async function inboxList({ limitCount = 30 } = {}){
  try {
    const uid = auth.currentUser?.uid; if(!uid) return [];
    const q = query(userInboxRef(uid), orderBy('createdAt','desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d=> ({ id:d.id, ...d.data() }));
  } catch { return []; }
}

export async function inboxMarkRead({ id }){
  try {
    const uid = auth.currentUser?.uid; if(!uid || !id) return false;
    const ref = doc(db, 'users', uid, 'inbox', id);
    await updateDoc(ref, { read:true });
    return true;
  } catch { return false; }
}

export async function inboxMarkAllRead(){
  try {
    const uid = auth.currentUser?.uid; if(!uid) return 0;
    const q = query(userInboxRef(uid), where('read','==', false), limit(100));
    const snap = await getDocs(q);
    let count=0;
    for(const d of snap.docs){ try { await updateDoc(d.ref, { read:true }); count++; } catch {} }
    return count;
  } catch { return 0; }
}