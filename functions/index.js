const functions = require('firebase-functions');
const admin = require('firebase-admin');

try { admin.initializeApp(); } catch {}
const db = admin.firestore();

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
