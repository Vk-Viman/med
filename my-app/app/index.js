import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Pressable, ScrollView, RefreshControl, Animated, AccessibilityInfo, InteractionManager, findNodeHandle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from 'expo-linear-gradient';
import PrimaryButton from "../src/components/PrimaryButton";
import { colors, spacing, radius, shadow } from "../src/theme";
import { useTheme } from "../src/theme/ThemeProvider";
import GradientBackground from "../src/components/GradientBackground";
import { Ionicons } from "@expo/vector-icons";
import Card from "../src/components/Card";
import { getUserProfile } from "../src/services/userProfile";
import { getMoodSummary, getChartDataSince } from "../src/services/moodEntries";
import { subscribeAdminConfig, getAdminConfig } from "../src/services/config";
import { auth, db } from "../firebase/firebaseConfig";
import { evaluateStreakBadges, listUserBadges, badgeEmoji } from "../src/badges";
import Sparkline from "../src/components/Sparkline";
import { collection, query, where, orderBy, onSnapshot, Timestamp, getDocs, doc, getDoc } from 'firebase/firestore';
import { safeSnapshot, trackSubscription } from '../src/utils/safeSnapshot';
import { ensureAndroidNotificationChannel } from '../src/notifications';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { useFocusEffect } from 'expo-router';
import { nextMinuteThreshold, nextStreakThreshold, progressTowards, loadAdminBadgesIntoCatalog } from '../src/constants/badges';
import { listAdminBadgesForUser } from '../src/services/admin';
import { ensureWeeklyDigestSummary } from '../src/services/weeklyDigest';
import { getCachedAggStats, setCachedAggStats } from '../src/utils/statsCache';
import GradientCard from "../src/components/GradientCard";
import AnimatedButton from "../src/components/AnimatedButton";
import ProgressRing from "../src/components/ProgressRing";
import ShimmerCard from "../src/components/ShimmerCard";
import FloatingActionButton from "../src/components/FloatingActionButton";
import { getMoodEmoji, formatDateTime } from "../src/utils/constants";
import { handleError, createErrorHandler } from "../src/utils/errorHandler";
import SkeletonLoader from "../src/components/SkeletonLoader";

export default function HomeScreen() {
  const router = useRouter();
  const { theme, toggle, mode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [avatarB64, setAvatarB64] = useState(null);
  const [summary, setSummary] = useState({ latest:null, streak:0 });
  const [refreshing, setRefreshing] = useState(false);
  const pullY = useRef(new Animated.Value(0)).current; // still track if needed later
  const [pullProgress, setPullProgress] = useState(0); // 0..1
  const [showToast, setShowToast] = useState(false);
  const [badges, setBadges] = useState([]);
  const [trendText, setTrendText] = useState("");
  const [moodSeries, setMoodSeries] = useState([]);
  const todayHeaderRef = useRef(null);
  const [cfg, setCfg] = useState({ allowExports:true, allowRetention:true, allowBackfillTools:false, allowMeditations:true, allowPlans:true, allowCommunity:true });
  const [todayMinutes, setTodayMinutes] = useState(0);
  const DAILY_GOAL_MIN = 10; // simple default goal
  const lastBadgeRef = useRef(null);
  const [aggStats, setAggStats] = useState({ totalMinutes: 0, streak: 0 });

  const greeting = () => {
    const h = new Date().getHours();
    if(h < 5) return 'Good night';
    if(h < 12) return 'Good morning';
    if(h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const loadData = async (opts={ showSpinner:true }) => {
    let mounted = true; // local flag for safety inside nested awaits
    if(opts.showSpinner) setLoading(true);
    try {
      const prof = await getUserProfile();
      if(prof){ setDisplayName(prof.displayName || ''); if(prof.avatarB64) setAvatarB64(prof.avatarB64); }
    } catch (e) { handleError(e, 'HomeScreen.loadData.profile', { severity: 'low' }); }
    try {
      const s = await getMoodSummary({ streakLookbackDays:14 });
      setSummary(s);
      // Award streak badges opportunistically
      const uid = auth.currentUser?.uid; if(uid && s.streak){ try { await evaluateStreakBadges(uid, s.streak); } catch (e) { handleError(e, 'HomeScreen.evaluateStreakBadges', { severity: 'low' }); } }
    } catch (e) { handleError(e, 'HomeScreen.loadData.moodSummary', { severity: 'medium' }); }
    // Load recent badges for display
    try { const uid = auth.currentUser?.uid; if(uid){ const rec = await listUserBadges(uid, 6); setBadges(rec); } } catch (e) { handleError(e, 'HomeScreen.listUserBadges', { severity: 'low' }); }
    // Build mood trends text summary (last 7 days) using cached minimal chart data
    try {
      const uid = auth.currentUser?.uid; if(uid){
        const rows = await getChartDataSince({ days: 7 });
        // prefer numeric moodScore if present, else fallback to stress
        const moodsRaw = rows.map(r=> (r.moodScore ?? r.mood));
        const moods = moodsRaw.map(v=> typeof v === 'string' ? parseFloat(v) : v).filter(n=> Number.isFinite(n));
        const stress = rows.map(r=> (typeof r.stress === 'string' ? parseFloat(r.stress) : r.stress)).filter(n=> Number.isFinite(n));
        // Decide which series to render: prefer mood if it has >=2, else stress if >=2
        if(moods.length >= 2){
          setMoodSeries(moods);
        } else if(stress.length >= 2){
          setMoodSeries(stress);
        } else {
          setMoodSeries([]);
        }
        if(moods.length >= 1){
          const avg = (moods.reduce((a,b)=>a+b,0)/moods.length).toFixed(1);
          const last = moods[moods.length-1]; const first = moods[0];
          const delta = (last - first);
          const dir = delta>0? 'improving' : (delta<0? 'declining' : 'steady');
          const avgStress = stress.length? (stress.reduce((a,b)=>a+b,0)/stress.length).toFixed(1) : '-';
          setTrendText(`Mood avg ${avg}/10 • ${dir}${avgStress!=='-'? ` • Stress avg ${avgStress}/10`:''}`);
        } else if(stress.length >= 1){
          const avgS = (stress.reduce((a,b)=>a+b,0)/stress.length).toFixed(1);
          const last = stress[stress.length-1]; const first = stress[0];
          const delta = (last - first);
          const dir = delta<0? 'improving' : (delta>0? 'rising' : 'steady');
          setTrendText(`Stress avg ${avgS}/10 • ${dir}`);
        } else {
          setMoodSeries([]);
          setTrendText('Log moods to see 7‑day trends');
        }
      }
    } catch (e) { 
      handleError(e, 'HomeScreen.loadData.trendText', { severity: 'low' }); 
      setTrendText(''); 
    }
    // Compute today's meditation minutes from sessions collection (if available)
    try {
      const uid = auth.currentUser?.uid; if(uid){
        const start = new Date(); start.setHours(0,0,0,0);
        const end = new Date(); end.setHours(23,59,59,999);
        const qRef = query(
          collection(db, `users/${uid}/sessions`),
          where('endedAt','>=', Timestamp.fromDate(start)),
          where('endedAt','<=', Timestamp.fromDate(end))
        );
        const snap = await getDocs(qRef);
        let totalSec = 0; snap.forEach(d=> { const v = d.data().durationSec; if(Number.isFinite(v)) totalSec += v; });
        setTodayMinutes(Math.round(totalSec/60));
      }
    } catch (e) { handleError(e, 'HomeScreen.loadData.todayMinutes', { severity: 'low' }); }
    // Fast-path: read cached aggregate stats if available
    try {
      const uid = auth.currentUser?.uid; if(uid){
        const cached = await getCachedAggStats(uid);
        if(cached) setAggStats({ totalMinutes: Number(cached.totalMinutes||0), streak: Number(cached.streak||0) });
      }
    } catch {}
    // Fetch aggregate stats for progress chips (and cache)
    try {
      const uid = auth.currentUser?.uid; if(uid){
        const sRef = doc(db, 'users', uid, 'stats', 'aggregate');
        const sSnap = await getDoc(sRef);
        if(sSnap?.exists()){
          const d = sSnap.data()||{};
          setAggStats({ totalMinutes: Number(d.totalMinutes||0), streak: Number(d.streak||0) });
          try { await setCachedAggStats(uid, d); } catch {}
        } else {
          setAggStats({ totalMinutes: 0, streak: 0 });
        }
      }
    } catch (e) { 
      handleError(e, 'HomeScreen.loadData.aggStats', { severity: 'low' }); 
      setAggStats({ totalMinutes: 0, streak: 0 }); 
    }
    if(opts.showSpinner) setLoading(false);
    return () => { mounted = false; };
  };

  useEffect(()=>{ 
    loadData(); 
    // Weekly digest summary check
    (async()=>{ try { await ensureWeeklyDigestSummary(); } catch {} })();
    // Merge admin-defined badges into runtime catalog (read-only on user side)
    (async()=>{ 
      try { 
        const locale = (typeof navigator !== 'undefined' && navigator.language) 
          ? navigator.language 
          : (Intl?.DateTimeFormat?.().resolvedOptions?.().locale || 'en');
        await loadAdminBadgesIntoCatalog({ fetchAdminBadges: listAdminBadgesForUser, locale: String(locale).split('-')[0] }); 
      } catch {} 
    })();
    let unsub;
    (async()=>{ try { setCfg(await getAdminConfig()); } catch {} ; try { unsub = subscribeAdminConfig(setCfg); } catch {} })();
    return ()=>{ try{ unsub && unsub(); }catch{} };
  },[]);

  // Notify when a new badge appears
  useEffect(()=>{
    const uid = auth.currentUser?.uid; if(!uid) return;
    const ref = collection(db, `users/${uid}/badges`);
  const unsub = safeSnapshot(query(ref, orderBy('awardedAt','desc')), async (snap)=>{
      const first = snap.docs[0];
      if(!first) return;
      const id = first.id;
      if(lastBadgeRef.current && lastBadgeRef.current === id) return;
      // New badge detected
      lastBadgeRef.current = id;
      setShowToast(true); setTimeout(()=> setShowToast(false), 2000);
      try { await ensureAndroidNotificationChannel(); } catch {}
      try {
        const Notifications = await import('expo-notifications');
        await Notifications.scheduleNotificationAsync({ content:{ title:'New Badge Earned', body: first.data()?.name || id }, trigger: null });
      } catch {}
    }, (err) => {
      if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') return;
      if (__DEV__) console.warn('badges listener error', err);
    });
    return ()=>{ try{ unsub(); }catch{} };
  },[]);

  const triggerToast = useCallback(() => {
    setShowToast(true);
    setTimeout(()=> setShowToast(false), 1800);
  }, []);

  const onRefresh = useCallback(async () => {
    if(refreshing) return;
    setRefreshing(true);
    impact('medium');
    await loadData({ showSpinner:false });
    setRefreshing(false);
    triggerToast();
  }, [refreshing, triggerToast]);

  useFocusEffect(React.useCallback(()=>{
    // silent refresh when returning to screen
    loadData({ showSpinner:false });
    // Announce for screen readers on focus and move focus to Today header
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        AccessibilityInfo.isScreenReaderEnabled().then((enabled)=>{
          if(!enabled) return;
          try {
            const tag = findNodeHandle(todayHeaderRef.current);
            if (tag) AccessibilityInfo.setAccessibilityFocus?.(tag);
          } catch {}
          AccessibilityInfo.announceForAccessibility('Home. Insights, streak, and quick actions.');
        }).catch(()=>{});
      }, 300);
    });
  },[]));

  // Memoized helper functions - OPTIMIZED
  const moodTint = useCallback((m) => {
    // Light mode soft pastels
    if(m == null) return '#E3F2FD';
    if(m <= 2) return '#FFEBEE';
    if(m <= 4) return '#FFF3E0';
    if(m <= 6) return '#EDEFF1';
    if(m <= 8) return '#E8F5E9';
    return '#E3F2FD';
  }, []);
  
  const moodTintDark = useCallback((m) => {
    // Dark mode, deeper tints for contrast
    if(m == null) return '#0F2132';       // blue-ish
    if(m <= 2) return '#2A1A1A';          // red-ish
    if(m <= 4) return '#2A2316';          // orange-ish
    if(m <= 6) return '#1E2328';          // neutral
    if(m <= 8) return '#18271C';          // green-ish
    return '#0F2132';
  }, []);
  // badgeEmoji helper centralized in src/badges

  const moodTextToScore = useCallback((val) => {
    if(!val) return null;
    const t = String(val).toLowerCase();
    if(t.includes('happy')) return 9;
    if(t.includes('calm')) return 8;
    if(t.includes('ok') || t.includes('neutral')) return 6;
    if(t.includes('stres')) return 4;
    if(t.includes('sad')) return 2;
    return 5; // default mid
  }, []);
  const latestMoodLabel = useMemo(() => {
    if(!summary.latest) return 'Log your first mood to start tracking';
    const dt = summary.latest.createdAt ? summary.latest.createdAt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '';
      const m = summary.latest.mood;
      const s = summary.latest.stress;
      const mNum = typeof m === 'number' ? m : (typeof m === 'string' && !isNaN(parseFloat(m)) ? parseFloat(m) : null);
      const sNum = typeof s === 'number' ? s : (typeof s === 'string' && !isNaN(parseFloat(s)) ? parseFloat(s) : null);
      const moodPart = mNum != null ? `${Math.round(mNum)}/10 mood` : (m ? `${String(m)}` : 'Mood');
      const stressPart = sNum != null ? `${Math.round(sNum)}/10 stress` : (s ? `${String(s)} stress` : '');
      return `${moodPart}${stressPart? ' • '+stressPart:''}${dt? ' · '+dt:''}`;
  }, [summary.latest]);

  const impact = useCallback(async (style = 'light') => {
    try {
      const map = { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy };
      await Haptics.impactAsync(map[style] || Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  }, []);
  
  const navigate = useCallback(async (path, h='light') => { 
    await impact(h); 
    router.push(path); 
  }, [impact, router]);

  // Real-time subscription for last 7 days to auto-update INSIGHTS and streak/summary
  useEffect(()=>{
    const uid = auth.currentUser?.uid; if(!uid) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - 6);
    const startTs = Timestamp.fromDate(start);
    const qRef = query(collection(db, `users/${uid}/moods`), where('createdAt','>=', startTs), orderBy('createdAt','asc'));
  const unsub = safeSnapshot(qRef, (snap)=>{
      const items = []; snap.forEach(d=> items.push({ id:d.id, ...d.data() }));
      // compute latest
      let latest = null;
      if(items.length){
        const last = items[items.length-1];
        latest = {
          id:last.id,
          mood:last.mood,
          stress:last.stress,
          createdAt: last.createdAt?.seconds ? new Date(last.createdAt.seconds*1000) : null
        };
      }
      // compute streak
      const byDay = new Map();
      items.forEach(it=>{ if(it.createdAt?.seconds){ const dt = new Date(it.createdAt.seconds*1000); const key = dt.toISOString().slice(0,10); byDay.set(key, true); }});
      let streak = 0; for(let i=0;i<14;i++){ const d = new Date(); d.setDate(d.getDate()-i); const key = d.toISOString().slice(0,10); if(byDay.has(key)) streak++; else break; }
      setSummary({ latest, streak });
      // compute trends with mood pref, fallback to stress
      const moods = items.map(it=>{
        if(it.moodScore != null) return typeof it.moodScore === 'string' ? parseFloat(it.moodScore) : it.moodScore;
        if(typeof it.mood === 'number') return it.mood;
        if(typeof it.mood === 'string'){ const n = parseFloat(it.mood); return Number.isFinite(n) ? n : moodTextToScore(it.mood); }
        if(it.score != null){ const n = typeof it.score === 'string' ? parseFloat(it.score) : it.score; return Number.isFinite(n)? n : null; }
        return null;
      }).filter(Number.isFinite);
      const stress = items.map(it=>{
        const v = it.stressScore ?? it.stress;
        const n = typeof v === 'string' ? parseFloat(v) : v;
        return Number.isFinite(n) ? n : null;
      }).filter(Number.isFinite);
      // Choose series to draw
      if(moods.length >= 2){
        setMoodSeries(moods);
      } else if(stress.length >= 2){
        setMoodSeries(stress);
      } else {
        setMoodSeries([]);
      }
      if(moods.length >= 1){
        const avg = (moods.reduce((a,b)=>a+b,0)/moods.length).toFixed(1);
        const delta = moods[moods.length-1] - moods[0];
        const dir = delta>0? 'improving' : (delta<0? 'declining' : 'steady');
        const avgStress = stress.length? (stress.reduce((a,b)=>a+b,0)/stress.length).toFixed(1) : '-';
        setTrendText(`Mood avg ${avg}/10 • ${dir}${avgStress!=='-'? ` • Stress avg ${avgStress}/10`:''}`);
      } else if(stress.length >= 1){
        const avgS = (stress.reduce((a,b)=>a+b,0)/stress.length).toFixed(1);
        const delta = stress[stress.length-1] - stress[0];
        const dir = delta<0? 'improving' : (delta>0? 'rising' : 'steady');
        setTrendText(`Stress avg ${avgS}/10 • ${dir}`);
      } else {
        setMoodSeries([]);
        setTrendText('Log moods to see 7‑day trends');
      }
    });
    return () => { try{ unsub(); }catch{} };
  },[]);

  return (
    <GradientBackground>
      <SafeAreaView style={[styles.container, { backgroundColor:'transparent' }]}> 
        <ScrollView
          style={{ flex:1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} progressViewOffset={10} />}
          onScroll={(e)=>{
            const y = e.nativeEvent.contentOffset.y;
            if(y < 0){
              // convert negative drag (e.g., -120..0) -> progress 1..0
              const prog = Math.min(1, Math.max(0, (-y)/120));
              setPullProgress(prog);
            } else if(pullProgress !== 0){
              setPullProgress(0);
            }
          }}
          scrollEventThrottle={16}
        >
        <View style={styles.pullAnimWrap} pointerEvents='none'>
          {(!refreshing) && (
            <LottieView
              source={require('../assets/animations/pullRefresh.json')}
              style={styles.pullAnim}
              progress={pullProgress}
            />
          )}
          {refreshing && (
            <LottieView
              source={require('../assets/animations/pullRefresh.json')}
              style={styles.pullAnim}
              autoPlay
              loop
            />
          )}
        </View>
        <View style={styles.header}>
          <TouchableOpacity accessibilityLabel="Toggle theme" onPress={toggle}>
            <Ionicons name={mode === 'light' ? 'sunny-outline' : 'moon-outline'} size={22} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Open settings" onPress={()=> router.push('/settings')}>
            {avatarB64 ? (
              <Image source={{ uri: avatarB64 }} style={styles.avatarSmall} />
            ) : (
              <Image source={require('../assets/icon.png')} style={styles.avatarSmall} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.greetWrap} accessible accessibilityLabel={`Greeting. ${greeting()}${displayName? `, ${displayName.split(' ')[0]}`:''}` }>
          <Text style={[styles.greetText, { color: theme.text }]}>{greeting()}{displayName? `, ${displayName.split(' ')[0]}`:''}</Text>
          <Text accessibilityLabel='Guided Meditation and Stress Relief' style={[styles.tagline, { color: theme.textMuted }]}>Guided Meditation & Stress Relief</Text>
        </View>

        {/* Hero Section with Progress Rings - Premium Shimmer Effect */}
        <ShimmerCard 
          colors={['#4FC3F7', '#0288D1', '#01579B']} 
          style={styles.heroCard}
          shimmerSpeed={3500}
        >
          <Text style={styles.heroQuote}>"Peace comes from within. Do not seek it without."</Text>
          <Text style={styles.heroAuthor}>— Buddha</Text>
          
          <View style={styles.progressSection}>
            <View style={styles.progressItem}>
              <ProgressRing
                progress={Math.min(100, (todayMinutes / DAILY_GOAL_MIN) * 100)}
                size={90}
                strokeWidth={8}
                color="#FFFFFF"
                backgroundColor="rgba(255,255,255,0.3)"
                animated
              />
              <View style={styles.progressLabel}>
                <Text style={styles.progressValue}>{todayMinutes}</Text>
                <Text style={styles.progressUnit}>min today</Text>
              </View>
            </View>
            
            <View style={styles.progressItem}>
              <ProgressRing
                progress={Math.min(100, (summary.streak / 30) * 100)}
                size={90}
                strokeWidth={8}
                color="#FFA726"
                backgroundColor="rgba(255,255,255,0.3)"
                animated
              />
              <View style={styles.progressLabel}>
                <Text style={styles.progressValue}>{summary.streak}</Text>
                <Text style={styles.progressUnit}>day streak</Text>
              </View>
            </View>
            
            <View style={styles.progressItem}>
              <ProgressRing
                progress={Math.min(100, ((aggStats.totalMinutes || 0) / 1000) * 100)}
                size={90}
                strokeWidth={8}
                color="#66BB6A"
                backgroundColor="rgba(255,255,255,0.3)"
                animated
              />
              <View style={styles.progressLabel}>
                <Text style={styles.progressValue}>{Math.round((aggStats.totalMinutes || 0))}</Text>
                <Text style={styles.progressUnit}>total min</Text>
              </View>
            </View>
          </View>
        </ShimmerCard>
        
  <Text ref={todayHeaderRef} style={[styles.sectionLabel,{ color: theme.textMuted }]} accessibilityRole='header' accessibilityLabel='Today'>TODAY</Text>
  <Card style={[styles.snapshotCard, { backgroundColor: (mode === 'dark' ? moodTintDark(summary.latest?.mood) : moodTint(summary.latest?.mood)) }]}> 
          {loading ? (
            <View style={{ paddingVertical: 8 }}>
              <SkeletonLoader height={60} style={{ marginBottom: 12 }} />
              <SkeletonLoader height={40} width="70%" />
            </View>
          ) : (
            <>
              {!summary.latest ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>📝</Text>
                  <Text style={[styles.emptyTitle,{ color: theme.text }]}>No moods yet</Text>
                  <Text style={[styles.emptyDesc,{ color: theme.textMuted }]}>Track how you feel to see patterns and build a streak.</Text>
                  <TouchableOpacity style={[styles.linkBtnLarge, { backgroundColor: theme.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD' }]} onPress={()=> navigate('/moodTracker','medium')} accessibilityRole='button' accessibilityLabel='Log first mood'>
                    <Ionicons name='add-circle-outline' size={18} color={mode==='dark' ? '#8EC7FF' : theme.primary} />
                    <Text style={[styles.linkBtnLargeTxt,{ color: mode==='dark' ? '#E3F2FD' : '#0277BD' }]}>Log Mood</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={[styles.snapshotRow, { marginBottom:10 }]}> 
                    <Text style={styles.moodEmoji}>{getMoodEmoji(summary.latest.mood)}</Text>
                    <View style={{ flex:1 }}>
                      <Text accessibilityLabel={`Latest: ${latestMoodLabel}`} style={[styles.snapshotTextMain,{ color: theme.text }]}>{latestMoodLabel}</Text>
                      <Text style={[styles.snapshotSub,{ color: theme.textMuted }]}>Keep consistent logging for better insights</Text>
                    </View>
                    <TouchableOpacity style={[styles.linkBtn,{ backgroundColor: theme.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD' }]} onPress={()=> navigate('/moodTracker','medium')} accessibilityLabel="Log another mood entry">
                      <Text style={[styles.linkBtnTxt,{ color: mode==='dark' ? '#E3F2FD' : '#0277BD' }]} >Log</Text>
                    </TouchableOpacity>
                  </View>
                  <Pressable onPress={()=> navigate({ pathname:'/sessions', params:{ days: 7 } }, 'light')} accessibilityRole='button' accessibilityLabel='Open sessions from last 7 days'>
                    <View style={styles.snapshotRow}>
                      <Ionicons name="flame-outline" size={20} color={summary.streak>0? '#FF7043': theme.textMuted} />
                      <Text accessibilityLabel={summary.streak>0? `${summary.streak} day streak` : 'No streak yet'} style={[styles.snapshotText, { color: theme.text }]}>{summary.streak>0? `${summary.streak}-day streak` : 'No streak yet'}</Text>
                    </View>
                  </Pressable>
                </>
              )}
            </>
          )}
        </Card>

        <View style={styles.primaryCtaWrap}>
          <Text style={[styles.sectionLabel,{ color: theme.textMuted }]}>FOCUS</Text>
          <View style={{ flexDirection:'row', gap:12 }}>
            <AnimatedButton 
              onPress={()=> navigate('/meditation','medium')}
              hapticStyle="medium"
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={['#0288D1', '#01579B']}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name='play-circle' size={20} color='#fff' />
                <Text style={styles.gradientButtonText}>Start Meditation</Text>
              </LinearGradient>
            </AnimatedButton>
            <AnimatedButton 
              onPress={()=> navigate('/sessions','light')}
              hapticStyle="light"
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={['#42A5F5', '#1E88E5']}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name='time-outline' size={20} color='#fff' />
                <Text style={styles.gradientButtonText}>Sessions</Text>
              </LinearGradient>
            </AnimatedButton>
          </View>
        </View>

  <Text style={[styles.sectionLabel,{ color: theme.textMuted }]} accessibilityRole='header' accessibilityLabel='Insights'>INSIGHTS</Text>
        {!!trendText && (
          <Card style={{ padding:12, marginBottom: spacing.sm }}>
            <Text accessibilityLabel={`Trend: ${trendText}`} style={[styles.snapshotSub,{ color: theme.text, marginBottom:8 }]}>{trendText}</Text>
            {!!(moodSeries && moodSeries.length >= 2) && (
              <Sparkline data={moodSeries} color={theme.primary} height={36} animate duration={420} />
            )}
          </Card>
        )}
        {(todayMinutes < DAILY_GOAL_MIN) && (
          <Card style={{ padding:12, marginBottom: spacing.sm }}>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <View style={{ flex:1, paddingRight:8 }}>
                <Text style={[styles.snapshotSub,{ color: theme.text }]}>
                  {todayMinutes>0 ? `Today: ${todayMinutes}m • ${DAILY_GOAL_MIN - todayMinutes}m to goal` : `No meditation yet today • Goal ${DAILY_GOAL_MIN}m`}
                </Text>
              </View>
              <Pressable style={[styles.linkBtn,{ backgroundColor: theme.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD' }]} onPress={()=> navigate('/meditation','medium')} accessibilityLabel='Start a short session'>
                <Text style={[styles.linkBtnTxt,{ color: mode==='dark' ? '#E3F2FD' : '#0277BD' }]}>Start</Text>
              </Pressable>
            </View>
          </Card>
        )}
        <View style={styles.quickGrid}>
          {cfg.allowPlans && (
          <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed]} onPress={()=> navigate('/plan')} accessibilityLabel="Open personalized plan" accessibilityRole='button'>
            <Ionicons name='sparkles-outline' size={26} color={theme.primary} />
            <Text style={[styles.gridLabel,{ color: theme.text }]}>Plan</Text>
          </Pressable>
          )}
          <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed]} onPress={()=> navigate('/report')} accessibilityLabel="Open weekly report" accessibilityRole='button'>
            <Ionicons name='stats-chart-outline' size={26} color={theme.primary} />
            <Text style={[styles.gridLabel,{ color: theme.text }]}>Weekly</Text>
          </Pressable>
          <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed]} onPress={()=> navigate('/moodTracker')} accessibilityLabel="Open mood & stress tracker" accessibilityRole='button'>
            <Ionicons name='happy-outline' size={26} color={theme.primary} />
            <Text style={[styles.gridLabel,{ color: theme.text }]}>Mood</Text>
          </Pressable>
          {cfg.allowCommunity && (
          <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed]} onPress={()=> navigate('/wellnessReport')} accessibilityLabel="Open wellness report" accessibilityRole='button'>
            <Ionicons name='pulse-outline' size={26} color={theme.primary} />
            <Text style={[styles.gridLabel,{ color: theme.text }]}>Wellness</Text>
          </Pressable>
          )}
        </View>

  <Text style={[styles.sectionLabel,{ color: theme.textMuted }]} accessibilityRole='header' accessibilityLabel='Your Achievements'>YOUR ACHIEVEMENTS</Text>
        {!!badges.length && (
          <View style={{ marginBottom: spacing.md }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {badges.map((b, index) => {
                // Check if badge is recent (within last 24 hours)
                const isRecent = b.awardedAt?.seconds && (Date.now() - b.awardedAt.seconds * 1000) < 86400000;
                
                if (isRecent && index < 3) {
                  // Premium shimmer for recent badges
                  return (
                    <ShimmerCard 
                      key={b.id}
                      colors={['#FFA726', '#FB8C00', '#F57C00']} 
                      style={{ marginRight:8, paddingHorizontal:14, paddingVertical:10, borderRadius:20, minWidth:120 }}
                      shimmerSpeed={3000}
                    >
                      <View style={{ flexDirection:'row', alignItems:'center' }}>
                        <Text style={{ fontSize:20, marginRight:6 }}>{badgeEmoji(b.id)}</Text>
                        <View>
                          <Text style={{ fontSize:12, fontWeight:'700', color:'#fff' }}>{b.name || b.id}</Text>
                          <Text style={{ fontSize:10, color:'#FFE0B2', marginTop:2 }}>✨ New!</Text>
                        </View>
                      </View>
                    </ShimmerCard>
                  );
                }
                
                // Regular badge display
                return (
                  <View key={b.id} style={[styles.badgePill, { marginRight:8 }]}>
                    <Text style={styles.badgeEmoji}>{badgeEmoji(b.id)}</Text>
                    <Text style={styles.badgeText}>{b.name || b.id}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
        {/* Progress-to-next chips with enhanced visuals */}
        <Text style={[styles.sectionLabel,{ color: theme.textMuted, marginTop:spacing.md }]}>NEXT MILESTONES</Text>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:spacing.md }}>
          {(() => {
            const nm = nextMinuteThreshold(aggStats.totalMinutes||0);
            if(nm){
              const pct = progressTowards(nm, aggStats.totalMinutes||0);
              const isClose = pct >= 80;
              
              if (isClose) {
                return (
                  <ShimmerCard 
                    key="minutes"
                    colors={['#42A5F5', '#1E88E5', '#1565C0']} 
                    style={{ flex:1, minWidth:150, paddingHorizontal:14, paddingVertical:10, borderRadius:16 }}
                    shimmerSpeed={2500}
                  >
                    <View style={{ flexDirection:'row', alignItems:'center' }}>
                      <Text style={{ fontSize:20, marginRight:8 }}>⏱️</Text>
                      <View>
                        <Text style={{ fontSize:11, fontWeight:'700', color:'#fff' }}>{pct}% to {nm}m</Text>
                        <Text style={{ fontSize:9, color:'#E3F2FD', marginTop:2 }}>Almost there!</Text>
                      </View>
                    </View>
                  </ShimmerCard>
                );
              }
              
              return (
                <View key="minutes" style={[styles.badgePill, { flex:1, minWidth:150 }]}>
                  <Text style={styles.badgeEmoji}>⏱️</Text>
                  <Text style={styles.badgeText}>{pct}% to {nm}m</Text>
                </View>
              );
            }
            return null;
          })()}
          {(() => {
            const ns = nextStreakThreshold(aggStats.streak||0);
            if(ns){
              const pct = progressTowards(ns, aggStats.streak||0);
              const isClose = pct >= 80;
              
              if (isClose) {
                return (
                  <ShimmerCard 
                    key="streak"
                    colors={['#FF7043', '#F4511E', '#E64A19']} 
                    style={{ flex:1, minWidth:150, paddingHorizontal:14, paddingVertical:10, borderRadius:16 }}
                    shimmerSpeed={2500}
                  >
                    <View style={{ flexDirection:'row', alignItems:'center' }}>
                      <Text style={{ fontSize:20, marginRight:8 }}>🔥</Text>
                      <View>
                        <Text style={{ fontSize:11, fontWeight:'700', color:'#fff' }}>{pct}% to {ns}-day</Text>
                        <Text style={{ fontSize:9, color:'#FFE0B2', marginTop:2 }}>Keep it up!</Text>
                      </View>
                    </View>
                  </ShimmerCard>
                );
              }
              
              return (
                <View key="streak" style={[styles.badgePill, { flex:1, minWidth:150 }]}>
                  <Text style={styles.badgeEmoji}>🔥</Text>
                  <Text style={styles.badgeText}>{pct}% to {ns}-day</Text>
                </View>
              );
            }
            return null;
          })()}
        </View>
        <View style={styles.secondaryList}>
          <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed]} onPress={()=> navigate('/achievements')} accessibilityLabel="Open achievements" accessibilityRole='button'>
            <Ionicons name='trophy-outline' size={26} color={theme.primary} />
            <Text style={[styles.gridLabel,{ color: theme.text }]}>Achievements</Text>
          </Pressable>
        </View>
        <View style={{ height: spacing.xl * 2 }} />
        </ScrollView>
        {showToast && (
          <View style={[styles.toast,{ backgroundColor: theme.card }]}> 
            <Ionicons name='checkmark-circle-outline' size={18} color={theme.primary} />
            <Text style={[styles.toastText,{ color: theme.text }]}>Updated</Text>
          </View>
        )}
        
        {/* Floating Action Button for Quick Mood Logging */}
        <FloatingActionButton
          icon="add-circle"
          onPress={() => navigate('/moodTracker', 'heavy')}
          colors={['#4FC3F7', '#0288D1']}
          position="bottom-right"
          bottom={80}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}
const styles = StyleSheet.create({
  container:{ flex:1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  scrollContent:{ paddingBottom: spacing.xxl ?? 96 },
  pullAnimWrap:{ position:'absolute', top:-10, left:0, right:0, alignItems:'center', height:80 },
  pullAnim:{ width:80, height:80, opacity:0.9 },
  toast:{ position:'absolute', bottom:28, alignSelf:'center', flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:10, borderRadius:20, gap:8, shadowColor:'#000', shadowOpacity:0.15, shadowRadius:8, shadowOffset:{ width:0, height:3 }, elevation:4 },
  toastText:{ fontSize:13, fontWeight:'700' },
  header:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: spacing.lg },
  avatarSmall:{ width:34, height:34, borderRadius:17, backgroundColor:'#BBDEFB' },
  greetWrap:{ marginBottom: spacing.md },
  greetText:{ fontSize:24, fontWeight:'800' },
  tagline:{ fontSize:14, fontWeight:'600', opacity:0.85 },
  
  // Hero Card
  heroCard: {
    marginBottom: spacing.lg,
    padding: 24,
    shadowColor: '#0288D1',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  heroQuote: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: 0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroAuthor: {
    color: '#B3E5FC',
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 24,
  },
  progressSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  progressItem: {
    alignItems: 'center',
  },
  progressLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  progressValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  progressUnit: {
    color: '#E1F5FE',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  
  // Gradient Buttons
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    shadowColor: '#0288D1',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  gradientButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  snapshotCard:{ padding: spacing.md, borderRadius:18, marginBottom: spacing.lg, position:'relative' },
  sectionLabel:{ fontSize:11, fontWeight:'700', letterSpacing:1, marginBottom:6, opacity:0.8 },
  loadingRow:{ flexDirection:'row', alignItems:'center' },
  loadingTxt:{ marginLeft:8, fontSize:12, fontWeight:'600' },
  snapshotRow:{ flexDirection:'row', alignItems:'center', marginBottom:6 },
  snapshotText:{ marginLeft:8, fontSize:13, fontWeight:'600', flex:1 },
  snapshotTextMain:{ fontSize:14, fontWeight:'700' },
  snapshotSub:{ fontSize:11, fontWeight:'600', marginTop:2 },
  linkBtn:{ marginLeft:8, paddingHorizontal:10, paddingVertical:4, backgroundColor:'#E3F2FD', borderRadius:14 },
  linkBtnTxt:{ fontSize:11, fontWeight:'700', color:'#0277BD', letterSpacing:0.5 },
  moodEmoji:{ fontSize:30, marginRight:12 },
  emptyWrap:{ alignItems:'center', paddingVertical:6 },
  emptyEmoji:{ fontSize:40, marginBottom:4 },
  emptyTitle:{ fontSize:16, fontWeight:'800', marginBottom:2 },
  emptyDesc:{ fontSize:12, fontWeight:'600', textAlign:'center', marginBottom:10, paddingHorizontal:12 },
  badgesRow:{ flexDirection:'row', flexWrap:'wrap', gap:6, padding:8, borderRadius:12, marginBottom: spacing.md },
  badgePill:{ flexDirection:'row', alignItems:'center', backgroundColor:'#E3F2FD', paddingHorizontal:10, paddingVertical:6, borderRadius:16 },
  badgeEmoji:{ fontSize:16, marginRight:6 },
  badgeText:{ fontSize:11, fontWeight:'700', color:'#0277BD' },
  linkBtnLarge:{ flexDirection:'row', alignItems:'center', backgroundColor:'#E3F2FD', paddingHorizontal:14, paddingVertical:8, borderRadius:18, gap:6 },
  linkBtnLargeTxt:{ fontSize:13, fontWeight:'700', color:'#0277BD' },
  primaryCtaWrap:{ marginBottom: spacing.lg },
  quickGrid:{ flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between', marginBottom: spacing.lg },
  gridCard:{ width:'48%', backgroundColor:'#ffffffCC', borderRadius:16, paddingVertical:18, alignItems:'center', marginBottom: spacing.md, ...shadow.card },
  gridPressed:{ opacity:0.6, transform:[{ scale:0.98 }] },
  gridLabel:{ marginTop:8, fontSize:13, fontWeight:'700' },
  secondaryList:{ marginBottom: spacing.lg },
  waveAccent:{},
  title:{},
  subtitle:{}
});
