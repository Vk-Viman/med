import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Pressable, ScrollView, RefreshControl, Animated, AccessibilityInfo, InteractionManager, findNodeHandle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { useFocusEffect } from 'expo-router';

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
    } catch {}
    try {
      const s = await getMoodSummary({ streakLookbackDays:14 });
      setSummary(s);
      // Award streak badges opportunistically
      const uid = auth.currentUser?.uid; if(uid && s.streak){ try { await evaluateStreakBadges(uid, s.streak); } catch {} }
    } catch {}
    // Load recent badges for display
    try { const uid = auth.currentUser?.uid; if(uid){ const rec = await listUserBadges(uid, 6); setBadges(rec); } } catch {}
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
    } catch { setTrendText(''); }
    if(opts.showSpinner) setLoading(false);
    return () => { mounted = false; };
  };

  useEffect(()=>{ 
    loadData(); 
    let unsub;
    (async()=>{ try { setCfg(await getAdminConfig()); } catch {} ; try { unsub = subscribeAdminConfig(setCfg); } catch {} })();
    return ()=>{ try{ unsub && unsub(); }catch{} };
  },[]);

  const triggerToast = () => {
    setShowToast(true);
    setTimeout(()=> setShowToast(false), 1800);
  };

  const onRefresh = async () => {
    if(refreshing) return;
    setRefreshing(true);
    impact('medium');
    await loadData({ showSpinner:false });
    setRefreshing(false);
    triggerToast();
  };

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

  const moodEmoji = (m) => {
    if(m == null) return '🌀';
      // textual categories support
      if(typeof m === 'string'){
        const t = m.toLowerCase();
        if(t.includes('sad')) return '😢';
        if(t.includes('stress')) return '😣';
        if(t.includes('calm')) return '🙂';
        if(t.includes('happy')) return '😄';
        return '😐';
      }
      // numeric mood score fallback (0..10)
      if(m <= 2) return '😢';
      if(m <= 4) return '🙁';
      if(m <= 6) return '😐';
      if(m <= 8) return '🙂';
      return '😄';
  };
  const moodTint = (m) => {
    // Light mode soft pastels
    if(m == null) return '#E3F2FD';
    if(m <= 2) return '#FFEBEE';
    if(m <= 4) return '#FFF3E0';
    if(m <= 6) return '#EDEFF1';
    if(m <= 8) return '#E8F5E9';
    return '#E3F2FD';
  };
  const moodTintDark = (m) => {
    // Dark mode, deeper tints for contrast
    if(m == null) return '#0F2132';       // blue-ish
    if(m <= 2) return '#2A1A1A';          // red-ish
    if(m <= 4) return '#2A2316';          // orange-ish
    if(m <= 6) return '#1E2328';          // neutral
    if(m <= 8) return '#18271C';          // green-ish
    return '#0F2132';
  };
  // badgeEmoji helper centralized in src/badges

  const moodTextToScore = (val) => {
    if(!val) return null;
    const t = String(val).toLowerCase();
    if(t.includes('happy')) return 9;
    if(t.includes('calm')) return 8;
    if(t.includes('ok') || t.includes('neutral')) return 6;
    if(t.includes('stres')) return 4;
    if(t.includes('sad')) return 2;
    return 5; // default mid
  };
  const latestMoodLabel = () => {
    if(!summary.latest) return 'Log your first mood to start tracking';
    const dt = summary.latest.createdAt ? summary.latest.createdAt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '';
      const m = summary.latest.mood;
      const s = summary.latest.stress;
      const mNum = typeof m === 'number' ? m : (typeof m === 'string' && !isNaN(parseFloat(m)) ? parseFloat(m) : null);
      const sNum = typeof s === 'number' ? s : (typeof s === 'string' && !isNaN(parseFloat(s)) ? parseFloat(s) : null);
      const moodPart = mNum != null ? `${Math.round(mNum)}/10 mood` : (m ? `${String(m)}` : 'Mood');
      const stressPart = sNum != null ? `${Math.round(sNum)}/10 stress` : (s ? `${String(s)} stress` : '');
      return `${moodPart}${stressPart? ' • '+stressPart:''}${dt? ' · '+dt:''}`;
  };

  const impact = async (style = 'light') => {
    try {
      const map = { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy };
      await Haptics.impactAsync(map[style] || Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };
  const navigate = async (path, h='light') => { await impact(h); router.push(path); };

  // Real-time subscription for last 7 days to auto-update INSIGHTS and streak/summary
  useEffect(()=>{
    const uid = auth.currentUser?.uid; if(!uid) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - 6);
    const startTs = Timestamp.fromDate(start);
    const qRef = query(collection(db, `users/${uid}/moods`), where('createdAt','>=', startTs), orderBy('createdAt','asc'));
    const unsub = onSnapshot(qRef, (snap)=>{
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

  <Text ref={todayHeaderRef} style={[styles.sectionLabel,{ color: theme.textMuted }]} accessibilityRole='header' accessibilityLabel='Today'>TODAY</Text>
  <Card style={[styles.snapshotCard, { backgroundColor: (mode === 'dark' ? moodTintDark(summary.latest?.mood) : moodTint(summary.latest?.mood)) }]}> 
          {loading ? (
            <View style={styles.loadingRow}><ActivityIndicator color={theme.primary} size="small" /><Text style={[styles.loadingTxt,{ color: theme.textMuted }]}> Loading summary...</Text></View>
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
                    <Text style={styles.moodEmoji}>{moodEmoji(summary.latest.mood)}</Text>
                    <View style={{ flex:1 }}>
                      <Text accessibilityLabel={`Latest: ${latestMoodLabel()}`} style={[styles.snapshotTextMain,{ color: theme.text }]}>{latestMoodLabel()}</Text>
                      <Text style={[styles.snapshotSub,{ color: theme.textMuted }]}>Keep consistent logging for better insights</Text>
                    </View>
                    <TouchableOpacity style={[styles.linkBtn,{ backgroundColor: theme.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD' }]} onPress={()=> navigate('/moodTracker','medium')} accessibilityLabel="Log another mood entry">
                      <Text style={[styles.linkBtnTxt,{ color: mode==='dark' ? '#E3F2FD' : '#0277BD' }]} >Log</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.snapshotRow}>
                    <Ionicons name="flame-outline" size={20} color={summary.streak>0? '#FF7043': theme.textMuted} />
                    <Text accessibilityLabel={summary.streak>0? `${summary.streak} day streak` : 'No streak yet'} style={[styles.snapshotText, { color: theme.text }]}>{summary.streak>0? `${summary.streak}-day streak` : 'No streak yet'}</Text>
                  </View>
                </>
              )}
            </>
          )}
        </Card>

        <View style={styles.primaryCtaWrap}>
          <Text style={[styles.sectionLabel,{ color: theme.textMuted }]}>FOCUS</Text>
          <View style={{ flexDirection:'row', gap:12 }}>
            <PrimaryButton title="Start Meditation" onPress={()=> navigate('/meditation','medium')} left={<Ionicons name='play-circle' size={18} color='#fff' />} />
            <PrimaryButton title="Sessions" onPress={()=> navigate('/sessions','light')} left={<Ionicons name='time-outline' size={18} color='#fff' />} />
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

  <Text style={[styles.sectionLabel,{ color: theme.textMuted }]} accessibilityRole='header' accessibilityLabel='Tools'>TOOLS</Text>
        {!!badges.length && (
          <View style={[styles.badgesRow, { backgroundColor: theme.card }]}>
            {badges.map(b => (
              <View key={b.id} style={styles.badgePill}>
                <Text style={styles.badgeEmoji}>{badgeEmoji(b.id)}</Text>
                <Text style={styles.badgeText}>{b.name || b.id}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.secondaryList}>
          <PrimaryButton accessibilityLabel='Open achievements' title="Achievements" onPress={()=> navigate('/achievements')} variant='secondary' fullWidth left={<Ionicons name='trophy-outline' size={18} color='#01579B' />} />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton title="Reminders" onPress={()=> navigate('/notifications')} variant='secondary' fullWidth left={<Ionicons name='notifications-outline' size={18} color='#01579B' />} />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton title="Biometric Login" onPress={()=> navigate('/biometricLogin')} variant='secondary' fullWidth left={<Ionicons name='finger-print-outline' size={18} color='#01579B' />} />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton title="Settings" onPress={()=> navigate('/settings')} variant='secondary' fullWidth left={<Ionicons name='settings-outline' size={18} color='#01579B' />} />
        </View>
        <View style={{ height: spacing.xl * 2 }} />
        </ScrollView>
        {showToast && (
          <View style={[styles.toast,{ backgroundColor: theme.card }]}> 
            <Ionicons name='checkmark-circle-outline' size={18} color={theme.primary} />
            <Text style={[styles.toastText,{ color: theme.text }]}>Updated</Text>
          </View>
        )}
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
