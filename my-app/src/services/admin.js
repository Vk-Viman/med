import { auth, db, storage } from '../../firebase/firebaseConfig';
import { collection, doc, getDoc, getDocs, query, orderBy, where, limit as qlimit, updateDoc, setDoc, addDoc, deleteDoc, getCountFromServer } from 'firebase/firestore';
import { ref, getDownloadURL, uploadString } from 'firebase/storage';
import * as FileSystem from 'expo-file-system/legacy';

// USERS
export async function listUsers({ limit=100 } = {}){
  let snap;
  try {
    snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt','desc'), qlimit(limit)));
  } catch (e) {
    // Fallback if createdAt is missing or orderBy not possible; permission errors will rethrow later
    if (String(e?.code||'').includes('failed-precondition') || String(e?.message||'').toLowerCase().includes('order')) {
      snap = await getDocs(query(collection(db, 'users'), qlimit(limit)));
    } else {
      throw e;
    }
  }
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

// Flagged posts are those with posts.flagged == true (server moderation sets this)
export async function listFlaggedPosts(){
  const snap = await getDocs(query(collection(db, 'posts'), where('flagged','==', true), qlimit(50)));
  const rows = []; snap.forEach(d=> {
    const data = d.data()||{};
    rows.push({ id:d.id, preview: data.text || '', text: data.text || '', createdAt: data.createdAt || null, hidden: !!data.hidden });
  });
  return rows;
}
export async function clearFlag(id){
  // Unflag the post and unhide it (admin action)
  await updateDoc(doc(db, `posts/${id}`), { flagged: false, hidden: false, reviewStatus: 'approved', updatedAt: new Date() });
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

// ADMIN: recompute team totals from participants (Spark-compatible alternative to server functions)
export async function recomputeTeamTotals(challengeId){
  // Fetch all participants and aggregate minutes by teamId; write totals to teams/* docs
  const partsSnap = await getDocs(collection(db, `challenges/${challengeId}/participants`));
  const totals = new Map();
  partsSnap.forEach(d => {
    const data = d.data() || {};
    const teamId = data.teamId || null;
    const minutes = Number(data.minutes || 0);
    if (teamId) totals.set(teamId, (totals.get(teamId) || 0) + minutes);
  });
  // Write totals back
  const writes = [];
  totals.forEach((minutes, teamId) => {
    writes.push(setDoc(doc(db, `challenges/${challengeId}/teams/${teamId}`), { totalMinutes: minutes, updatedAt: new Date() }, { merge: true }));
  });
  await Promise.all(writes);
  await logAdminAction({ action:'recompute_team_totals', meta:{ challengeId } });
  return Object.fromEntries(totals.entries());
}

// BADGES (collection: admin_badges) – admin-managed catalog entries
export async function listAdminBadges(){
  const snap = await getDocs(query(collection(db, 'admin_badges'), orderBy('createdAt','desc')));
  const rows = []; snap.forEach(d=> rows.push({ id:d.id, ...d.data() }));
  return rows;
}
// Lightweight read-only list for user-side merging (alias)
export async function listAdminBadgesForUser(){
  return await listAdminBadges();
}
export async function createAdminBadge(data){
  await addDoc(collection(db, 'admin_badges'), { ...data, createdAt: new Date() });
}
export async function updateAdminBadge(id, patch){
  await updateDoc(doc(db, `admin_badges/${id}`), { ...patch, updatedAt: new Date() });
}
export async function deleteAdminBadge(id){
  await deleteDoc(doc(db, `admin_badges/${id}`));
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

// ADMIN: delete all sessions for a user
export async function deleteAllUserSessions(uid, { batchSize=200 } = {}){
  const refc = collection(db, `users/${uid}/sessions`);
  let total = 0;
  while(true){
    let snap;
    try { snap = await getDocs(query(refc, orderBy('endedAt','desc'), qlimit(batchSize))); }
    catch { snap = await getDocs(query(refc, qlimit(batchSize))); }
    if (snap.empty) break;
    const ids = []; snap.forEach(d=> ids.push(d.id));
    await Promise.all(ids.map(id => deleteDoc(doc(db, `users/${uid}/sessions/${id}`))));
    total += ids.length;
    if (ids.length < batchSize) break;
  }
  return total;
}

// ADMIN: delete all favorites for a user
export async function deleteAllUserFavorites(uid, { batchSize=200 } = {}){
  const refc = collection(db, `users/${uid}/favorites`);
  let total = 0;
  while(true){
    const snap = await getDocs(query(refc, qlimit(batchSize)));
    if (snap.empty) break;
    const ids = []; snap.forEach(d=> ids.push(d.id));
    await Promise.all(ids.map(id => deleteDoc(doc(db, `users/${uid}/favorites/${id}`))));
    total += ids.length;
    if (ids.length < batchSize) break;
  }
  return total;
}

// ADMIN: delete all badges for a user
export async function deleteAllUserBadges(uid, { batchSize=200 } = {}){
  const refc = collection(db, `users/${uid}/badges`);
  let total = 0;
  while(true){
    const snap = await getDocs(query(refc, qlimit(batchSize)));
    if (snap.empty) break;
    const ids = []; snap.forEach(d=> ids.push(d.id));
    await Promise.all(ids.map(id => deleteDoc(doc(db, `users/${uid}/badges/${id}`))));
    total += ids.length;
    if (ids.length < batchSize) break;
  }
  return total;
}

// ADMIN: reset aggregate stats (non-destructive merge)
export async function resetUserStats(uid){
  try {
    await setDoc(doc(db, `users/${uid}/stats/aggregate`), { totalMinutes: 0, streak: 0, updatedAt: new Date() }, { merge: true });
    return true;
  } catch { return false; }
}

// ADMIN: erase user content across known subcollections
export async function eraseUserContent(uid){
  const results = { moods: 0, sessions: 0, favorites: 0, badges: 0 };
  try { results.moods = await deleteAllUserMoods(uid, { batchSize: 500 }); } catch {}
  try { results.sessions = await deleteAllUserSessions(uid, { batchSize: 500 }); } catch {}
  try { results.favorites = await deleteAllUserFavorites(uid, { batchSize: 500 }); } catch {}
  try { results.badges = await deleteAllUserBadges(uid, { batchSize: 500 }); } catch {}
  try { await resetUserStats(uid); } catch {}
  try { await logAdminAction({ action:'erase_user_content', targetUid: uid, meta: { results } }); } catch {}
  return results;
}

// PRIVACY: update privacy request with arbitrary patch (status/notes/assignee)
export async function adminUpdatePrivacyRequest(id, patch){
  await updateDoc(doc(db, `privacy_requests/${id}`), { ...patch, updatedAt: new Date() });
  await logAdminAction({ action:'privacy_request_updated', meta: { id, patch } });
}

// PRIVACY: processing restriction toggle on user profile
export async function adminSetProcessingRestriction(uid, restricted){
  await updateDoc(doc(db, `users/${uid}`), { processingRestricted: !!restricted, updatedAt: new Date() });
  await logAdminAction({ action:'set_processing_restriction', targetUid: uid, meta: { restricted: !!restricted } });
}

// PRIVACY: analytics opt-out toggle on user profile
export async function adminSetAnalyticsOptOut(uid, optOut){
  await updateDoc(doc(db, `users/${uid}`), { analyticsOptOut: !!optOut, updatedAt: new Date() });
  await logAdminAction({ action:'set_analytics_opt_out', targetUid: uid, meta: { optOut: !!optOut } });
}

// ADMIN: patch user profile (limited to provided fields)
export async function adminPatchUserProfile(uid, patch){
  await updateDoc(doc(db, `users/${uid}`), { ...patch, updatedAt: new Date() });
  await logAdminAction({ action:'patch_user_profile', targetUid: uid, meta: { keys: Object.keys(patch||{}) } });
}

// PRIVACY: anonymize all posts authored by user
export async function anonymizeUserPosts(uid){
  let count = 0;
  try {
    const pSnap = await getDocs(query(collection(db, 'posts'), where('authorUid','==', uid), qlimit(1000)));
    const updates = [];
    pSnap.forEach(d => {
      const anon = `anon_${Math.random().toString(36).slice(2,8)}`;
      updates.push(updateDoc(doc(db, `posts/${d.id}`), { authorUid: null, anonymized: true, anonId: anon, updatedAt: new Date() }));
      count++;
    });
    await Promise.all(updates);
  } catch {}
  await logAdminAction({ action:'anonymize_user_posts', targetUid: uid, meta: { count } });
  return count;
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
  // Gather moods
  const moods = await listUserMoodDocs(uid, { limit: 5000 });
  // Gather sessions (best-effort)
  let sessions = [];
  try {
    const sSnap = await getDocs(query(collection(db, `users/${uid}/sessions`), orderBy('endedAt','desc'), qlimit(5000)));
    sSnap.forEach(d => sessions.push({ id: d.id, ...d.data() }));
  } catch {}
  // Gather posts authored by this user (best-effort; exclude hidden if needed)
  let posts = [];
  try {
    const pSnap = await getDocs(query(collection(db, 'posts'), where('authorUid','==', uid), qlimit(1000)));
    pSnap.forEach(d => {
      const data = d.data() || {};
      posts.push({ id: d.id, text: data.text || '', createdAt: data.createdAt || null, hidden: !!data.hidden, flagged: !!data.flagged });
    });
  } catch {}
  const payload = {
    exportedAt: new Date().toISOString(),
    uid,
    counts: { moods: moods.length, sessions: sessions.length, posts: posts.length },
    moods,
    sessions,
    posts,
    meta: { note: 'This export is generated by an admin upon privacy request. Timestamps are Firestore Timestamps when present.' }
  };
  const json = JSON.stringify(payload, null, 2);
  const ts = Date.now();
  const path = `privacy_exports/${uid}/export_${ts}.json`;
  const r = ref(storage, path);
  const b64 = toBase64Utf8(json);
  await uploadString(r, b64, 'base64', { contentType: 'application/json', contentDisposition: `attachment; filename="export_${ts}.json"` });
  const url = await getDownloadURL(r);
  await updateDoc(doc(db, `privacy_requests/${requestId}`), { status:'done', completedAt: new Date(), fileUrl: url, storagePath: path });
  await logAdminAction({ action:'export_artifact_generated', targetUid: uid, meta: { requestId, path } });
  return { url, path };
}

// ADMIN: ban/unban user (soft ban flag on profile)
export async function adminBanUser(uid, reason=''){
  await updateDoc(doc(db, `users/${uid}`), { banned: true, banReason: reason||'', updatedAt: new Date() });
  await logAdminAction({ action:'ban_user', targetUid: uid, meta: { reason } });
}
export async function adminUnbanUser(uid){
  await updateDoc(doc(db, `users/${uid}`), { banned: false, updatedAt: new Date() });
  await logAdminAction({ action:'unban_user', targetUid: uid });
}

// ADMIN: global anon mutes stored in admin_mutes collection (doc id is anonId)
export async function addAdminMuteAnon(anonId, { reason='' } = {}){
  if(!anonId) return;
  await setDoc(doc(db, `admin_mutes/${anonId}`), { reason: reason||'', createdAt: new Date(), actorUid: auth.currentUser?.uid||null });
  await logAdminAction({ action:'add_admin_mute', meta: { anonId, reason } });
}
export async function removeAdminMuteAnon(anonId){
  if(!anonId) return;
  await deleteDoc(doc(db, `admin_mutes/${anonId}`));
  await logAdminAction({ action:'remove_admin_mute', meta: { anonId } });
}
export async function listAdminMutes({ limit=200 } = {}){
  const snap = await getDocs(query(collection(db, 'admin_mutes'), orderBy('createdAt','desc'), qlimit(limit)));
  const rows = []; snap.forEach(d=> rows.push({ id:d.id, ...d.data() }));
  return rows;
}

// ADMIN: export moderation reports to CSV and upload to Storage
export async function adminExportReportsCsv({ status='open', limit=1000 } = {}){
  const refc = collection(db, 'reports');
  const q = status==='all' ? query(refc, qlimit(limit)) : query(refc, where('status','==', status), qlimit(limit));
  const snap = await getDocs(q);
  const rows = [];
  snap.forEach(d=> rows.push({ id:d.id, ...(d.data()||{}) }));
  const headers = ['id','postId','reason','status','reporterUid','createdAt'];
  const csvLines = [headers.join(',')];
  for(const r of rows){
    const vals = [r.id, r.postId||'', r.reason||'', r.status||'', r.reporterUid||'', toIso(r.createdAt)];
    csvLines.push(vals.map(s => escapeCsv(s)).join(','));
  }
  const csv = csvLines.join('\n');
  const ts = Date.now();
  const path = `admin_reports/exports/reports_${status}_${ts}.csv`;
  const r = ref(storage, path);
  const b64 = toBase64Utf8(csv);
  await uploadString(r, b64, 'base64', { contentType: 'text/csv', contentDisposition: `attachment; filename="reports_${status}_${ts}.csv"` });
  const url = await getDownloadURL(r);
  await logAdminAction({ action:'export_reports_csv', meta: { status, path } });
  return { url, path, count: rows.length };
}

function toIso(ts){
  try { if(!ts) return ''; if(ts?.toDate) return ts.toDate().toISOString(); if(ts instanceof Date) return ts.toISOString(); return ''; } catch { return ''; }
}
function escapeCsv(v){
  const s = String(v??'');
  if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
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
  // Uniform base64 upload path to avoid Blob issues in RN
  const guessType = (n) => {
    const low = (n||'').toLowerCase();
    if (low.endsWith('.m4a')) return 'audio/mp4';
    if (low.endsWith('.wav')) return 'audio/wav';
    if (low.endsWith('.aac')) return 'audio/aac';
    if (low.endsWith('.ogg')) return 'audio/ogg';
    return 'audio/mpeg';
  };
  try {
    let readUri = uri;
    let ext = 'mp3';
    const nameParts = name.split('.');
    if (nameParts.length>1) ext = nameParts.pop();

    if (uri.startsWith('content://') || uri.startsWith('file://')) {
      // Copy to cache to ensure accessible path with extension
      const dest = `${FileSystem.cacheDirectory}upload_${ts}.${ext}`;
      try { await FileSystem.copyAsync({ from: uri, to: dest }); readUri = dest; } catch { readUri = uri; }
    } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
      // Download remote file to cache first
      const dest = `${FileSystem.cacheDirectory}download_${ts}.${ext}`;
      const dl = await FileSystem.downloadAsync(uri, dest);
      readUri = dl?.uri || dest;
    }

    // Read as base64 and upload via Firebase SDK (no Blob path)
    const base64 = await FileSystem.readAsStringAsync(readUri, { encoding: 'base64' });
    const contentType = guessType(name);
    await uploadString(r, base64, 'base64', { contentType });
  } catch (e) {
    const msg = e?.message || 'Unknown';
    throw new Error(`Upload failed: ${msg}`);
  }
  const finalUrl = await getDownloadURL(ref(storage, `meditations/${name}`));
  await logAdminAction({ action:'upload_meditation_audio', meta: { path: `meditations/${name}` } });
  return finalUrl;
}

// ===== Analytics (admin) =====
export async function getCommunityAnalytics({ windowDays=7, start=null, end=null } = {}){
  const since = start ? new Date(start) : (()=>{ const d=new Date(); d.setDate(d.getDate()-windowDays); return d; })();
  const until = end ? new Date(end) : new Date();
  // active posters: posts created in window with unique authorUid/anonId
  let posts = [], reports = [];
  try {
    const ps = await getDocs(query(collection(db, 'posts'), where('createdAt','>=', since), where('createdAt','<', until)));
    ps.forEach(d=> posts.push({ id:d.id, ...(d.data()||{}) }));
  } catch {}
  try {
    const rs = await getDocs(query(collection(db, 'reports'), where('createdAt','>=', since), where('createdAt','<', until)));
    rs.forEach(d=> reports.push({ id:d.id, ...(d.data()||{}) }));
  } catch {}
  const uniqPosters = new Set();
  posts.forEach(p=> { if(p.authorUid) uniqPosters.add('u:'+p.authorUid); else if(p.anonId) uniqPosters.add('a:'+p.anonId); });
  const flagged = posts.filter(p=> p.flagged).length;
  const flaggedRate = posts.length ? (flagged / posts.length) : 0;
  return {
    windowDays,
    start: since,
    end: until,
    postsCount: posts.length,
    activePosters: uniqPosters.size,
    flaggedCount: flagged,
    flaggedRate,
    reportsCount: reports.length,
  };
}

export async function getChallengeAnalytics({ windowDays=30 } = {}){
  // completion ratio per challenge in window
  const since = new Date(); since.setDate(since.getDate() - windowDays);
  const challenges = await getDocs(collection(db,'challenges'));
  const out = [];
  for (const ch of challenges.docs){
    const id = ch.id;
    let total=0, completed=0, minutes=0;
    try {
      const ps = await getDocs(collection(db, `challenges/${id}/participants`));
      ps.forEach(d=>{
        const data = d.data()||{}; total++;
        if (data.completed) completed++;
        minutes += Number(data.minutes||0);
      });
    } catch {}
    out.push({ id, title: (ch.data()?.title||id), participants: total, completed, completionRate: total? (completed/total):0, totalMinutes: minutes });
  }
  return out;
}

export async function getRetentionAnalytics({ weeks=6 } = {}){
  // best-effort weekly retention: users with any mood/sessions in week N after signup
  const usersSnap = await getDocs(collection(db, 'users'));
  const weeksOut = Array.from({ length: weeks }, (_,i)=> i); // 0..weeks-1
  // group users by signup week epoch (yyyy-ww) for cohort analysis too
  const cohorts = new Map();
  for (const u of usersSnap.docs){
    const data = u.data()||{}; const createdAt = toDate(data.createdAt) || new Date(0);
    const cohortKey = yearWeek(createdAt);
    if(!cohorts.has(cohortKey)) cohorts.set(cohortKey, []);
    cohorts.get(cohortKey).push(u.id);
  }
  const now = new Date();
  const report = [];
  for (const [cohortKey, uids] of cohorts.entries()){
    const row = { cohort: cohortKey, size: uids.length, weeks: {} };
    for (const w of weeksOut){
      const start = startOfWeek(addWeeks(parseCohort(cohortKey), w));
      const end = new Date(start); end.setDate(end.getDate()+7);
      let active = 0;
      for (const uid of uids){
        let has=false;
        try {
          const ms = await getDocs(query(collection(db, `users/${uid}/moods`), where('createdAt','>=', start), where('createdAt','<', end)));
          if(!ms.empty) has=true;
          if(!has){
            const ss = await getDocs(query(collection(db, `users/${uid}/sessions`), where('endedAt','>=', start), where('endedAt','<', end)));
            if(!ss.empty) has=true;
          }
        } catch {}
        if(has) active++;
      }
      row.weeks[w] = { active, rate: uids.length? active/uids.length : 0 };
    }
    report.push(row);
  }
  return report;
}

export async function getCohortSignupWeeks({ recent=8 } = {}){
  const usersSnap = await getDocs(collection(db, 'users'));
  const map = new Map();
  usersSnap.forEach(d=>{
    const dt = toDate((d.data()||{}).createdAt) || new Date(0);
    const key = yearWeek(dt);
    map.set(key, (map.get(key)||0) + 1);
  });
  const entries = Array.from(map.entries()).sort(([a],[b])=> a<b?1:-1).slice(0, recent);
  return entries.map(([cohort, count])=> ({ cohort, count }));
}

function toDate(ts){ try { return ts?.toDate? ts.toDate() : (ts instanceof Date? ts : null); } catch { return null; } }
function startOfWeek(d){ const x = new Date(d); const day = x.getDay(); const diff = (day+6)%7; x.setDate(x.getDate()-diff); x.setHours(0,0,0,0); return x; }
function addWeeks(d, w){ const x = new Date(d); x.setDate(x.getDate()+w*7); return x; }
function parseCohort(key){ const [y,w] = String(key).split('-').map(Number); const jan4=new Date(y,0,4); const start=startOfWeek(jan4); return addWeeks(start, w-1); }
function yearWeek(d){ const jan4=new Date(d.getFullYear(),0,4); const start=startOfWeek(jan4); const diff=(d-start); const w=Math.floor(diff/ (7*24*60*60*1000))+1; return `${d.getFullYear()}-${String(w).padStart(2,'0')}`; }

// Compute and store snapshot in admin_analytics/{YYYYMMDD}
export async function adminComputeAndStoreAnalytics({ dateKey=null, rangeDays=7 } = {}){
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now); start.setDate(start.getDate()-rangeDays);
  const key = dateKey || yyyyMMdd(end);
  const [community, challenges, cohorts, signup] = await Promise.all([
    getCommunityAnalytics({ start, end }),
    getChallengeAnalytics({ windowDays: 30 }),
    getRetentionAnalytics({ weeks: 6 }),
    getCohortSignupWeeks({ recent: 12 }),
  ]);
  await setDoc(doc(db, `admin_analytics/${key}`), {
    computedAt: new Date(),
    rangeDays,
    community,
    challenges,
    cohorts,
    signup,
  }, { merge: true });
  await logAdminAction({ action:'compute_store_analytics', meta: { key, rangeDays } });
  return { key };
}

// Export analytics to CSV and upload to Storage (community metrics for now)
// (Optional) CSV export kept for programmatic use; UI no longer exposes CSV buttons

// Export challenge analytics to CSV
// (Optional) CSV export kept for programmatic use

// Export retention analytics to CSV
// (Optional) CSV export kept for programmatic use

// Load snapshot first if present: admin_analytics/{dateKey}
export async function getAnalyticsSnapshot({ dateKey }){
  try {
    const snap = await getDoc(doc(db, `admin_analytics/${dateKey}`));
    if (!snap.exists()) return null;
    return snap.data() || null;
  } catch (e) {
    return null;
  }
}

function yyyyMMdd(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}${m}${day}`; }

// Safe UTF-8 -> base64 for React Native without relying on global btoa
function toBase64Utf8(str){
  try {
    // Prefer Buffer if available
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf8').toString('base64');
    }
  } catch {}
  // Fallback manual encoding
  const utf8 = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode('0x' + p1));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  while (i < utf8.length) {
    const c1 = utf8.charCodeAt(i++);
    const c2 = utf8.charCodeAt(i++);
    const c3 = utf8.charCodeAt(i++);
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (c2 >> 4);
    let e3 = ((c2 & 15) << 2) | (c3 >> 6);
    let e4 = c3 & 63;
    if (isNaN(c2)) { e3 = e4 = 64; }
    else if (isNaN(c3)) { e4 = 64; }
    output += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
  }
  return output;
}
