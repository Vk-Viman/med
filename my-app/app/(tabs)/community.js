import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Button, Alert, ScrollView, TouchableOpacity, Modal, Pressable, ActivityIndicator, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db, auth } from "../../firebase/firebaseConfig";
import { collection, doc, addDoc, getDoc, getDocs, setDoc, query, where, orderBy, serverTimestamp, updateDoc, increment, limit, onSnapshot, startAfter, deleteDoc } from "firebase/firestore";
import { inboxAdd } from '../../src/services/inbox';
import { ensurePostIsSafe } from "../../src/moderation";
import { updateUserStats, evaluateAndAwardBadges, awardFirstPostIfNeeded, awardBadge, badgeEmoji } from "../../src/badges";
import { getBadgeMeta, nextMinuteThreshold, nextStreakThreshold, progressTowards } from "../../src/constants/badges";
import { getCachedAggStats, setCachedAggStats } from "../../src/utils/statsCache";
import { useTheme } from "../../src/theme/ThemeProvider";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeAdminConfig } from '../../src/services/config';
import { safeSnapshot, trackSubscription } from '../../src/utils/safeSnapshot';
import GradientCard from "../../src/components/GradientCard";
import AnimatedButton from "../../src/components/AnimatedButton";
import EmptyState from "../../src/components/EmptyState";
import ShimmerCard from "../../src/components/ShimmerCard";
import FloatingActionButton from "../../src/components/FloatingActionButton";
import SkeletonLoader from "../../src/components/SkeletonLoader";
import PulseButton from "../../src/components/PulseButton";

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  // defaults; admin-config can override
  let POST_COOLDOWN_MS = 15000; // 15s cooldown
  let REPLY_COOLDOWN_MS = 10000; // 10s cooldown
  const [leaderboard, setLeaderboard] = useState([]);
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]); // aggregated across challenges
  const [lbWindow, setLbWindow] = useState('7d'); // '7d' | '30d' | 'all'
  const [joinedMap, setJoinedMap] = useState({}); // { [challengeId]: { joined:true, minutes:number, rank:number|null, total:number|null } }
  const [progressMap, setProgressMap] = useState({}); // { [challengeId]: percent }
  const [feedMap, setFeedMap] = useState({}); // { [challengeId]: [feedItem,...] }
  const [teamsMap, setTeamsMap] = useState({}); // { [challengeId]: [{ name, minutes }] }
  const [userTeamMap, setUserTeamMap] = useState({}); // { [challengeId]: teamId }
  const [badgeModal, setBadgeModal] = useState(null); // { id, name }
  const scrollRef = useRef(null);
  const [showTop, setShowTop] = useState(false);
  const [cfg, setCfg] = useState({ communityMaxLength:300, communityAllowLinks:false, postCooldownMs:15000, replyCooldownMs:10000, termsShort:'', termsCategories:[], termsFullUrl:'' });
  const [isBanned, setIsBanned] = useState(false);

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
      const u = safeSnapshot(chRef, (snap)=>{
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
        // Fetch global admin mutes (best-effort)
        let globalMutes = new Set();
        try { const gm = await getDocs(collection(db, 'admin_mutes')); globalMutes = new Set(gm.docs.map(d=> d.id)); } catch {}
        const filtered = rows.filter(p=> !p.hidden && !(p.anonId && (mutedAnonIds.has(p.anonId) || globalMutes.has(p.anonId))));
        setPosts(filtered);
        // Best-effort: hydrate counts from subcollections so counts persist across sessions even without Functions
        try { await hydrateCountsForPosts(filtered); } catch {}
        setLastPostDoc(psnap.docs[psnap.docs.length-1] || null);
        setHasMore(psnap.docs.length === 10);
      } catch {} finally { setLoadingPosts(false); }
    })();
    // Badges (user)
    if (auth.currentUser) {
      try {
        const bRef = collection(db, 'users', auth.currentUser.uid, 'badges');
        const u = safeSnapshot(bRef, (snap)=>{ setBadges(snap.docs.map(d=> ({ id:d.id, ...d.data() }))); });
        unsubs.push(u);
      } catch {}
    }
    return () => { unsubs.forEach(fn=> { try { fn(); } catch {} }); };
  }, []);

  // Subscribe to admin config for dynamic limits and terms
  useEffect(()=>{
    let unsub;
    try { unsub = subscribeAdminConfig((c)=> setCfg(c)); } catch {}
    return ()=>{ try{ unsub && unsub(); }catch{} };
  },[]);

  // Listen to current user's profile for ban state
  useEffect(()=>{
    const uid = auth.currentUser?.uid; if(!uid) return;
    try {
      const uref = doc(db, 'users', uid);
      const unsub = safeSnapshot(uref, (snap)=>{ try { setIsBanned(!!(snap.data()?.banned)); } catch { setIsBanned(false); } });
      return ()=>{ try{ unsub&&unsub(); }catch{} };
    } catch { setIsBanned(false); }
  }, [auth.currentUser?.uid]);

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
        const u = safeSnapshot(pref, (psnap)=>{
          const rows = psnap.docs.map(d=> ({ uid:d.id, ...(d.data()||{}) }));
          // Leaderboard for the first challenge
          // (Keep original behavior but recompute in realtime)
          // If window is 'all', we can present raw participant minutes for active challenge
          if (lbWindow === 'all') {
            setLeaderboard(prev=>{
              if (challenges.length>0 && challenges[0]?.id === ch.id) {
                const top = [...rows].sort((a,b)=> (b.minutes||0) - (a.minutes||0)).slice(0,5).map(r=> ({ uid:r.uid, minutes: r.minutes||0 }));
                return top;
              }
              return prev;
            });
          }
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
        const u = safeSnapshot(tref, (tsnap)=>{
          const teams = tsnap.docs.map(d=> ({ id:d.id, name:(d.data()?.name||d.id), minutes: Number(d.data()?.totalMinutes||0) }));
          teams.sort((a,b)=> b.minutes - a.minutes);
          setTeamsMap(prev => ({ ...prev, [ch.id]: teams.slice(0,3) }));
        });
        unsubs.push(u);
      } catch {}
      // Feed snapshot (recent)
      try {
        const fref = query(collection(db, 'challenges', ch.id, 'feed'), orderBy('createdAt','desc'), limit(3));
        const u = safeSnapshot(fref, (fsnap)=>{
          const items = fsnap.docs.map(d=> ({ id:d.id, ...d.data() }));
          setFeedMap(prev => ({ ...prev, [ch.id]: items }));
        });
        unsubs.push(u);
      } catch {}
    });
    return ()=> { unsubs.forEach(fn=> { try { fn(); } catch {} }); };
  }, [challenges.length]);

  // Compute global all-time leaderboard (client-side) by summing participant minutes across all challenges
  useEffect(()=>{
    let cancelled = false;
    (async()=>{
      try {
        const totals = new Map();
        for(const ch of challenges){
          try {
            const partSnap = await getDocs(collection(db, 'challenges', ch.id, 'participants'));
            partSnap.docs.forEach(d=>{
              const m = Number(d.data()?.minutes||0);
              if(m>0) totals.set(d.id, (totals.get(d.id)||0)+m);
            });
          } catch {}
          if(cancelled) return;
        }
        const arr = Array.from(totals.entries()).map(([uid, minutes])=> ({ uid, minutes }));
        arr.sort((a,b)=> b.minutes - a.minutes);
        if(!cancelled) setGlobalLeaderboard(arr.slice(0,5));
      } catch {}
    })();
    return ()=>{ cancelled = true; };
  }, [challenges.map(c=>c.id).join(',')]);

  // Recompute time-window leaderboards from sessions (per-user aggregates)
  useEffect(()=>{
    let cancelled = false;
    (async()=>{
      try {
        // Only recompute for 7d or 30d; 'all' uses challenge participant real-time listener
        if(lbWindow === 'all') return;
        const now = Date.now();
        const days = lbWindow === '7d' ? 7 : 30;
        const start = new Date(now - days*24*60*60*1000);
        // Query recent sessions across users; without an index on endedAt this may need a collectionGroup in future
        // For now, approximate by scanning participants of active challenges (already in state) and fetching each user's recent aggregate doc
        const userIds = new Set();
        challenges.forEach(ch=>{ (ch.participants||[]).forEach(p=> userIds.add(p.uid)); });
        // Fallback: if no challenge participants loaded, derive from leaderboard current list
        leaderboard.forEach(r=> userIds.add(r.uid));
        const arr = Array.from(userIds).slice(0,200); // cap to 200 for performance
        const perUser = [];
        for(const id of arr){
          try {
            // Sessions subcollection scan limited by date window (client side filter if missing index)
            const sessRef = collection(db, 'users', id, 'sessions');
            const qref = query(sessRef, orderBy('endedAt','desc'), limit(200));
            const snap = await getDocs(qref);
            let mins = 0;
            snap.docs.forEach(d=>{
              const data = d.data()||{};
              const end = data.endedAt?.toDate ? data.endedAt.toDate() : null;
              const m = Number(data.minutes||data.durationMinutes||0);
              if(end && end >= start) mins += m;
            });
            if(mins>0) perUser.push({ uid:id, minutes: mins });
          } catch {}
          if(cancelled) return;
        }
        perUser.sort((a,b)=> b.minutes - a.minutes);
        if(!cancelled) setLeaderboard(perUser.slice(0,5));
      } catch {}
    })();
    return ()=>{ cancelled = true; };
  }, [lbWindow, challenges.length]);

  // Guidelines banner persistence
  useEffect(()=>{
    (async()=>{
      try {
        const v = await AsyncStorage.getItem('@guidelinesDismissed');
        setShowGuidelines(v===null);
      } catch { setShowGuidelines(true); }
      try {
        const ta = await AsyncStorage.getItem('@termsAcceptedV1');
        setTermsAccepted(ta === '1');
      } catch {}
    })();
  },[]);

  const dismissGuidelines = async ()=>{
    try { await AsyncStorage.setItem('@guidelinesDismissed','1'); } catch {}
    setShowGuidelines(false);
  };

  const acceptTerms = async ()=>{
    try { await AsyncStorage.setItem('@termsAcceptedV1','1'); } catch {}
    setTermsAccepted(true);
  };

  const MAX_LEN = Number(cfg.communityMaxLength || 300);
  const hasLink = (t)=> /(?:https?:\/\/|www\.)/i.test(t||'');

  const loadMorePosts = async ()=>{
    if(loadingMore || !hasMore || !lastPostDoc) return;
    setLoadingMore(true);
    try {
      const pRef = query(collection(db, 'posts'), orderBy('createdAt','desc'), startAfter(lastPostDoc), limit(10));
      const psnap = await getDocs(pRef);
      const rows = psnap.docs.map(d=> ({ id:d.id, _snap:d, ...d.data() }));
      // apply admin mutes again
      let globalMutes = new Set();
      try { const gm = await getDocs(collection(db, 'admin_mutes')); globalMutes = new Set(gm.docs.map(d=> d.id)); } catch {}
      const filtered = rows.filter(p=> !p.hidden && !(p.anonId && (mutedAnonIds.has(p.anonId) || globalMutes.has(p.anonId))));
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
    if(isBanned){ Alert.alert('Action blocked','Your account is restricted from posting.'); return; }
    if(!termsAccepted){
      Alert.alert('Accept guidelines', 'Please accept the Community Guidelines & Terms before participating.');
      return;
    }
    if(replyText.length > MAX_LEN){
      Alert.alert('Too long', `Replies are limited to ${MAX_LEN} characters.`);
      return;
    }
    if(!cfg.communityAllowLinks && hasLink(replyText)){
      Alert.alert('Links not allowed', 'Please remove links from your reply.');
      return;
    }
    const now = Date.now();
    const delta = now - lastReplyAt;
    const REPLY_MS = Number(cfg.replyCooldownMs||REPLY_COOLDOWN_MS);
    if(delta < REPLY_MS){
      const wait = Math.ceil((REPLY_MS - delta)/1000);
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
  // Refresh accurate replies count from subcollection (best-effort)
      try {
        const rsnap = await getDocs(collection(db,'posts',postId,'replies'));
        const count = rsnap?.docs?.length || 0;
        setPosts(prev=> prev.map(p=> p.id===postId? { ...p, repliesCount: count } : p));
      } catch {}
  // Notify original post author (inbox) if different user
  try {
    const postSnap = await getDoc(doc(db,'posts',postId));
    const postData = postSnap?.data?.();
    const authorUid = postData?.authorUid || postData?.uid || null;
    const currentUid = auth.currentUser?.uid || null;
    if(authorUid && currentUid && authorUid !== currentUid){
      // Honor notification preference of target user (replies)
      try {
        const profSnap = await getDoc(doc(db,'users',authorUid));
        const profData = profSnap?.data?.()||{};
        if(profData.notifyReplies !== false){
          await inboxAdd({ uid: authorUid, type:'reply', title:'New reply', body: (replyText.trim().slice(0,80) || 'You have a new reply'), data:{ postId } });
        }
      } catch {}
      try { const { DeviceEventEmitter } = await import('react-native'); DeviceEventEmitter.emit('app-toast', { message:'Reply sent', type:'success' }); } catch {}
    }
  } catch {}
  // Mention detection in reply (@username). Uses displayNameLower prefix search with de-dup (skip if mention notification for same post in last 5m)
  try {
    const text = replyText.trim();
    const mentions = Array.from(new Set((text.match(/@([A-Za-z0-9_]{2,20})/g)||[]).map(m=> m.slice(1).toLowerCase()))).slice(0,5);
    if(mentions.length){
      const ref = collection(db,'users');
      for(const handle of mentions){
        try {
          const snap = await getDocs(query(ref, where('displayNameLower','>=', handle), where('displayNameLower','<=', handle + '\uf8ff'), limit(5)));
          snap.docs.forEach(async d=>{
            const prof = d.data()||{}; const dn = (prof.displayName||'').toLowerCase();
            if(dn === handle && d.id !== auth.currentUser?.uid){
              try {
                // dedup: look for existing mention notification referencing same postId within last 5 minutes
                const inboxRef = collection(db,'users',d.id,'inbox');
                const since = new Date(Date.now() - 5*60*1000);
                const qref = query(inboxRef, where('type','==','mention'), where('data.postId','==', postId), orderBy('createdAt','desc'), limit(5));
                const existing = await getDocs(qref);
                const hasRecent = existing.docs.some(x=>{ const ct = x.data()?.createdAt?.toDate?.(); return ct && ct >= since; });
                if(!hasRecent){
                  const prefSnap = await getDoc(doc(db,'users',d.id));
                  const prefData = prefSnap?.data?.()||{};
                  if(prefData.notifyMentions !== false){
                    await inboxAdd({ uid:d.id, type:'mention', title:'You were mentioned', body: text.slice(0,90), data:{ postId } });
                  }
                }
              } catch { await inboxAdd({ uid:d.id, type:'mention', title:'You were mentioned', body: text.slice(0,90), data:{ postId } }); }
            }
          });
        } catch {}
      }
    }
  } catch {}
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
      const token = await auth.currentUser.getIdToken();
      const projectId = auth?.app?.options?.projectId || '';
      const url = `https://us-central1-${projectId}.cloudfunctions.net/reportAbuse`;
      const resp = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ postId: post.id, reason: reason || 'inappropriate' }) });
      if(!resp.ok){
        const data = await resp.json().catch(()=>({}));
        if(resp.status===429){ throw new Error(data?.error || 'Too many reports. Please try again shortly.'); }
        // Fallback to Firestore write if function unavailable
        await addDoc(collection(db,'reports'), { postId: post.id, reason: reason || 'inappropriate', reporterUid: auth.currentUser.uid, createdAt: serverTimestamp(), status: 'open' });
      }
      Alert.alert('Reported', 'Thanks for the report. Our moderators will review it.');
    } catch(e){
      Alert.alert('Report failed', e?.message || 'Please try again.');
    }
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

    // If goal reached or milestones crossed, mark completed / notify
    try {
      const ch = challenges.find(c=> c.id===challengeId);
      const goal = Number(ch?.goalMinutes || ch?.targetMinutes || 0);
      if (goal>0) {
        const after = (joinedMap[challengeId]?.minutes||0) + mins;
        const before = (joinedMap[challengeId]?.minutes||0);
        // New milestone thresholds 25%, 50%, 75%
        const thresholds = [0.25, 0.5, 0.75];
        for(const t of thresholds){
          const pct = t*100;
          const crossed = before < goal * t && after >= goal * t;
          if(crossed){
            try {
              const selfSnap = await getDoc(doc(db,'users',auth.currentUser.uid));
              if(selfSnap?.data?.()?.notifyMilestones !== false){
                const label = pct===25? 'Quarter way' : pct===50? 'Halfway there' : 'Almost there';
                await inboxAdd({ type:'milestone', title:label, body:`${ch?.title||'Challenge'} ${pct}% reached`, data:{ challengeId, percent:pct } });
              }
            } catch {}
          }
        }
        const crossedHalf = false; // handled above
        if(crossedHalf){ try {
          const selfSnap = await getDoc(doc(db,'users',auth.currentUser.uid));
          if(selfSnap?.data?.()?.notifyMilestones !== false){
            await inboxAdd({ type:'milestone', title:'Halfway there', body:`${ch?.title||'Challenge'} 50% reached`, data:{ challengeId, percent:50 } });
          }
        } catch {} }
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
            try {
              const selfSnap = await getDoc(doc(db,'users',auth.currentUser.uid));
              if(selfSnap?.data?.()?.notifyMilestones !== false){
                await inboxAdd({ type:'milestone', title:'Challenge complete', body:`${ch?.title||'Challenge'} finished!`, data:{ challengeId, percent:100 } });
              }
            } catch {}
          } catch {
            Alert.alert('Congrats!', 'Challenge goal reached. Great job!');
          }
        }
      }
    } catch {}
  };

  const submitPost = async () => {
    if (!message.trim()) return;
    if(isBanned){ Alert.alert('Action blocked','Your account is restricted from posting.'); return; }
    if(!termsAccepted){
      Alert.alert('Accept guidelines', 'Please accept the Community Guidelines & Terms before posting.');
      return;
    }
    if(message.length > MAX_LEN){
      Alert.alert('Too long', `Posts are limited to ${MAX_LEN} characters.`);
      return;
    }
    if(!cfg.communityAllowLinks && hasLink(message)){
      Alert.alert('Links not allowed', 'Please remove links from your post.');
      return;
    }
    const now = Date.now();
    const delta = now - lastPostAt;
    const POST_MS = Number(cfg.postCooldownMs||POST_COOLDOWN_MS);
    if(delta < POST_MS){
      const wait = Math.ceil((POST_MS - delta)/1000);
      return Alert.alert('Slow down', `Please wait ${wait}s before posting again.`);
    }
    const safe = await ensurePostIsSafe(message.trim());
    if (!safe.ok) {
      return Alert.alert("Blocked", safe.reason || "Your post seems inappropriate.");
    }
    const bodyText = message.trim();
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
    const newList = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setPosts(newList);
    // Hydrate the first page for accurate counts
    try { await hydrateCountsForPosts(newList.slice(0, 10)); } catch {}
    // Mention detection for post with de-dup (same postId not possible yet, but prevent flood via manual retries)
    try {
      const mentions = Array.from(new Set((bodyText.match(/@([A-Za-z0-9_]{2,20})/g)||[]).map(m=> m.slice(1).toLowerCase()))).slice(0,5);
      if(mentions.length){
        const ref = collection(db,'users');
        for(const handle of mentions){
          try {
            const snap = await getDocs(query(ref, where('displayNameLower','>=', handle), where('displayNameLower','<=', handle + '\uf8ff'), limit(5)));
            snap.docs.forEach(async d=>{
              const prof = d.data()||{}; const dn = (prof.displayName||'').toLowerCase();
              if(dn === handle && d.id !== auth.currentUser?.uid){
                try {
                  const inboxRef = collection(db,'users',d.id,'inbox');
                  const since = new Date(Date.now() - 5*60*1000);
                  const qref = query(inboxRef, where('type','==','mention'), where('data.postId','==', newPostRef.id), orderBy('createdAt','desc'), limit(5));
                  const existing = await getDocs(qref);
                  const hasRecent = existing.docs.some(x=>{ const ct = x.data()?.createdAt?.toDate?.(); return ct && ct >= since; });
                  if(!hasRecent){ await inboxAdd({ uid:d.id, type:'mention', title:'You were mentioned', body: bodyText.slice(0,90), data:{ postId: newPostRef.id } }); }
                } catch { await inboxAdd({ uid:d.id, type:'mention', title:'You were mentioned', body: bodyText.slice(0,90), data:{ postId: newPostRef.id } }); }
              }
            });
          } catch {}
        }
      }
    } catch {}
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

  // ===== Memoized render items for FlatLists =====
  const renderChallenge = useCallback(({ item }) => (
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
  ), [progressMap, joinedMap, teamsMap, userTeamMap, feedMap]);

  const PostItem = useCallback(({ item }) => (
    <View style={styles.post}>
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
  ), [replyTarget, replyText, theme.text, theme.textMuted, toggleLike]);

  const renderBadge = useCallback(({ item }) => (
    <TouchableOpacity onPress={()=> setBadgeModal(item)}>
      <View style={styles.badge}><Text style={{ color: theme.text }}>{badgeEmoji(item.id)} {item.name || item.id}</Text></View>
    </TouchableOpacity>
  ), [theme.text]);

  const renderLeaderboard = useCallback(({ item, index }) => (
    <View style={styles.badge}><Text style={{ color: theme.text }}>{index+1}. {item.uid.slice(0,6)} • {item.minutes}m</Text></View>
  ), [theme.text]);

  const keyExtractorPost = useCallback((item)=> item.id, []);
  const keyExtractorUid = useCallback((item)=> item.uid, []);
  const keyExtractorBadge = useCallback((item)=> item.id, []);

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
        initialNumToRender={3}
        windowSize={5}
        maxToRenderPerBatch={5}
        removeClippedSubviews
        renderItem={renderChallenge}
      />

      <Text style={styles.section}>Your Badges</Text>
      <FlatList
        data={badges}
        keyExtractor={keyExtractorBadge}
        horizontal
        initialNumToRender={8}
        windowSize={5}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        renderItem={renderBadge}
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
      <View style={{ flexDirection:'row', gap:8, marginLeft:12, marginBottom:4 }}>
        {['7d','30d','all'].map(w=> (
          <TouchableOpacity key={w} onPress={()=> setLbWindow(w)} style={{ paddingHorizontal:10, paddingVertical:4, borderRadius:14, backgroundColor: lbWindow===w ? (theme.bg === '#0B1722' ? '#1b2b3b' : '#0288D1') : (theme.bg === '#0B1722' ? '#15222f' : '#E3F2FD') }}>
            <Text style={{ fontSize:12, fontWeight:'700', color: lbWindow===w ? '#fff' : theme.text }}>{w}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={leaderboard}
        keyExtractor={keyExtractorUid}
        horizontal
        renderItem={renderLeaderboard}
        initialNumToRender={5}
        windowSize={3}
        removeClippedSubviews
      />
      {globalLeaderboard.length>0 && (
        <>
          <Text style={[styles.section,{ marginTop:12 }]}>Global (All Challenges)</Text>
          <FlatList
            data={globalLeaderboard}
            keyExtractor={keyExtractorUid}
            horizontal
            renderItem={renderLeaderboard}
            initialNumToRender={5}
            windowSize={3}
            removeClippedSubviews
          />
        </>
      )}

      <Text style={styles.section}>
        <Ionicons name="people-outline" size={20} color={theme.text} /> Community Board
      </Text>
      <ShimmerCard colors={['#E1F5FE', '#B3E5FC', '#81D4FA']} style={{ marginBottom: 16, padding: 16 }} shimmerSpeed={3500}>
        <View style={styles.postInputContainer}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={20} color="#0288D1" />
          </View>
          <TextInput 
            style={styles.modernInput} 
            value={message} 
            onChangeText={setMessage} 
            placeholder="Share your journey anonymously..." 
            placeholderTextColor={theme.textMuted}
            multiline
            maxLength={cfg.communityMaxLength || 300}
          />
        </View>
        <View style={styles.postActions}>
          <Text style={styles.charCount}>{message.length}/{cfg.communityMaxLength || 300}</Text>
          <PulseButton 
            onPress={submitPost} 
            enabled={message.trim() && !isBanned}
            pulseColor="rgba(2, 136, 209, 0.4)"
            pulseScale={1.12}
            haptic={true}
          >
            <LinearGradient
              colors={message.trim() && !isBanned ? ['#0288D1', '#01579B'] : ['#CFD8DC', '#B0BEC5']}
              style={styles.postButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.postButtonText}>Share</Text>
            </LinearGradient>
          </PulseButton>
        </View>
      </ShimmerCard>
      <View>
        {loadingPosts ? (
          <View style={{ paddingHorizontal: 16 }}>
            {[...Array(4)].map((_, i) => (
              <SkeletonLoader key={i} height={120} style={{ marginBottom: 12 }} />
            ))}
          </View>
        ) : posts.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="No posts yet"
            subtitle="Be the first to share your mindfulness journey with the community!"
          />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={keyExtractorPost}
            renderItem={PostItem}
            initialNumToRender={6}
            windowSize={7}
            maxToRenderPerBatch={8}
            removeClippedSubviews
            scrollEnabled={false}
          />
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

      {/* Blocking Terms & Guidelines modal */}
      {!termsAccepted && (
        <Modal visible transparent animationType='fade' onRequestClose={()=>{}}>
          <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.6)', alignItems:'center', justifyContent:'center', padding:20 }}>
            <View style={{ width:'100%', maxWidth:480, backgroundColor: theme.card, borderRadius:16, padding:16 }}>
              <Text style={{ color: theme.text, fontWeight:'800', fontSize:18, marginBottom:6 }}>Community Guidelines & Terms</Text>
              {!!(cfg.termsCategories||[]).length && (
                <View style={{ marginBottom:8 }}>
                  {(cfg.termsCategories||[]).map((cat, idx)=> (
                    <Text key={idx} style={{ color: theme.textMuted, fontSize:14 }}>• {cat}</Text>
                  ))}
                </View>
              )}
              <Text style={{ color: theme.textMuted, fontSize:14 }}>
                {cfg.termsShort || 'Be kind and respectful. No hate speech, harassment, threats, or sharing personal information. Avoid links and spam. Posts may be auto-hidden and reviewed by moderators.'}
              </Text>
              {!!cfg.termsFullUrl && (
                <View style={{ marginTop:8 }}>
                  <Text style={{ color: '#0288D1' }} onPress={()=>{
                    try { const Linking = require('react-native').Linking; Linking.openURL(cfg.termsFullUrl); } catch {}
                  }}>View full terms</Text>
                </View>
              )}
              <View style={{ height:10 }} />
              <Button title="I agree" onPress={acceptTerms} />
            </View>
          </View>
        </Modal>
      )}
      
      {/* Floating Action Button for Quick Post */}
      {termsAccepted && !isBanned && (
        <FloatingActionButton
          icon="create"
          onPress={() => {
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            // Focus will go to the TextInput at top
          }}
          colors={['#AB47BC', '#8E24AA']}
          position="bottom-right"
          bottom={80}
        />
      )}
    </SafeAreaView>
  );
}
const createStyles = (colors) => StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: colors.bg 
  },
  title: { 
    fontSize: 28, 
    fontWeight: "800", 
    marginBottom: 12, 
    color: colors.text,
    letterSpacing: 0.5,
  },
  section: { 
    marginTop: 16, 
    fontSize: 18,
    fontWeight: "700", 
    color: colors.text,
    marginBottom: 10,
  },
  card: { 
    padding: 16, 
    backgroundColor: colors.card, 
    borderRadius: 16, 
    marginRight: 12, 
    width: 240,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.bg === '#0B1722' ? '#263238' : '#E1F5FE',
  },
  cardTitle: { 
    fontWeight: "800", 
    marginBottom: 6, 
    color: colors.text,
    fontSize: 16,
  },
  cardText: { 
    color: colors.textMuted, 
    marginBottom: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: { 
    color: colors.textMuted, 
    fontSize: 12, 
    marginBottom: 8,
    fontWeight: "600",
  },
  badge: { 
    paddingHorizontal: 14, 
    paddingVertical: 10,
    backgroundColor: colors.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD', 
    borderRadius: 24, 
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: colors.bg === '#0B1722' ? '#37474F' : '#B3E5FC',
  },
  postInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E1F5FE',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0288D1',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modernInput: {
    flex: 1,
    minHeight: 50,
    maxHeight: 120,
    borderWidth: 2,
    borderColor: '#B3E5FC',
    borderRadius: 14,
    padding: 12,
    color: colors.text,
    backgroundColor: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#0288D1',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  postRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginVertical: 10 
  },
  input: { 
    flex: 1, 
    borderWidth: 2, 
    borderColor: colors.bg === '#0B1722' ? '#37474F' : '#B3E5FC', 
    borderRadius: 12, 
    padding: 12, 
    marginRight: 10, 
    color: colors.text, 
    backgroundColor: colors.bg === '#0B1722' ? '#101D2B' : '#ffffff',
    fontSize: 15,
  },
  post: { 
    backgroundColor: colors.card, 
    padding: 14, 
    borderRadius: 14, 
    marginVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    borderWidth: 1,
    borderColor: colors.bg === '#0B1722' ? '#263238' : '#E1F5FE',
  },
  anon: { 
    color: colors.textMuted, 
    fontSize: 13, 
    marginBottom: 6,
    fontWeight: "600",
  },
  progressBar: { 
    height: 8, 
    backgroundColor: colors.bg === '#0B1722' ? '#263238' : '#E1F5FE', 
    borderRadius: 6, 
    overflow: 'hidden', 
    marginBottom: 8 
  },
  progressFill: { 
    height: '100%', 
    backgroundColor: colors.primary || '#0288D1' 
  },
  joinedTxt: { 
    color: colors.textMuted, 
    fontSize: 13,
    fontWeight: "600",
  },
  flag: { 
    alignSelf: 'flex-start', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    backgroundColor: colors.bg === '#0B1722' ? '#1b2b3b' : '#FFF3E0', 
    borderRadius: 14, 
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.bg === '#0B1722' ? '#37474F' : '#FFE0B2',
  },
  flagTxt: { 
    color: colors.bg === '#0B1722' ? colors.textMuted : '#E65100', 
    fontSize: 11,
    fontWeight: "700",
  },
  feedItem: { 
    backgroundColor: colors.bg === '#0B1722' ? '#152231' : '#F0F9FF', 
    padding: 10, 
    borderRadius: 10, 
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.bg === '#0B1722' ? '#263238' : '#DBEAFE',
  },
  feedTxt: { 
    color: colors.text,
    fontSize: 13,
  },
  teamItem: { 
    backgroundColor: colors.bg === '#0B1722' ? '#10202f' : '#E8F6FF', 
    padding: 8, 
    borderRadius: 10, 
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.bg === '#0B1722' ? '#263238' : '#BFDBFE',
  },
  teamTxt: { 
    color: colors.text,
    fontWeight: "600",
  },
  topBtn: { 
    position: 'absolute', 
    right: 16, 
    bottom: 16, 
    backgroundColor: colors.primary || '#0288D1', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 24, 
    shadowColor: '#000', 
    shadowOpacity: 0.25, 
    shadowRadius: 8, 
    shadowOffset: { width:0, height:4 }, 
    elevation: 4 
  },
  topBtnText: { 
    color: '#fff', 
    fontWeight: '800',
    fontSize: 14,
  }
});
