const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : ((...args) => import('node-fetch').then(({default: f}) => f(...args)));

try { admin.initializeApp(); } catch {}
const db = admin.firestore();

// --- Moderation config ---
const PERSPECTIVE_API_KEY = process.env.PERSPECTIVE_API_KEY;
const MOD_FLAG = Number(process.env.MOD_FLAG || '0.6'); // flag threshold
const MOD_BLOCK = Number(process.env.MOD_BLOCK || '0.8'); // auto-hide/block threshold
const MOD_LANGS = (process.env.MOD_LANGS || 'en').split(',');
const RATE_POST_MS = Number(process.env.RATE_POST_MS || '10000'); // 10s between posts
const RATE_REPLY_MS = Number(process.env.RATE_REPLY_MS || '8000'); // 8s between replies

async function analyzeToxicity(text){
  const trimmed = (text||'').trim();
  if(!trimmed) return { ok:false, blocked:true, score:1, reason:'Empty' };
  // local heuristic first
  const banned = ["hate","kill","suicide","terror","racist","sexist"];
  const lower = trimmed.toLowerCase();
  if (banned.some(w=> lower.includes(w))){
    return { ok:false, flagged:true, blocked:true, score:0.99, reason:'Contains disallowed terms' };
  }
  if(!PERSPECTIVE_API_KEY){
    return { ok:true, flagged:false, blocked:false, score:0.0, reason:'heuristic-ok' };
  }
  try{
    const resp = await fetch(`https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${PERSPECTIVE_API_KEY}`,{
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ comment:{ text: trimmed }, languages: MOD_LANGS, requestedAttributes:{ TOXICITY:{} } })
    });
    const data = await resp.json();
    const score = data?.attributeScores?.TOXICITY?.summaryScore?.value ?? 0;
    const flagged = score >= MOD_FLAG;
    const blocked = score >= MOD_BLOCK;
    return { ok: !blocked, flagged, blocked, score, reason: flagged? 'toxic' : 'ok' };
  } catch(e){
    console.error('Perspective error', e);
    return { ok:true, flagged:false, blocked:false, score:0.0, reason:'fallback-ok' };
  }
}

// Secure moderation endpoint - requires Firebase ID token in Authorization: Bearer <token>
exports.moderateText = functions.region('us-central1').https.onRequest(async (req, res)=>{
  res.set('Access-Control-Allow-Origin','*');
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type,Authorization');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return res.status(405).json({ error:'Method not allowed' });
  try{
    const authHeader = req.headers.authorization || '';
    const m = authHeader.match(/^Bearer\s+(.*)$/i);
    if(!m) return res.status(401).json({ error:'Missing token' });
    const decoded = await admin.auth().verifyIdToken(m[1]);
    if(!decoded?.uid) return res.status(401).json({ error:'Invalid token' });
  }catch(e){ return res.status(401).json({ error:'Unauthorized' }); }
  try{
    const { text } = req.body || {};
    const result = await analyzeToxicity(text||'');
    return res.status(200).json(result);
  }catch(e){
    return res.status(500).json({ error: e.message||'Moderation failed' });
  }
});

// Firestore trigger: on new post -> analyze, annotate, and optionally hide
exports.onPostCreateModerate = functions.firestore
  .document('posts/{postId}')
  .onCreate(async (snap, context)=>{
    try{
      const data = snap.data() || {};
      const text = data.text || '';
      const authorUid = data.authorUid || null;
      // Rate limit by authorUid if present
      if(authorUid){
        const rlRef = db.collection('users').doc(authorUid).collection('private').doc('ratelimit');
        const rlSnap = await rlRef.get();
        const now = Date.now();
        const last = rlSnap.exists ? Number(rlSnap.data().lastPostAt||0) : 0;
        if(now - last < RATE_POST_MS){
          await snap.ref.set({ hidden: true, reviewStatus:'rate_limited' }, { merge:true });
        }
        await rlRef.set({ lastPostAt: now }, { merge:true });
      }
      const result = await analyzeToxicity(text);
      const patch = {
        toxicityScore: result.score,
        toxicityReason: result.reason,
        flagged: !!result.flagged,
        hidden: data.hidden || !!result.blocked,
        reviewStatus: result.blocked ? 'pending' : (data.reviewStatus || 'open'),
        moderatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await snap.ref.set(patch, { merge:true });
    }catch(e){ console.error('onPostCreateModerate error', e); }
  });

// Firestore trigger: on new reply -> analyze and update parent repliesCount
exports.onReplyCreateModerate = functions.firestore
  .document('posts/{postId}/replies/{replyId}')
  .onCreate(async (snap, context)=>{
    const { postId } = context.params;
    try{
      const data = snap.data() || {};
      const text = data.text || '';
      const authorUid = data.authorUid || null;
      if(authorUid){
        const rlRef = db.collection('users').doc(authorUid).collection('private').doc('ratelimit');
        const rlSnap = await rlRef.get();
        const now = Date.now();
        const last = rlSnap.exists ? Number(rlSnap.data().lastReplyAt||0) : 0;
        if(now - last < RATE_REPLY_MS){
          await snap.ref.set({ hidden: true, reviewStatus:'rate_limited' }, { merge:true });
        }
        await rlRef.set({ lastReplyAt: now }, { merge:true });
      }
      const result = await analyzeToxicity(text);
      await snap.ref.set({ toxicityScore: result.score, toxicityReason: result.reason, flagged: !!result.flagged, hidden: !!result.blocked, moderatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:true });
      // increment parent repliesCount
      await db.collection('posts').doc(postId).set({ repliesCount: admin.firestore.FieldValue.increment(1) }, { merge:true });
    }catch(e){ console.error('onReplyCreateModerate error', e); }
  });

// Firestore triggers: maintain likesCount when like docs are added/removed
exports.onLikeCreate = functions.firestore
  .document('posts/{postId}/likes/{uid}')
  .onCreate(async (snap, context)=>{
    const { postId } = context.params;
    try { await db.collection('posts').doc(postId).set({ likesCount: admin.firestore.FieldValue.increment(1) }, { merge:true }); } catch(e){ console.error('onLikeCreate error', e); }
  });
exports.onLikeDelete = functions.firestore
  .document('posts/{postId}/likes/{uid}')
  .onDelete(async (snap, context)=>{
    const { postId } = context.params;
    try { await db.collection('posts').doc(postId).set({ likesCount: admin.firestore.FieldValue.increment(-1) }, { merge:true }); } catch(e){ console.error('onLikeDelete error', e); }
  });

// Admin-invoked HTTP function to re-check recent open reports and auto-hide posts with high toxicity
exports.recheckReports = functions.region('us-central1').https.onRequest(async (req, res)=>{
  res.set('Access-Control-Allow-Origin','*');
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type,Authorization');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return res.status(405).json({ error:'Method not allowed' });
  // Verify token and admin role
  let uid = null;
  try {
    const m = (req.headers.authorization||'').match(/^Bearer\s+(.*)$/i);
    if(!m) return res.status(401).json({ error:'Missing token' });
    const decoded = await admin.auth().verifyIdToken(m[1]);
    uid = decoded?.uid || null;
    if(!uid) return res.status(401).json({ error:'Unauthorized' });
    const udoc = await db.collection('users').doc(uid).get();
    const isAdmin = udoc.exists && udoc.data()?.userType === 'admin';
    if(!isAdmin) return res.status(403).json({ error:'Forbidden' });
  } catch(e){ return res.status(401).json({ error:'Unauthorized' }); }

  try{
    const q = await db.collection('reports').where('status','==','open').orderBy('createdAt','desc').limit(100).get();
    let checked=0, hidden=0;
    for(const r of q.docs){
      checked++;
      const postId = r.data()?.postId;
      if(!postId) continue;
      const pdoc = await db.collection('posts').doc(postId).get();
      if(!pdoc.exists) { await r.ref.set({ status:'resolved' }, { merge:true }); continue; }
      const pdata = pdoc.data()||{};
      const score = Number(pdata.toxicityScore||0);
      const flagged = !!pdata.flagged;
      const alreadyHidden = !!pdata.hidden;
      if(score >= MOD_BLOCK || (flagged && !alreadyHidden)){
        await pdoc.ref.set({ hidden:true, reviewStatus:'pending' }, { merge:true });
        await r.ref.set({ status:'resolved', autoAction:'auto-hide' }, { merge:true });
        hidden++;
      }
    }
    return res.status(200).json({ ok:true, checked, hidden });
  }catch(e){
    console.error('recheckReports error', e);
    return res.status(500).json({ error: e.message||'Failed' });
  }
});

// Public (signed-in) abuse report endpoint with basic rate limiting per user
exports.reportAbuse = functions.region('us-central1').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin','*');
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  // Verify token
  let uid = null;
  try {
    const m = (req.headers.authorization||'').match(/^Bearer\s+(.*)$/i);
    if (!m) return res.status(401).json({ error: 'Missing token' });
    const decoded = await admin.auth().verifyIdToken(m[1]);
    uid = decoded?.uid || null;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  } catch (e) { return res.status(401).json({ error: 'Unauthorized' }); }

  try {
    const { postId, reason } = req.body || {};
    if (!postId) return res.status(400).json({ error: 'postId required' });
    const r = (typeof reason === 'string' && reason.trim()) ? reason.trim().toLowerCase() : 'inappropriate';
    // Simple rate-limit: 1 report per 10s
    const rlRef = db.collection('users').doc(uid).collection('private').doc('ratelimit');
    const rlSnap = await rlRef.get();
    const now = Date.now();
    const last = rlSnap.exists ? Number(rlSnap.data().lastReportAt||0) : 0;
    if (now - last < 10000) {
      return res.status(429).json({ error: 'Too many reports. Please wait a few seconds.' });
    }
    await rlRef.set({ lastReportAt: now }, { merge: true });
    // Create report doc
    await db.collection('reports').add({ postId, reason: r, reporterUid: uid, status: 'open', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('reportAbuse error', e);
    return res.status(500).json({ error: e.message || 'Failed to report' });
  }
});

// Helper: aggregate participant minutes per team for one challenge
async function aggregateTeamsForChallenge(challengeId) {
  const participantsRef = db.collection('challenges').doc(challengeId).collection('participants');
  const teamsRef = db.collection('challenges').doc(challengeId).collection('teams');
  const snap = await participantsRef.get();
  const totals = new Map();
  snap.forEach(doc => {
    const data = doc.data() || {};
    const teamId = data.teamId || null;
    const minutes = Number(data.minutes || 0);
    if (teamId) totals.set(teamId, (totals.get(teamId) || 0) + minutes);
  });
  // Write totals back to teams/* docs (merge)
  const batch = db.batch();
  totals.forEach((minutes, teamId) => {
    const tdoc = teamsRef.doc(teamId);
    batch.set(tdoc, { totalMinutes: minutes, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  await batch.commit();
}

// Scheduled aggregation once every hour
exports.aggregateTeamTotalsHourly = functions.pubsub.schedule('every 60 minutes').onRun(async () => {
  const challengesRef = db.collection('challenges');
  const snap = await challengesRef.get();
  const ids = snap.docs.map(d => d.id);
  for (const id of ids) {
    try { await aggregateTeamsForChallenge(id); } catch (e) { console.error('aggregateTeamsForChallenge error', id, e); }
  }
  return null;
});

// Recalculate team totals on participant writes for near-realtime accuracy
exports.onParticipantWrite = functions.firestore
  .document('challenges/{challengeId}/participants/{uid}')
  .onWrite(async (change, context) => {
    const { challengeId } = context.params;
    try { await aggregateTeamsForChallenge(challengeId); } catch (e) { console.error('onParticipantWrite aggregate error', challengeId, e); }
  });

// Push notification on new inbox item (in-app notification replication to device)
exports.onInboxCreated = functions.firestore
  .document('users/{uid}/inbox/{notifId}')
  .onCreate(async (snap, context) => {
    try {
      const { uid, notifId } = context.params;
      const data = snap.data() || {};
      const suppressedTypes = ['digest_summary'];
      if (suppressedTypes.includes(data.type)) return;
      const userDoc = await db.collection('users').doc(uid).get();
      const prefs = userDoc.exists ? (userDoc.data() || {}) : {};
      if (data.type === 'reply' && prefs.notifyReplies === false) return;
      if (data.type === 'mention' && prefs.notifyMentions === false) return;
      if (data.type === 'milestone' && prefs.notifyMilestones === false) return;
      if (data.type === 'badge' && prefs.notifyBadges === false) return;
      if (data.type === 'digest' && prefs.weeklyDigestEnabled === false) return;
      const tokensSnap = await db.collection('users').doc(uid).collection('pushTokens').get();
      const tokens = tokensSnap.docs.map(d=> (d.data()||{}).token).filter(Boolean);
      if(!tokens.length) return;
      const message = {
        notification: { title: data.title || 'Notification', body: data.body || '' },
        data: { type: data.type || 'general', notifId: notifId, route: (data.data && data.data.route) || '' },
        tokens
      };
      const resp = await admin.messaging().sendMulticast(message);
      const invalid = [];
      resp.responses.forEach((r,i)=>{ if(!r.success) invalid.push(tokens[i]); });
      if(invalid.length){
        const batch = db.batch();
        tokensSnap.docs.forEach(docSnap=>{ if(invalid.includes((docSnap.data()||{}).token)){ batch.delete(docSnap.ref); } });
        await batch.commit();
      }
    } catch(e){ console.error('onInboxCreated push error', e); }
  });
