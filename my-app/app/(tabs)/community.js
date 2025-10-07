import React, { useEffect, useMemo, useState, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Button, Alert, ScrollView, TouchableOpacity, Modal, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db, auth } from "../../firebase/firebaseConfig";
import { collection, doc, addDoc, getDoc, getDocs, setDoc, query, where, orderBy, serverTimestamp, updateDoc, increment, limit, onSnapshot, startAfter, deleteDoc } from "firebase/firestore";
import { ensurePostIsSafe } from "../../src/moderation";
import { updateUserStats, evaluateAndAwardBadges, awardFirstPostIfNeeded, awardBadge, badgeEmoji } from "../../src/badges";
import { getBadgeMeta, nextMinuteThreshold, nextStreakThreshold, progressTowards } from "../../src/constants/badges";
import { getCachedAggStats, setCachedAggStats } from "../../src/utils/statsCache";
import { useTheme } from "../../src/theme/ThemeProvider";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function CommunityScreen() {
  const { theme } = useTheme();
  const styles = useMemo(()=>createStyles(theme), [theme]);
  const [challenges, setChallenges] = useState([]);
  const [badges, setBadges] = useState([]);
  const [aggStats, setAggStats] = useState({ totalMinutes: 0, streak: 0 });
  const [posts, setPosts] = useState([]);
  const [lastPostDoc, setLastPostDoc] = useState(null);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const autoLoadingRef = useRef(false);
  const [mutedAnonIds, setMutedAnonIds] = useState(new Set());
  const [message, setMessage] = useState("");
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [reporting, setReporting] = useState(null); // post being reported
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [repliesModal, setRepliesModal] = useState(null); // { post, items, lastDoc, hasMore, loading }
  const [lastPostAt, setLastPostAt] = useState(0);
  const [lastReplyAt, setLastReplyAt] = useState(0);
  const POST_COOLDOWN_MS = 15000; // 15s cooldown
  const REPLY_COOLDOWN_MS = 10000; // 10s cooldown
  const [leaderboard, setLeaderboard] = useState([]);
  const [joinedMap, setJoinedMap] = useState({}); // { [challengeId]: { joined:true, minutes:number, rank:number|null, total:number|null } }
  const [progressMap, setProgressMap] = useState({}); // { [challengeId]: percent }
  const [feedMap, setFeedMap] = useState({}); // { [challengeId]: [feedItem,...] }
  const [teamsMap, setTeamsMap] = useState({}); // { [challengeId]: [{ name, minutes }] }
  const [userTeamMap, setUserTeamMap] = useState({}); // { [challengeId]: teamId }
  const [badgeModal, setBadgeModal] = useState(null); // { id, name }
  const scrollRef = useRef(null);
  const [showTop, setShowTop] = useState(false);

  const fmtDate = (ts)=>{
    try{
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
      if(!d) return '';
      return new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric' }).format(d);
    }catch{ return ''; }
  };

  useEffect(() => {
    // Realtime listeners
    const unsubs = [];
    // Challenges
    try {
      const chRef = collection(db, 'challenges');
      const u = onSnapshot(chRef, (snap)=>{
        const rows = snap.docs.map(d=> ({ id:d.id, ...d.data() }));
        setChallenges(rows);
      });
      unsubs.push(u);
    } catch {}
    // Load user mutes
    (async()=>{
      try {
        const uid = auth.currentUser?.uid; if(uid){
          const msnap = await getDocs(collection(db, 'users', uid, 'mutes'));
          const ids = new Set(msnap.docs.map(d=> d.id));
          setMutedAnonIds(ids);
        }
      } catch {}
    })();
    // Posts initial page (pagination)
    (async()=>{
      try {
        setLoadingPosts(true);
        const pRef = query(collection(db, 'posts'), orderBy('createdAt','desc'), limit(10));
        const psnap = await getDocs(pRef);
        const rows = psnap.docs.map(d=> ({ id:d.id, _snap:d, ...d.data() }));
        const filtered = rows.filter(p=> !p.hidden && !(p.anonId && mutedAnonIds.has(p.anonId)));
        setPosts(filtered);
        setLastPostDoc(psnap.docs[psnap.docs.length-1] || null);
        setHasMore(psnap.docs.length === 10);
      } catch {} finally { setLoadingPosts(false); }
    })();
    // Badges (user)
    if (auth.currentUser) {
      try {
        const bRef = collection(db, 'users', auth.currentUser.uid, 'badges');
        const u = onSnapshot(bRef, (snap)=>{ setBadges(snap.docs.map(d=> ({ id:d.id, ...d.data() }))); });
        unsubs.push(u);
      } catch {}
    }
    return () => { unsubs.forEach(fn=> { try { fn(); } catch {} }); };
  }, []);

  // Fetch aggregate stats for progress chips (with fast fallback if missing)
  useEffect(()=>{
    const uid = auth.currentUser?.uid; if(!uid) return;
    let cancelled = false;
    (async()=>{
      try {
        try { const cached = await getCachedAggStats(uid); if(cached && !cancelled) setAggStats({ totalMinutes: Number(cached.totalMinutes||0), streak: Number(cached.streak||0) }); } catch {}
        const sRef = doc(db, 'users', uid, 'stats', 'aggregate');
        const sSnap = await getDoc(sRef);
        if(!cancelled && (typeof sSnap?.exists === 'function' ? sSnap.exists() : !!sSnap?.exists)){
          const d = sSnap.data()||{};
          setAggStats({ totalMinutes: Number(d.totalMinutes||0), streak: Number(d.streak||0) });
          try { await setCachedAggStats(uid, d); } catch {}
        }
      } catch { /* ignore */ }
    })();
    return ()=>{ cancelled = true; };
  }, [auth.currentUser?.uid]);

  // Derive leaderboard, joined state, progress, teams, and feed with per-challenge listeners
  useEffect(()=>{
    const unsubs = [];
    const uid = auth.currentUser?.uid;
    challenges.forEach(ch => {
      // Participants snapshot
      try {
        const pref = collection(db, 'challenges', ch.id, 'participants');
        const u = onSnapshot(pref, (psnap)=>{
          const rows = psnap.docs.map(d=> ({ uid:d.id, ...(d.data()||{}) }));
          // Leaderboard for the first challenge
          // (Keep original behavior but recompute in realtime)
          setLeaderboard(prev=>{
            if (challenges.length>0 && challenges[0]?.id === ch.id) {
              const top = [...rows].sort((a,b)=> (b.minutes||0) - (a.minutes||0)).slice(0,5).map(r=> ({ uid:r.uid, minutes: r.minutes||0 }));
              return top;
            }
            return prev;
          });
          // Update joined map, rank, totals, progress
          setJoinedMap(prev => {
            const next = { ...prev };
            const total = rows.length;
            let rank = null; let minutes = 0; let completed = false;
            if (uid) {
              const me = rows.find(r=> r.uid === uid);
              minutes = Number(me?.minutes||0); completed = !!me?.completed;
              const sorted = [...rows].sort((a,b)=> (b.minutes||0) - (a.minutes||0));
              const idx = sorted.findIndex(r=> r.uid === uid);
              rank = idx>=0 ? idx+1 : null;
            }
            next[ch.id] = { joined: !!rows.find(r=> r.uid===uid), minutes, rank, total, completed };
            return next;
          });
          // Teams totals
          setTeamsMap(prev => {
            const totals = new Map();
            rows.forEach(r => { if (r.teamId) totals.set(r.teamId, (totals.get(r.teamId)||0) + (r.minutes||0)); });
            return { ...prev, [ch.id]: (prev[ch.id]||[]).map(t=> ({ ...t, minutes: totals.get(t.id)||t.minutes||0 })) };
          });
          // Progress map recompute (goal-based for joined, else time-based)
          setProgressMap(prev => {
            const now = Date.now();
            const startAt = ch.startAt?.toDate ? ch.startAt.toDate().getTime() : null;
            const endAt = ch.endAt?.toDate ? ch.endAt.toDate().getTime() : null;
            const goal = Number(ch.goalMinutes || ch.targetMinutes || 0);
            let percent = 0;
            if (goal>0 && uid) {
              const me = rows.find(r=> r.uid===uid);
              const mins = Number(me?.minutes||0);
              percent = Math.max(0, Math.min(100, Math.round((mins / goal) * 100)));
            } else if (startAt && endAt && endAt>startAt) {
              percent = Math.max(0, Math.min(100, Math.round(((now - startAt) / (endAt - startAt)) * 100)));
            }
            return { ...prev, [ch.id]: percent };
          });
        });
        unsubs.push(u);
      } catch {}
      // Teams snapshot (names)
      try {
        const tref = collection(db, 'challenges', ch.id, 'teams');
        const u = onSnapshot(tref, (tsnap)=>{
          const teams = tsnap.docs.map(d=> ({ id:d.id, name:(d.data()?.name||d.id), minutes: Number(d.data()?.totalMinutes||0) }));
          teams.sort((a,b)=> b.minutes - a.minutes);
          setTeamsMap(prev => ({ ...prev, [ch.id]: teams.slice(0,3) }));
        });
        unsubs.push(u);
      } catch {}
      // Feed snapshot (recent)
      try {
        const fref = query(collection(db, 'challenges', ch.id, 'feed'), orderBy('createdAt','desc'), limit(3));
        const u = onSnapshot(fref, (fsnap)=>{
          const items = fsnap.docs.map(d=> ({ id:d.id, ...d.data() }));
          setFeedMap(prev => ({ ...prev, [ch.id]: items }));
        });
        unsubs.push(u);
      } catch {}
    });
    return ()=> { unsubs.forEach(fn=> { try { fn(); } catch {} }); };
  }, [challenges.length]);

  // Guidelines banner persistence
  useEffect(()=>{
    (async()=>{
      try { const v = await AsyncStorage.getItem('@guidelinesDismissed'); setShowGuidelines(v===null); } catch { setShowGuidelines(true); }
    })();
  },[]);

  const dismissGuidelines = async ()=>{
    try { await AsyncStorage.setItem('@guidelinesDismissed','1'); } catch {}
    setShowGuidelines(false);
  };

  const loadMorePosts = async ()=>{
    if(loadingMore || !hasMore || !lastPostDoc) return;
    setLoadingMore(true);
    try {
      const pRef = query(collection(db, 'posts'), orderBy('createdAt','desc'), startAfter(lastPostDoc), limit(10));
      const psnap = await getDocs(pRef);
      const rows = psnap.docs.map(d=> ({ id:d.id, _snap:d, ...d.data() }));
      const filtered = rows.filter(p=> !p.hidden && !(p.anonId && mutedAnonIds.has(p.anonId)));
      setPosts(prev=> [...prev, ...filtered]);
      setLastPostDoc(psnap.docs[psnap.docs.length-1] || null);
      setHasMore(psnap.docs.length === 10);
      // Hydrate counts for the newly loaded posts
      try { await hydrateCountsForPosts(filtered); } catch {}
    } catch {} finally { setLoadingMore(false); }
  };

  // Fetch likes/replies counts from subcollections (best-effort) for accurate initial render
  const hydrateCountsForPosts = async (arr)=>{
    for(const p of (arr||[])){
      try {
        const [lsnap, rsnap] = await Promise.all([
          getDocs(collection(db,'posts',p.id,'likes')),
          getDocs(collection(db,'posts',p.id,'replies'))
        ]);
        const likes = lsnap?.docs?.length || 0;
        const replies = rsnap?.docs?.length || 0;
        setPosts(prev=> prev.map(x=> x.id===p.id ? { ...x, likesCount: likes, repliesCount: replies } : x));
      } catch {}
    }
  };

  const toggleLike = async (post)=>{
    if(!auth.currentUser){ Alert.alert('Login required','Please sign in to like posts.'); return; }
    const uid = auth.currentUser.uid;
    const likeRef = doc(db, 'posts', post.id, 'likes', uid);
    try {
      const cur = await getDoc(likeRef);
      if(cur.exists()){
        await deleteDoc(likeRef);
        // Optimistic UI update only; no parent doc update required
        setPosts(prev=> prev.map(p=> p.id===post.id? { ...p, likesCount: Math.max(0, (p.likesCount||0)-1) } : p));
      } else {
        await setDoc(likeRef, { createdAt: serverTimestamp() });
        // Optimistic UI update only
        setPosts(prev=> prev.map(p=> p.id===post.id? { ...p, likesCount: (p.likesCount||0)+1 } : p));
      }
      // Refresh accurate count from subcollection (best-effort)
      try {
        const lsnap = await getDocs(collection(db,'posts',post.id,'likes'));
        const count = lsnap?.docs?.length || 0;
        setPosts(prev=> prev.map(p=> p.id===post.id? { ...p, likesCount: count } : p));
      } catch {}
    } catch (e){
      console.error('toggleLike failed', e);
      const msg = e?.code === 'permission-denied' ? 'You do not have permission to like posts. Please check Firestore rules.' : (e?.message||'Could not update like. Please try again.');
      Alert.alert('Action failed', msg);
    }
  };

  const addReply = async (postId)=>{
    if(!replyText.trim()) return;
    const now = Date.now();
    const delta = now - lastReplyAt;
    if(delta < REPLY_COOLDOWN_MS){
      const wait = Math.ceil((REPLY_COOLDOWN_MS - delta)/1000);
      return Alert.alert('Slow down', `Please wait ${wait}s before replying again.`);
    }
    const safe = await ensurePostIsSafe(replyText.trim());
    if (!safe.ok) return Alert.alert('Blocked', safe.reason || 'Your reply seems inappropriate.');
    try {
  const newReplyRef = await addDoc(collection(db,'posts',postId,'replies'), { text: replyText.trim(), createdAt: serverTimestamp(), authorUid: auth.currentUser?.uid || null, anonId: `anon_${Math.random().toString(36).slice(2,8)}`, flagged: !!safe.flagged });
      setReplyText(''); setReplyTarget(null);
      setLastReplyAt(now);
      if(repliesModal?.post?.id === postId){
        setRepliesModal(prev=> ({ ...prev, items:[...prev.items, { id:`local_${Date.now()}`, text: replyText.trim(), createdAt: { toDate: ()=> new Date() }, anonId: 'you' }] }));
      }
  // Optimistically bump repliesCount on the parent post in UI
      setPosts(prev=> prev.map(p=> p.id===postId? { ...p, repliesCount: (p.repliesCount||0)+1 } : p));
  // Check server-side rate limit flag
  try { await new Promise(r=> setTimeout(r, 400)); const rs = await getDoc(newReplyRef); if(rs?.exists?.()){ const rd = rs.data()||{}; if(rd.reviewStatus==='rate_limited'){ try { const { DeviceEventEmitter } = await import('react-native'); DeviceEventEmitter.emit('app-toast', { message:'Please wait a few seconds before replying again.', type:'info' }); } catch { /* no-op */ } } } } catch {}
    } catch (e){
      console.error('addReply failed', e);
      const msg = e?.code === 'permission-denied' ? 'You do not have permission to reply. Please sign in and check Firestore rules.' : (e?.message || 'Could not add reply. Please try again.');
      Alert.alert('Action failed', msg);
    }
  };

  const reportPost = (post)=>{ setReporting(post); };
  const submitReport = async (post, reason)=>{
    if(!auth.currentUser) return;
    try {
      await addDoc(collection(db,'reports'), { postId: post.id, reason: reason || 'inappropriate', reporterUid: auth.currentUser.uid, createdAt: serverTimestamp(), status: 'open' });
      Alert.alert('Reported', 'Thanks for the report. Our moderators will review it.');
    } catch {}
    setReporting(null);
  };

  const muteAnon = async (anonId)=>{
    if(!anonId) return;
    if(!auth.currentUser){ Alert.alert('Login required','Please sign in to mute users.'); return; }
    try {
      await setDoc(doc(db,'users',auth.currentUser.uid,'mutes',anonId), { createdAt: serverTimestamp() }, { merge: true });
      setMutedAnonIds(prev=> new Set([...prev, anonId]));
      setPosts(prev=> prev.filter(p=> p.anonId !== anonId));
    } catch (e){
      console.error('muteAnon failed', e);
      const msg = e?.code === 'permission-denied' ? 'You do not have permission to mute users. Please check Firestore rules.' : (e?.message || 'Could not mute user. Please try again.');
      Alert.alert('Action failed', msg);
    }
  };

  // Note: Admin-only actions like seeding/reset live in the Admin area now.

  const joinChallenge = async (challengeId) => {
    if (!auth.currentUser) return Alert.alert("Login required", "Please sign in to join challenges.");
    const ref = doc(db, "challenges", challengeId, "participants", auth.currentUser.uid);
    await setDoc(ref, { minutes: 0, joinedAt: serverTimestamp() }, { merge: true });
    // Append a feed event (client-allowed type)
    try { await addDoc(collection(db, 'challenges', challengeId, 'feed'), { type:'join', authorUid: auth.currentUser.uid, text: 'Joined the challenge', createdAt: serverTimestamp() }); } catch {}
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
    // Feed progress tick
    try { await addDoc(collection(db, 'challenges', challengeId, 'feed'), { type:'progress', authorUid: auth.currentUser.uid, text: `+${mins}m`, createdAt: serverTimestamp() }); } catch {}
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
          // Feed completion event
          try { await addDoc(collection(db, 'challenges', challengeId, 'feed'), { type:'completion', authorUid: auth.currentUser.uid, text: 'Completed the challenge!', createdAt: serverTimestamp() }); } catch {}
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
    const now = Date.now();
    const delta = now - lastPostAt;
    if(delta < POST_COOLDOWN_MS){
      const wait = Math.ceil((POST_COOLDOWN_MS - delta)/1000);
      return Alert.alert('Slow down', `Please wait ${wait}s before posting again.`);
    }
    const safe = await ensurePostIsSafe(message.trim());
    if (!safe.ok) {
      return Alert.alert("Blocked", safe.reason || "Your post seems inappropriate.");
    }
    const newPostRef = await addDoc(collection(db, "posts"), {
      text: message.trim(),
      createdAt: serverTimestamp(),
      authorUid: auth.currentUser?.uid || null,
      anonId: `anon_${Math.random().toString(36).slice(2,8)}`,
      flagged: safe.flagged || false,
    });
    setMessage("");
  setLastPostAt(now);
    if (auth.currentUser) {
      await awardFirstPostIfNeeded(auth.currentUser.uid);
    }
    try {
      await new Promise(r=> setTimeout(r, 500));
      const ps = await getDoc(newPostRef);
      if(ps?.exists?.()){
        const pd = ps.data()||{};
        if(pd.reviewStatus === 'rate_limited'){
          try { const { DeviceEventEmitter } = await import('react-native'); DeviceEventEmitter.emit('app-toast', { message:'Please wait a few seconds before posting again.', type:'info' }); } catch { /* no-op */ }
        }
      }
    } catch {}
    const pSnap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
    setPosts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // Replies modal helpers
  const openRepliesModal = async (post) => {
    setRepliesModal({ post, items: [], lastDoc: null, hasMore: true, loading: true });
    try {
      const qRef = query(collection(db,'posts',post.id,'replies'), orderBy('createdAt','asc'), limit(10));
      const rsnap = await getDocs(qRef);
      const rows = rsnap.docs.map(d=> ({ id:d.id, _snap:d, ...d.data() }));
      setRepliesModal(prev=> ({ ...prev, items: rows, lastDoc: rsnap.docs[rsnap.docs.length-1] || null, hasMore: rsnap.docs.length===10, loading:false }));
    } catch {
      setRepliesModal(prev=> ({ ...prev, loading:false }));
    }
  };
  const loadMoreReplies = async ()=>{
    if(!repliesModal || !repliesModal.hasMore || repliesModal.loading || !repliesModal.lastDoc) return;
    setRepliesModal(prev=> ({ ...prev, loading:true }));
    try {
      const qRef = query(collection(db,'posts',repliesModal.post.id,'replies'), orderBy('createdAt','asc'), startAfter(repliesModal.lastDoc), limit(10));
      const rsnap = await getDocs(qRef);
      const rows = rsnap.docs.map(d=> ({ id:d.id, _snap:d, ...d.data() }));
      setRepliesModal(prev=> ({ ...prev, items:[...prev.items, ...rows], lastDoc: rsnap.docs[rsnap.docs.length-1] || null, hasMore: rsnap.docs.length===10, loading:false }));
    } catch {
      setRepliesModal(prev=> ({ ...prev, loading:false }));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 48 }}
        onScroll={(e)=>{
          try {
            const y = e?.nativeEvent?.contentOffset?.y || 0;
            const h = e?.nativeEvent?.layoutMeasurement?.height || 0;
            const c = e?.nativeEvent?.contentSize?.height || 0;
            setShowTop(y > 200);
            const distanceFromBottom = c - (y + h);
            if(distanceFromBottom < 300 && hasMore && !loadingMore && !autoLoadingRef.current){
              autoLoadingRef.current = true;
              loadMorePosts().finally(()=> { autoLoadingRef.current = false; });
            }
          } catch {}
        }}
        scrollEventThrottle={16}
      >
        <Text style={styles.title}>Community</Text>

      {showGuidelines && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Content Guidelines</Text>
          <Text style={styles.bannerText}>Be kind and respectful. No personal information. Report inappropriate content.</Text>
          <View style={{ height:6 }} />
          <Button title="Got it" onPress={dismissGuidelines} />
        </View>
      )}

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
          <TouchableOpacity onPress={()=> setBadgeModal(item)}>
            <View style={styles.badge}><Text style={{ color: theme.text }}>{badgeEmoji(item.id)} {item.name || item.id}</Text></View>
          </TouchableOpacity>
        )}
      />

      {/* Progress-to-next chips to mirror Home motivation */}
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, padding:8, backgroundColor: theme.card, borderRadius:12, marginTop:8 }}>
        {(() => {
          const nm = nextMinuteThreshold(aggStats.totalMinutes||0);
          if(nm){
            const pct = progressTowards(nm, aggStats.totalMinutes||0);
            return (
              <View style={{ flexDirection:'row', alignItems:'center', backgroundColor: theme.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD', paddingHorizontal:10, paddingVertical:6, borderRadius:16 }}>
                <Text style={{ fontSize:16, marginRight:6 }}>⏱️</Text>
                <Text style={{ fontSize:11, fontWeight:'700', color:'#0277BD' }}>{pct}% to {nm}m</Text>
              </View>
            );
          }
          return null;
        })()}
        {(() => {
          const ns = nextStreakThreshold(aggStats.streak||0);
          if(ns){
            const pct = progressTowards(ns, aggStats.streak||0);
            return (
              <View style={{ flexDirection:'row', alignItems:'center', backgroundColor: theme.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD', paddingHorizontal:10, paddingVertical:6, borderRadius:16 }}>
                <Text style={{ fontSize:16, marginRight:6 }}>🔥</Text>
                <Text style={{ fontSize:11, fontWeight:'700', color:'#0277BD' }}>{pct}% to {ns}-day</Text>
              </View>
            );
          }
          return null;
        })()}
      </View>

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
        {loadingPosts ? (
          <Text style={{ color: theme.textMuted }}>Loading posts…</Text>
        ) : posts.length === 0 ? (
          <Text style={{ color: theme.textMuted }}>No posts yet. Be the first!</Text>
        ) : (
          posts.map((item) => (
            <View key={item.id} style={styles.post}>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={styles.anon}>{item.anonId || "anon"}</Text>
                <Text style={styles.time}>{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : ''}</Text>
              </View>
              {item.hidden ? (
                <Text style={{ color: '#f57c00', marginTop:4, fontStyle:'italic' }}>Hidden pending review</Text>
              ) : (
                <Text style={{ color: theme.text, marginTop:4 }}>{item.text}</Text>
              )}
              <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginTop:8 }}>
                <Button title={`❤️ ${item.likesCount||0}`} onPress={()=> toggleLike(item)} />
                <Button title={`Replies ${item.repliesCount||0}`} onPress={()=> openRepliesModal(item)} />
                <Button title={replyTarget===item.id ? 'Cancel' : 'Reply'} onPress={()=> setReplyTarget(prev => prev===item.id ? null : item.id)} />
                <Button title="Report" color="#c62828" onPress={()=> reportPost(item)} />
                <Button title="Mute" onPress={()=> muteAnon(item.anonId)} />
              </View>
              {replyTarget === item.id && (
                <View style={{ marginTop:8 }}>
                  <TextInput style={styles.input} placeholder="Write a reply…" placeholderTextColor={theme.textMuted} value={replyText} onChangeText={setReplyText} />
                  <View style={{ height:6 }} />
                  <Button title="Send" onPress={()=> addReply(item.id)} />
                </View>
              )}
            </View>
          ))
        )}
        {/* Bottom loader for auto infinite scroll */}
        {hasMore && loadingMore && (
          <View style={{ alignItems:'center', paddingVertical: 12 }}>
            <ActivityIndicator size="small" color={theme.primary || '#0288D1'} />
            <Text style={{ marginTop:6, color: theme.textMuted, fontSize:12 }}>Loading more…</Text>
          </View>
        )}
      </View>
  </ScrollView>
  {showTop && (
        <TouchableOpacity
          onPress={()=> { try { scrollRef.current?.scrollTo({ y: 0, animated: true }); } catch {} }}
          style={styles.topBtn}
          accessibilityRole="button"
          accessibilityLabel="Scroll to top"
        >
          <Text style={styles.topBtnText}>↑ Top</Text>
        </TouchableOpacity>
      )}
      {/* Badge details lightweight modal */}
      {badgeModal && (
        <View accessibilityViewIsModal style={{ position:'absolute', left:0, right:0, top:0, bottom:0, backgroundColor:'rgba(0,0,0,0.4)', alignItems:'center', justifyContent:'center', padding:20 }}>
          <View style={{ width:'100%', maxWidth:420, backgroundColor: theme.card, borderRadius:16, padding:16 }}>
            <Text style={{ fontSize:28, textAlign:'center' }}>{getBadgeMeta(badgeModal.id)?.emoji || badgeEmoji(badgeModal.id)}</Text>
            <Text style={{ fontSize:18, fontWeight:'800', color: theme.text, textAlign:'center' }}>{badgeModal.name || badgeModal.id}</Text>
            {!!getBadgeMeta(badgeModal.id)?.description && (
              <Text style={{ color: theme.textMuted, marginTop:6, textAlign:'center' }}>{getBadgeMeta(badgeModal.id).description}</Text>
            )}
            <View style={{ height:8 }} />
            <Button title="Close" onPress={()=> setBadgeModal(null)} />
          </View>
        </View>
      )}

      {/* Report modal */}
      {reporting && (
        <Modal visible transparent animationType='fade' onRequestClose={()=> setReporting(null)}>
          <Pressable onPress={()=> setReporting(null)} style={{ flex:1, backgroundColor:'rgba(0,0,0,0.4)', alignItems:'center', justifyContent:'center', padding:20 }}>
            <Pressable onPress={(e)=> e.stopPropagation()} style={{ width:'100%', maxWidth:420, backgroundColor: theme.card, borderRadius:16, padding:16 }}>
              <Text style={{ color: theme.text, fontWeight:'800', fontSize:16, marginBottom:8 }}>Report Post</Text>
              <Button title="Inappropriate" onPress={()=> submitReport(reporting, 'inappropriate')} />
              <View style={{ height:6 }} />
              <Button title="Spam" onPress={()=> submitReport(reporting, 'spam')} />
              <View style={{ height:6 }} />
              <Button title="Harassment" onPress={()=> submitReport(reporting, 'harassment')} />
              <View style={{ height:10 }} />
              <Button title="Cancel" onPress={()=> setReporting(null)} />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {repliesModal && (
        <Modal visible transparent animationType='slide' onRequestClose={()=> setRepliesModal(null)}>
          <Pressable onPress={()=> setRepliesModal(null)} style={{ flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' }}>
            <Pressable onPress={(e)=> e.stopPropagation()} style={{ backgroundColor: theme.card, padding:16, borderTopLeftRadius:16, borderTopRightRadius:16, maxHeight:'70%' }}>
              <Text style={{ color: theme.text, fontWeight:'800', fontSize:16 }}>Replies</Text>
              <View style={{ height:6 }} />
              {repliesModal.items?.length === 0 && !repliesModal.loading ? (
                <Text style={{ color: theme.textMuted }}>No replies yet.</Text>
              ) : (
                <FlatList
                  data={repliesModal.items||[]}
                  keyExtractor={(it)=> it.id}
                  renderItem={({ item })=> (
                    <View style={{ marginBottom:8 }}>
                      <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                        <Text style={{ color: theme.textMuted, fontSize:12 }}>{item.anonId || 'anon'}</Text>
                        <Text style={{ color: theme.textMuted, fontSize:12 }}>{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : ''}</Text>
                      </View>
                      <Text style={{ color: theme.text }}>{item.text}</Text>
                    </View>
                  )}
                />
              )}
              {repliesModal.hasMore && (
                <View style={{ marginTop:6 }}>
                  <Button title={repliesModal.loading? 'Loading…' : 'Load more'} onPress={loadMoreReplies} disabled={repliesModal.loading} />
                </View>
              )}
              {/* Composer inside modal */}
              <View style={{ marginTop:10 }}>
                <TextInput
                  style={styles.input}
                  placeholder="Write a reply…"
                  placeholderTextColor={theme.textMuted}
                  value={replyText}
                  onChangeText={setReplyText}
                />
                <View style={{ height:6 }} />
                <Button title="Send" onPress={()=> addReply(repliesModal.post.id)} />
              </View>
              <View style={{ height:10 }} />
              <Button title='Close' onPress={()=> setRepliesModal(null)} />
            </Pressable>
          </Pressable>
        </Modal>
      )}
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
  teamTxt: { color: colors.text },
  topBtn: { position: 'absolute', right: 16, bottom: 16, backgroundColor: colors.primary || '#0288D1', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width:0, height:2 }, elevation: 3 },
  topBtnText: { color: '#fff', fontWeight: '800' }
});
