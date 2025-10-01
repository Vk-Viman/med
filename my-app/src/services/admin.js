import { auth, db, storage } from '../../firebase/firebaseConfig';
import { collection, doc, getDoc, getDocs, query, orderBy, where, limit as qlimit, updateDoc, setDoc, addDoc, deleteDoc, getCountFromServer } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';

// USERS
export async function listUsers({ limit=100 } = {}){
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt','desc'), qlimit(limit)));
  const out = []; snap.forEach(d=> out.push({ id:d.id, ...d.data() }));
  // Attach mood counts and last activity (best-effort)
  try {
    await Promise.all(out.map(async u => {
      try {
        const moodsRef = collection(db, `users/${u.id}/moods`);
        const moodsSnap = await getDocs(query(moodsRef, orderBy('createdAt','desc'), qlimit(1)));
        let last = null; moodsSnap.forEach(d => { const data = d.data()||{}; last = data.createdAt || null; });
        // Count: quick estimate via fetching limited snapshots repeatedly is expensive; instead, store cached count in user doc if available
        u.lastActivity = last;
        // Use aggregation query to get count if supported
        try {
          const agg = await getCountFromServer(moodsRef);
          u.entriesCount = agg?.data().count || undefined;
        } catch {}
      } catch {}
    }));
  } catch {}
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

// Fetch single meditation by ID (for Replay-by-ID)
export async function getMeditationById(id){
  if(!id) return null;
  try {
    const s = await getDoc(doc(db, `admin_meditations/${id}`));
    return s.exists()? { id: s.id, ...s.data() } : null;
  } catch { return null; }
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

// CHALLENGES (user-visible)
export async function listChallenges(){
  const snap = await getDocs(query(collection(db, 'challenges'), orderBy('createdAt','desc')));
  const rows = []; snap.forEach(d=> rows.push({ id:d.id, ...d.data() }));
  return rows;
}
export async function createChallenge({ title, description, startAt, endAt, goalMinutes, teamEnabled=false, rewardPoints=0, rewardBadge='' }){
  const payload = {
    title: title||'Untitled',
    description: description||'',
    startAt: startAt || null,
    endAt: endAt || null,
    goalMinutes: typeof goalMinutes==='number'? goalMinutes : (goalMinutes? Number(goalMinutes): null),
    teamEnabled: !!teamEnabled,
    rewardPoints: Number(rewardPoints||0),
    rewardBadge: String(rewardBadge||''),
    createdAt: new Date(),
  };
  await addDoc(collection(db, 'challenges'), payload);
}
export async function updateChallenge(id, patch){
  await updateDoc(doc(db, `challenges/${id}`), { ...patch, updatedAt: new Date() });
}
export async function deleteChallenge(id){
  await deleteDoc(doc(db, `challenges/${id}`));
}
export async function postChallengeUpdate(challengeId, { text }){
  await addDoc(collection(db, `challenges/${challengeId}/feed`), { text: String(text||'Update'), createdAt: new Date() });
}

// Teams management within a challenge
export async function listTeams(challengeId){
  const snap = await getDocs(collection(db, `challenges/${challengeId}/teams`));
  const rows = []; snap.forEach(d=> rows.push({ id:d.id, ...d.data() }));
  return rows;
}
export async function upsertTeam(challengeId, teamId, data){
  if (teamId) {
    await setDoc(doc(db, `challenges/${challengeId}/teams/${teamId}`), { ...data, updatedAt: new Date() }, { merge: true });
  } else {
    await addDoc(collection(db, `challenges/${challengeId}/teams`), { ...data, createdAt: new Date() });
  }
}
export async function deleteTeam(challengeId, teamId){
  await deleteDoc(doc(db, `challenges/${challengeId}/teams/${teamId}`));
}

// Reward fulfillment: award badge and/or add points to user profile upon completion
export async function fulfillChallengeReward({ challengeId, uid, badgeId, badgeName, points=0 }){
  // Writes across user profile and badges; admin-only
  if (!uid) return false;
  try {
    if (points && points>0) {
      await setDoc(doc(db, `users/${uid}/stats/aggregate`), { points: (points) }, { merge: true });
    }
    if (badgeId && badgeName) {
      await setDoc(doc(db, `users/${uid}/badges/${badgeId}`), { name: badgeName, awardedAt: new Date() }, { merge: true });
    }
    await addDoc(collection(db, 'admin_audit_logs'), { action:'fulfill_challenge_reward', targetUid: uid, meta: { challengeId, badgeId, points }, at: new Date() });
    return true;
  } catch { return false; }
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
  // Avoid composite index requirement by not mixing where+orderBy initially
  const q = status ? query(ref, where('status','==', status), qlimit(limit)) : query(ref, qlimit(limit));
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

// ADMIN: generate export artifact, upload JSON to Storage, and patch privacy_request
export async function adminGenerateExportArtifact(uid, requestId){
  const rows = await listUserMoodDocs(uid, { limit: 5000 });
  const payload = { exportedAt: new Date().toISOString(), uid, count: rows.length, entries: rows };
  const json = JSON.stringify(payload, null, 2);
  const ts = Date.now();
  const path = `privacy_exports/${uid}/export_${ts}.json`;
  const r = ref(storage, path);
  await uploadString(r, json, 'raw', { contentType: 'application/json' });
  const url = await getDownloadURL(r);
  await updateDoc(doc(db, `privacy_requests/${requestId}`), { status:'done', completedAt: new Date(), fileUrl: url, storagePath: path });
  await logAdminAction({ action:'export_artifact_generated', targetUid: uid, meta: { requestId, path } });
  return { url, path };
}

// ADMIN AUDIT LOGS
export async function logAdminAction({ action, targetUid, meta }){
  const actorUid = auth.currentUser?.uid || null;
  try {
    await addDoc(collection(db, 'admin_audit_logs'), { action, targetUid: targetUid||null, actorUid, meta: meta||{}, at: new Date() });
  } catch {}
}

// Upload audio to Firebase Storage and return a public URL
export async function uploadMeditationAudio({ uri, filename }){
  if (!uri) throw new Error('Missing file URI');
  const ts = Date.now();
  const name = filename || `med_${ts}.mp3`;
  const r = ref(storage, `meditations/${name}`);
  // Prefer base64 for content:// URIs on Android
  try {
    if (uri.startsWith('content://') || uri.startsWith('file://')) {
      let readUri = uri;
      // On Android, some content:// need to be copied to cache with an extension
      if (uri.startsWith('content://') && FileSystem.copyAsync) {
        const ext = name.includes('.') ? name.split('.').pop() : 'mp3';
        const dest = `${FileSystem.cacheDirectory}upload_${ts}.${ext}`;
        try { await FileSystem.copyAsync({ from: uri, to: dest }); readUri = dest; } catch {}
      }
      const base64 = await FileSystem.readAsStringAsync(readUri, { encoding: FileSystem.EncodingType.Base64 });
      const contentType = name.toLowerCase().endsWith('.m4a') ? 'audio/mp4' : name.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
      await uploadString(r, base64, 'base64', { contentType });
    } else {
      // http(s) uri
      const res = await fetch(uri);
      const blob = await res.blob();
      await uploadBytes(r, blob, { contentType: blob.type || 'audio/mpeg' });
    }
  } catch (e) {
    // Fallback: try fetch->blob even for content:// if supported
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      await uploadBytes(r, blob, { contentType: blob.type || 'audio/mpeg' });
    } catch (e2) {
      const msg = e?.message || e2?.message || 'Unknown';
      throw new Error(`Upload failed: ${msg}`);
    }
  }
  const url = await getDownloadURL(r);
  await logAdminAction({ action:'upload_meditation_audio', meta: { path: `meditations/${name}` } });
  return url;
}
