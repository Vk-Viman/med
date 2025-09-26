import { db } from '../../firebase/firebaseConfig';
import { collection, doc, getDoc, getDocs, query, orderBy, where, limit as qlimit, updateDoc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';

// USERS
export async function listUsers({ limit=100 } = {}){
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt','desc'), qlimit(limit)));
  const out = []; snap.forEach(d=> out.push({ id:d.id, ...d.data() }));
  return out;
}
export async function listUsersCount(){
  const snap = await getDocs(collection(db, 'users'));
  return snap.size;
}
export async function getUserById(uid){
  const s = await getDoc(doc(db, `users/${uid}`));
  return s.exists()? { id: uid, ...s.data() } : null;
}
export async function updateUserRole(uid, role){
  const norm = String(role||'').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
  await updateDoc(doc(db, `users/${uid}`), { userType: norm, updatedAt: new Date() });
}
export async function requestWipeForUser(uid){
  await updateDoc(doc(db, `users/${uid}`), { wipeRequested: true, updatedAt: new Date() });
}

// MEDITATIONS (collection: admin_meditations)
export async function listMeditations(){
  const snap = await getDocs(query(collection(db, 'admin_meditations'), orderBy('createdAt','desc')));
  const rows = []; snap.forEach(d=> rows.push({ id:d.id, ...d.data() }));
  return rows;
}
export async function createMeditation(data){
  const ref = collection(db, 'admin_meditations');
  await addDoc(ref, { ...data, createdAt: new Date() });
}
export async function updateMeditation(id, patch){
  await updateDoc(doc(db, `admin_meditations/${id}`), { ...patch, updatedAt: new Date() });
}
export async function deleteMeditation(id){
  await deleteDoc(doc(db, `admin_meditations/${id}`));
}

// PLANS (collection: admin_plans)
export async function listPlanTemplates(){
  const snap = await getDocs(query(collection(db, 'admin_plans'), orderBy('createdAt','desc')));
  const rows = []; snap.forEach(d=> rows.push({ id:d.id, ...d.data() }));
  return rows;
}
export async function createPlanTemplate(data){
  await addDoc(collection(db, 'admin_plans'), { ...data, createdAt: new Date() });
}
export async function updatePlanTemplate(id, patch){
  await updateDoc(doc(db, `admin_plans/${id}`), { ...patch, updatedAt: new Date() });
}
export async function deletePlanTemplate(id){
  await deleteDoc(doc(db, `admin_plans/${id}`));
}

// COMMUNITY (collections: admin_groups, flagged_posts)
export async function listGroups(){
  const snap = await getDocs(query(collection(db, 'admin_groups'), orderBy('createdAt','desc')));
  const rows = []; snap.forEach(d=> rows.push({ id:d.id, ...d.data() }));
  return rows;
}
export async function createGroup(data){
  await addDoc(collection(db, 'admin_groups'), { ...data, createdAt: new Date() });
}
export async function deleteGroup(id){
  await deleteDoc(doc(db, `admin_groups/${id}`));
}

export async function listFlaggedPosts(){
  const snap = await getDocs(query(collection(db, 'flagged_posts'), orderBy('createdAt','desc')));
  const rows = []; snap.forEach(d=> rows.push({ id:d.id, ...d.data() }));
  return rows;
}
export async function clearFlag(id){
  await deleteDoc(doc(db, `flagged_posts/${id}`));
}

// USER MOOD META (privacy-preserving: metadata only)
export async function listUserMoodMeta(uid, { limit=25 } = {}){
  const ref = collection(db, `users/${uid}/moods`);
  const snap = await getDocs(query(ref, orderBy('createdAt','desc'), qlimit(limit)));
  const out = [];
  snap.forEach(d => {
    const data = d.data() || {};
    out.push({ id: d.id, createdAt: data.createdAt || null });
  });
  return out;
}

// ADMIN: force sign-out by bumping sessionEpoch for a user
export async function adminBumpSessionEpoch(uid){
  await updateDoc(doc(db, `users/${uid}`), { sessionEpoch: Date.now(), updatedAt: new Date() });
}

// ADMIN: list raw mood docs for a user (encrypted on server)
export async function listUserMoodDocs(uid, { limit=500 } = {}){
  const ref = collection(db, `users/${uid}/moods`);
  const snap = await getDocs(query(ref, orderBy('createdAt','desc'), qlimit(limit)));
  const out = [];
  snap.forEach(d => out.push({ id: d.id, ...d.data() }));
  return out;
}

// ADMIN: delete all moods for a user (compliance delete) in batches
export async function deleteAllUserMoods(uid, { batchSize=200 } = {}){
  const ref = collection(db, `users/${uid}/moods`);
  let total = 0;
  while(true){
    const snap = await getDocs(query(ref, orderBy('createdAt','desc'), qlimit(batchSize)));
    if(snap.empty) break;
    const ids = [];
    snap.forEach(d=> ids.push(d.id));
    await Promise.all(ids.map(id => deleteDoc(doc(db, `users/${uid}/moods/${id}`))));
    total += ids.length;
    if(ids.length < batchSize) break;
  }
  return total;
}

// PRIVACY REQUESTS (collection: privacy_requests)
// shape suggestion: { id, uid, type: 'export'|'delete', status: 'open'|'done', createdAt, completedAt, actorUid }
export async function listPrivacyRequests({ status='open', limit=100 } = {}){
  const ref = collection(db, 'privacy_requests');
  const q = status ? query(ref, where('status','==', status), orderBy('createdAt','desc'), qlimit(limit)) : query(ref, orderBy('createdAt','desc'), qlimit(limit));
  const snap = await getDocs(q);
  const rows = []; snap.forEach(d=> rows.push({ id:d.id, ...d.data() }));
  return rows;
}
export async function markPrivacyRequestDone(id){
  await updateDoc(doc(db, `privacy_requests/${id}`), { status:'done', completedAt: new Date() });
}
export async function createPrivacyRequest({ uid, type }){
  await addDoc(collection(db, 'privacy_requests'), { uid, type, status:'open', createdAt: new Date() });
}
