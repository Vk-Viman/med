import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Button, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db, auth } from "../../firebase/firebaseConfig";
import { collection, doc, addDoc, getDoc, getDocs, setDoc, query, where, orderBy, serverTimestamp, updateDoc, increment, limit } from "firebase/firestore";
import { ensurePostIsSafe } from "../../src/moderation";
import { updateUserStats, evaluateAndAwardBadges, awardFirstPostIfNeeded, awardBadge } from "../../src/badges";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function CommunityScreen() {
  const { theme } = useTheme();
  const styles = useMemo(()=>createStyles(theme), [theme]);
  const [challenges, setChallenges] = useState([]);
  const [badges, setBadges] = useState([]);
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [joinedMap, setJoinedMap] = useState({}); // { [challengeId]: { joined:true, minutes:number, rank:number|null, total:number|null } }
  const [progressMap, setProgressMap] = useState({}); // { [challengeId]: percent }
  const [feedMap, setFeedMap] = useState({}); // { [challengeId]: [feedItem,...] }
  const [teamsMap, setTeamsMap] = useState({}); // { [challengeId]: [{ name, minutes }] }
  const [userTeamMap, setUserTeamMap] = useState({}); // { [challengeId]: teamId }

  const fmtDate = (ts)=>{
    try{
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
      if(!d) return '';
      return new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric' }).format(d);
    }catch{ return ''; }
  };

  useEffect(() => {
    const load = async () => {
      // Load active challenges
      const chSnap = await getDocs(collection(db, "challenges"));
      const chDocs = chSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setChallenges(chDocs);
      // Load user badges
      if (auth.currentUser) {
        const bSnap = await getDocs(collection(db, "users", auth.currentUser.uid, "badges"));
        setBadges(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      // Load recent posts
      const pSnap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
      setPosts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Naive leaderboard: sum minutes across all participants in the first challenge
      if (!chSnap.empty) {
        const first = chSnap.docs[0].id;
        const parSnap = await getDocs(collection(db, "challenges", first, "participants"));
        const rows = parSnap.docs.map(d => ({ uid: d.id, minutes: d.data()?.minutes || 0 }));
        rows.sort((a,b) => b.minutes - a.minutes);
        setLeaderboard(rows.slice(0,5));
      }

      // Per-challenge joins, rank, progress, and recent feed (read-only)
      const jm = {};
      const pm = {};
      const fm = {};
      const uid = auth.currentUser?.uid;
      for (const ch of chDocs) {
        try {
          // Joined status & minutes
          let joined = false; let minutes = 0; let rank = null; let total = null;
          let completed = false;
          if (uid) {
            const pref = doc(db, 'challenges', ch.id, 'participants', uid);
            const pd = await getDoc(pref);
            if (pd.exists()) { joined = true; minutes = Number(pd.data()?.minutes||0); completed = !!pd.data()?.completed; }
          }
          // Rank calculation
          try {
            const psnap = await getDocs(collection(db, 'challenges', ch.id, 'participants'));
            const rows = psnap.docs.map(d=>({ uid:d.id, minutes:Number(d.data()?.minutes||0) }));
            rows.sort((a,b)=>b.minutes-a.minutes);
            total = rows.length;
            if (uid) {
              const idx = rows.findIndex(r=>r.uid===uid);
              rank = idx>=0 ? (idx+1) : null;
            }
          } catch {}

          // Progress: Prefer goal-based, fallback to time-based
          const now = Date.now();
          const startAt = ch.startAt?.toDate ? ch.startAt.toDate().getTime() : null;
          const endAt = ch.endAt?.toDate ? ch.endAt.toDate().getTime() : null;
          const goal = Number(ch.goalMinutes || ch.targetMinutes || 0);
          let percent = 0;
          if (joined && goal>0) {
            percent = Math.max(0, Math.min(100, Math.round((minutes / goal) * 100)));
          } else if (startAt && endAt && endAt>startAt) {
            percent = Math.max(0, Math.min(100, Math.round(((now - startAt) / (endAt - startAt)) * 100)));
          }
          jm[ch.id] = { joined, minutes, rank, total, completed };
          pm[ch.id] = percent;

          // Recent feed
          try {
            const fsnap = await getDocs(query(collection(db, 'challenges', ch.id, 'feed'), orderBy('createdAt','desc'), limit(3)));
            fm[ch.id] = fsnap.docs.map(d=>({ id:d.id, ...d.data() }));
          } catch { fm[ch.id] = []; }

          // Teams (read-only)
          try {
            const tsnap = await getDocs(collection(db, 'challenges', ch.id, 'teams'));
            const teams = tsnap.docs.map(d=>{
              const data = d.data()||{};
              return { id:d.id, name:data.name||data.title||d.id, minutes:Number(data.totalMinutes||data.minutes||0) };
            });
            teams.sort((a,b)=> b.minutes - a.minutes);
            teamsMap[ch.id] = teams.slice(0,3);
          } catch { teamsMap[ch.id] = []; }
          // If joined, remember current teamId
          try {
            if (uid && joined) {
              const pd = await getDoc(doc(db, 'challenges', ch.id, 'participants', uid));
              const teamId = pd.exists() ? (pd.data()?.teamId || null) : null;
              if (teamId) userTeamMap[ch.id] = teamId;
            }
          } catch {}
        } catch { /* noop per challenge to keep UI resilient */ }
      }
      setJoinedMap(jm);
      setProgressMap(pm);
      setFeedMap(fm);
      setTeamsMap(teamsMap);
      setUserTeamMap(userTeamMap);
    };
    load();
  }, []);

  // Note: Admin-only actions like seeding/reset live in the Admin area now.

  const joinChallenge = async (challengeId) => {
    if (!auth.currentUser) return Alert.alert("Login required", "Please sign in to join challenges.");
    const ref = doc(db, "challenges", challengeId, "participants", auth.currentUser.uid);
    await setDoc(ref, { minutes: 0, joinedAt: serverTimestamp() }, { merge: true });
    Alert.alert("Joined", "You joined the challenge!");
    setJoinedMap((m)=>({ ...m, [challengeId]: { ...(m[challengeId]||{}), joined:true, minutes:0 } }));
  };

  const addMeditationMinutes = async (challengeId, mins=10) => {
    if (!auth.currentUser) return;
    // Optional enforcement: disallow adding minutes outside challenge window
    try {
      const ch = challenges.find(c=> c.id === challengeId);
      if (ch) {
        const now = Date.now();
        const sMs = ch.startAt?.toDate ? ch.startAt.toDate().getTime() : (ch.startAt instanceof Date ? ch.startAt.getTime() : null);
        const eMs = ch.endAt?.toDate ? ch.endAt.toDate().getTime() : (ch.endAt instanceof Date ? ch.endAt.getTime() : null);
        if (sMs && now < sMs) { Alert.alert('Not started', 'This challenge hasn\'t started yet.'); return; }
        if (eMs && now > eMs) { Alert.alert('Ended', 'This challenge has already ended.'); return; }
      }
    } catch {}
    const ref = doc(db, "challenges", challengeId, "participants", auth.currentUser.uid);
    await setDoc(ref, { minutes: increment(mins) }, { merge: true });
    Alert.alert("Progress", `Added ${mins} minutes.`);

  // Update user aggregate stats and award badges
  await updateUserStats(auth.currentUser.uid, { minutesDelta: mins });
  await evaluateAndAwardBadges(auth.currentUser.uid);
  setJoinedMap((m)=>{
    const cur = m[challengeId] || { joined:true, minutes:0 };
    return { ...m, [challengeId]: { ...cur, joined:true, minutes:(cur.minutes||0)+mins } };
  });

  // If goal reached, mark completed in participant doc (self-write allowed by rules)
  try {
    const ch = challenges.find(c=> c.id===challengeId);
    const goal = Number(ch?.goalMinutes || ch?.targetMinutes || 0);
    if (goal>0) {
      const after = (joinedMap[challengeId]?.minutes||0) + mins;
      if (after >= goal && !joinedMap[challengeId]?.completed) {
        await setDoc(ref, { completed: true, completedAt: serverTimestamp() }, { merge: true });
        setJoinedMap((m)=> ({ ...m, [challengeId]: { ...(m[challengeId]||{}), completed:true } }));
        // Auto-grant reward: badge + optional points
        try {
          const badgeName = ch?.rewardBadge || 'Challenge Finisher';
          await awardBadge(auth.currentUser.uid, `challenge_${challengeId}`, badgeName);
          const pts = Number(ch?.rewardPoints || 0);
          if (pts > 0) {
            await setDoc(doc(db, 'users', auth.currentUser.uid, 'stats', 'aggregate'), { points: increment(pts), lastUpdated: serverTimestamp() }, { merge: true });
          }
          Alert.alert('Congrats!', `${badgeName} awarded${pts>0? ` • +${pts} pts`:''}. Great job!`);
        } catch {
          Alert.alert('Congrats!', 'Challenge goal reached. Great job!');
        }
      }
    }
  } catch {}
  };

  const submitPost = async () => {
    if (!message.trim()) return;
    const safe = await ensurePostIsSafe(message.trim());
    if (!safe.ok) {
      return Alert.alert("Blocked", safe.reason || "Your post seems inappropriate.");
    }
    await addDoc(collection(db, "posts"), {
      text: message.trim(),
      createdAt: serverTimestamp(),
      anonId: `anon_${Math.random().toString(36).slice(2,8)}`,
      flagged: safe.flagged || false,
    });
    setMessage("");
    if (auth.currentUser) {
      await awardFirstPostIfNeeded(auth.currentUser.uid);
    }
    const pSnap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
    setPosts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  return (
    <SafeAreaView style={styles.container}>
  <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
  <Text style={styles.title}>Community</Text>

      <Text style={styles.section}>Group Challenges</Text>
      <FlatList
        data={challenges}
        keyExtractor={(item) => item.id}
        horizontal
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardText}>{item.description}</Text>
            <Text style={styles.meta}>
              {item.startAt ? fmtDate(item.startAt) : '—'}
              {item.endAt ? ` → ${fmtDate(item.endAt)}` : ''}
              {item.goalMinutes || item.targetMinutes ? `  • Goal ${(item.goalMinutes||item.targetMinutes)}m` : ''}
            </Text>
            {item.teamEnabled && (
              <View style={styles.flag}><Text style={styles.flagTxt}>Teams enabled</Text></View>
            )}
            <View style={styles.progressBar} accessibilityLabel={`Progress ${progressMap[item.id]||0}%`}>
              <View style={[styles.progressFill,{ width: `${progressMap[item.id]||0}%` }]} />
            </View>
            {joinedMap[item.id]?.joined ? (
              <Text style={styles.joinedTxt}>
                {joinedMap[item.id]?.completed ? 'Completed! ' : 'Joined • '}
                {joinedMap[item.id]?.rank ? `Rank #${joinedMap[item.id].rank} of ${joinedMap[item.id].total||'—'}` : 'Tracking...'} • {joinedMap[item.id]?.minutes||0}m
              </Text>
            ) : (
              <Text style={styles.joinedTxt}>Not joined</Text>
            )}
            <View style={{ height: 6 }} />
            <Button title={joinedMap[item.id]?.joined? "Joined" : "Join"} onPress={() => joinChallenge(item.id)} disabled={joinedMap[item.id]?.joined} />
            <View style={{ height: 6 }} />
            <Button title="+10 min" onPress={() => addMeditationMinutes(item.id, 10)} disabled={!joinedMap[item.id]?.joined} />
            {Array.isArray(teamsMap[item.id]) && teamsMap[item.id].length>0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.section}>Top Teams</Text>
                {teamsMap[item.id].map((t, idx)=> (
                  <View key={t.id} style={styles.teamItem}><Text style={styles.teamTxt}>{idx+1}. {t.name} • {t.minutes}m</Text></View>
                ))}
                {joinedMap[item.id]?.joined && (
                  <View style={{ marginTop:8 }}>
                    <Text style={styles.section}>Your Team</Text>
                    <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
                      {teamsMap[item.id].map(t => (
                        <Button key={t.id} title={userTeamMap[item.id]===t.id? `✓ ${t.name}` : t.name} onPress={async ()=>{
                          try {
                            const pref = doc(db, 'challenges', item.id, 'participants', auth.currentUser.uid);
                            await setDoc(pref, { teamId: t.id }, { merge: true });
                            setUserTeamMap(m=> ({ ...m, [item.id]: t.id }));
                          } catch {}
                        }} />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
            {Array.isArray(feedMap[item.id]) && feedMap[item.id].length>0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.section}>Updates</Text>
                {feedMap[item.id].map((f)=> (
                  <View key={f.id} style={styles.feedItem}>
                    <Text style={styles.feedTxt}>{f.text || f.title || 'Update'}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      />

      <Text style={styles.section}>Your Badges</Text>
      <FlatList
        data={badges}
        keyExtractor={(item) => item.id}
        horizontal
        renderItem={({ item }) => (
          <View style={styles.badge}><Text style={{ color: theme.text }}>🏅 {item.name}</Text></View>
        )}
      />

      <Text style={styles.section}>Leaderboard</Text>
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.uid}
        horizontal
        renderItem={({ item, index }) => (
          <View style={styles.badge}><Text style={{ color: theme.text }}>{index+1}. {item.uid.slice(0,6)} • {item.minutes}m</Text></View>
        )}
      />

      <Text style={styles.section}>Anonymous Board</Text>
      <View style={styles.postRow}>
        <TextInput style={styles.input} value={message} onChangeText={setMessage} placeholder="Share your thoughts anonymously..." placeholderTextColor={theme.textMuted} />
        <Button title="Post" onPress={submitPost} />
      </View>
      <View>
        {posts.map((item) => (
          <View key={item.id} style={styles.post}>
            <Text style={styles.anon}>{item.anonId || "anon"}</Text>
            <Text style={{ color: theme.text }}>{item.text}</Text>
          </View>
        ))}
      </View>
  </ScrollView>
    </SafeAreaView>
  );
}
const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 8, color: colors.text },
  section: { marginTop: 12, fontWeight: "700", color: colors.textMuted },
  card: { padding: 12, backgroundColor: colors.card, borderRadius: 12, marginRight: 10, width: 220 },
  cardTitle: { fontWeight: "700", marginBottom: 4, color: colors.text },
  cardText: { color: colors.textMuted, marginBottom: 8 },
  meta: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  badge: { padding: 10, backgroundColor: colors.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD', borderRadius: 20, marginRight: 8 },
  postRow: { flexDirection: "row", alignItems: "center", marginVertical: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: colors.bg === '#0B1722' ? '#345' : '#ddd', borderRadius: 8, padding: 8, marginRight: 8, color: colors.text, backgroundColor: colors.bg === '#0B1722' ? '#0F1E2C' : '#ffffff' },
  post: { backgroundColor: colors.card, padding: 10, borderRadius: 10, marginVertical: 6 },
  anon: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  progressBar: { height: 6, backgroundColor: colors.bg === '#0B1722' ? '#253445' : '#E3F2FD', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', backgroundColor: colors.primary || '#0288D1' },
  joinedTxt: { color: colors.textMuted, fontSize: 12 },
  flag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.bg === '#0B1722' ? '#1b2b3b' : '#E0F7FA', borderRadius: 12, marginBottom: 6 },
  flagTxt: { color: colors.textMuted, fontSize: 11 },
  feedItem: { backgroundColor: colors.bg === '#0B1722' ? '#152231' : '#F5FBFF', padding: 8, borderRadius: 8, marginTop: 6 },
  feedTxt: { color: colors.text },
  teamItem: { backgroundColor: colors.bg === '#0B1722' ? '#10202f' : '#E8F6FF', padding: 6, borderRadius: 8, marginTop: 4 },
  teamTxt: { color: colors.text }
});
