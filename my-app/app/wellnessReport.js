import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, RefreshControl, Switch, Animated, Platform, AccessibilityInfo, InteractionManager, findNodeHandle } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import GradientBackground from "../src/components/GradientBackground";
import { db, auth } from "../firebase/firebaseConfig";
import { collection, query, orderBy, getDocs } from "firebase/firestore"; // legacy direct fetch kept for chart initial version
import { LineChart, PieChart, BarChart } from "react-native-chart-kit";
import CryptoJS from "crypto-js"; // retained (may be used elsewhere / future)
import { listMoodEntriesPage, listMoodEntriesSince, listMoodEntriesBetween, decryptEntry, updateMoodEntry, deleteMoodEntry, flushQueue, getChartDataSince, getChartDataBetween } from "../src/services/moodEntries";
import DateTimePicker from '@react-native-community/datetimepicker';
import { Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import MarkdownPreview from "../src/components/MarkdownPreview";
import { Dimensions } from "react-native";
import Card from "../src/components/Card";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter, useFocusEffect } from "expo-router";
import { ensureWeeklyDigestSummary } from '../src/services/weeklyDigest';
import { Ionicons } from "@expo/vector-icons";
import GradientCard from "../src/components/GradientCard";
import ProgressRing from "../src/components/ProgressRing";
import ShimmerCard from "../src/components/ShimmerCard";
import SkeletonLoader from "../src/components/SkeletonLoader";

const BIOMETRIC_PREF_KEY = 'pref_biometric_enabled_v1';

const pieColors = ['#42A5F5','#66BB6A','#FFA726','#AB47BC','#EC407A','#FF7043'];

export default function WellnessReport() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [chartsInteractive, setChartsInteractive] = useState(false);
  const [pageCursor, setPageCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editMood, setEditMood] = useState("");
  const [editStress, setEditStress] = useState(0);
  const [editNote, setEditNote] = useState("");
  const [showEditPreview, setShowEditPreview] = useState(false);
  const [timeframe, setTimeframe] = useState(7); // 7 / 30 / 90
  const [tfEntries, setTfEntries] = useState([]); // entries for charts/stats (already decrypted)
  const [tfLoading, setTfLoading] = useState(true);
  const [moodFilter, setMoodFilter] = useState(null); // drill-down mood
  const [customRange, setCustomRange] = useState(null); // { start:Date, end:Date }
  const [rangeModal, setRangeModal] = useState(false);
  const [rangePicking, setRangePicking] = useState('start'); // 'start' or 'end'
  const [autoExtendedMsg, setAutoExtendedMsg] = useState('');
  const expandAttemptRef = useRef(0);
  const chartFade = useRef(new Animated.Value(1)).current;
  const pieAnim = useRef(new Animated.Value(1)).current;
  const pointAnimValues = useRef([]); // Animated.Value[] for each point
  const pointListeners = useRef([]); // store subscriptions for cleanup
  const [animatedChartData, setAnimatedChartData] = useState(null); // progressive dataset
  const router = useRouter();
  const listRef = useRef(null);
  const headerRef = useRef(null);

  // Biometric gate on enter (if enabled)
  useEffect(()=>{ (async()=>{
    try {
      const pref = await AsyncStorage.getItem(BIOMETRIC_PREF_KEY);
      const enabled = pref === '1';
      if(!enabled){ setUnlocked(true); return; }
      if(Platform.OS === 'web'){ setUnlocked(true); return; }
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if(!hasHardware || !enrolled){ setUnlocked(true); return; }
      const res = await LocalAuthentication.authenticateAsync({ promptMessage:'Unlock wellness report' });
      if(res.success){ setUnlocked(true); } else { Alert.alert('Locked','Biometric authentication canceled.'); try { router.back(); } catch {} }
    } catch { setUnlocked(true); }
  })(); },[]);
  const loadPage = async (reset=false) => {
    const uid = auth.currentUser?.uid; if(!uid) return;
    if(reset){ setLoading(true); }
    try{
      const { docs, last } = await listMoodEntriesPage({ pageSize:20, after: reset? null : pageCursor });
      const decrypted = [];
      for(const d of docs){
        const base = { ...d.data(), id: d.id };
        const full = await decryptEntry(uid, base);
        decrypted.push(full);
      }
      setEntries(prev => reset? decrypted : [...prev, ...decrypted]);
      setPageCursor(last);
    }catch(e){
      Alert.alert('Error', e.message);
    } finally {
      if(reset) setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { if(unlocked){ flushQueue(); loadPage(true); } }, [unlocked]);
  // Run weekly digest summary check when report gains focus (after unlock)
  useFocusEffect(React.useCallback(()=>{ if(unlocked){ ensureWeeklyDigestSummary().catch(()=>{}); } }, [unlocked]));
  // Announce on unlock
  useWellnessA11yAnnounce(unlocked, headerRef);

  // Load persisted timeframe on mount
  useEffect(()=>{ (async()=>{ try{ const stored = await AsyncStorage.getItem('report_timeframe'); if(stored) setTimeframe(Number(stored)); const cStart = await AsyncStorage.getItem('report_range_start'); const cEnd = await AsyncStorage.getItem('report_range_end'); if(cStart && cEnd){ setCustomRange({ start:new Date(cStart), end:new Date(cEnd) }); } }catch{} })(); },[]);

  // Load timeframe specific entries when timeframe changes
  const loadRangeData = async () => {
  const uid = auth.currentUser?.uid; if(!uid || !unlocked) return;
    setTfLoading(true);
    try {
      chartFade.setValue(0); pieAnim.setValue(0);
      // Use cached chart-friendly rows (no note decryption needed here)
      let rows;
      if(customRange){
        rows = await getChartDataBetween({ startDate: customRange.start, endDate: customRange.end });
      } else {
        try { await AsyncStorage.setItem('report_timeframe', String(timeframe)); } catch{}
        rows = await getChartDataSince({ days: timeframe });
      }
      // Normalize to the shape used by charts below to avoid larger refactors
      const normalized = rows.filter(r => r.createdAtSec).map(r => ({
        createdAt: { seconds: r.createdAtSec },
        mood: r.mood,
        moodScore: r.moodScore,
        stress: r.stress,
      }));
      setTfEntries(normalized);

      // Auto-extend timeframe if too few points and not using custom range
      if(!customRange && normalized.length <= 1) {
        if(timeframe === 7 && expandAttemptRef.current === 0){
          expandAttemptRef.current = 1;
          setAutoExtendedMsg('Not enough data in 7 days. Showing last 30 days.');
          setTimeframe(30);
          setTfLoading(false);
          return; // wait for next effect
        }
        if(timeframe === 30 && expandAttemptRef.current === 1){
          expandAttemptRef.current = 2;
          setAutoExtendedMsg('Not enough data in 30 days. Showing last 90 days.');
          setTimeframe(90);
          setTfLoading(false);
          return;
        }
      } else {
        // Reset attempt when we have sufficient data or using custom
        expandAttemptRef.current = 0;
        setAutoExtendedMsg('');
      }
    } catch(e){}
    setTfLoading(false);
    Animated.parallel([
      Animated.timing(chartFade,{ toValue:1, duration:260, useNativeDriver:true }),
      Animated.spring(pieAnim,{ toValue:1, useNativeDriver:true, friction:6 })
    ]).start();
  };

  useEffect(()=>{ if(unlocked) loadRangeData(); }, [timeframe, customRange, unlocked]);

  const onRefresh = () => { setRefreshing(true); setPageCursor(null); loadPage(true); };

  const loadMore = () => {
    if(loadingMore || !pageCursor) return;
    setLoadingMore(true);
    loadPage(false);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setEditMood(item.mood);
    setEditStress(item.stress);
    setEditNote(item.note);
    setEditModal(true);
  };

  const saveEdit = async () => {
    try{
      await updateMoodEntry(editItem.id, { mood: editMood, stress: editStress, note: editNote });
      await flushQueue();
      setEntries(list => list.map(e => e.id === editItem.id ? { ...e, mood: editMood, stress: editStress, note: editNote } : e));
      setEditModal(false);
    }catch(e){ Alert.alert('Error', e.message); }
  };

  const confirmDelete = (item) => {
    Alert.alert('Delete Entry', 'Are you sure?', [
      { text: 'Cancel', style:'cancel' },
      { text: 'Delete', style:'destructive', onPress: () => performDelete(item) }
    ]);
  };

  const performDelete = async (item) => {
    try{
      await deleteMoodEntry(item.id); await flushQueue();
      setEntries(list => list.filter(e => e.id !== item.id));
    }catch(e){ Alert.alert('Error', e.message); }
  };

  // Build chart data from timeframe entries
  const filteredTf = moodFilter ? tfEntries.filter(e=>e.mood===moodFilter) : tfEntries;
  const chartBase = filteredTf.filter(e => e.createdAt?.seconds).map(e => {
    const date = new Date(e.createdAt.seconds * 1000);
    const raw = (typeof e.stress === 'string') ? parseFloat(e.stress) : e.stress;
    const stress = Number.isFinite(raw) ? raw : 0;
    return { date, stress };
  });
  // dynamic label thinning
  const labelEvery = chartBase.length > 10 ? Math.ceil(chartBase.length / 7) : 1;
  const fullChartData = {
    labels: chartBase.map((p,i)=> i % labelEvery === 0 ? `${p.date.getDate()}/${p.date.getMonth()+1}`: ''),
    datasets: [{ data: chartBase.map(p=>p.stress) }]
  };

  // Helper to rebuild animated dataset from current animated values
  const rebuildAnimatedDataset = () => {
    if(!chartBase.length || !pointAnimValues.current.length) return;
    const data = chartBase.map((p,i)=> {
      const v = pointAnimValues.current[i];
      const prog = v ? v.__getValue() : 0; // internal access acceptable here
      return Number((p.stress * prog).toFixed(3));
    });
    setAnimatedChartData({ labels: fullChartData.labels, datasets:[{ data }] });
  };

  // Initialize & animate per-point values whenever chartBase length changes
  useEffect(()=>{
    // cleanup previous listeners
    pointListeners.current.forEach(unsub => typeof unsub === 'function' && unsub());
    pointListeners.current = [];
    pointAnimValues.current = chartBase.map(()=> new Animated.Value(0));
    // initial dataset (tiny values to avoid flat-line width issues)
    if(chartBase.length){
      setAnimatedChartData({ labels: fullChartData.labels, datasets:[{ data: chartBase.map(()=>0.0001) }] });
      // attach listeners to rebuild progressively
      pointAnimValues.current.forEach(()=> rebuildAnimatedDataset()); // ensure at least one build
      pointAnimValues.current.forEach(v => {
        const id = v.addListener(()=> rebuildAnimatedDataset());
        pointListeners.current.push(()=> v.removeListener(id));
      });
      // start staggered animation
      Animated.stagger(40, pointAnimValues.current.map(v=> Animated.timing(v,{ toValue:1, duration:350, useNativeDriver:false }))).start();
    } else {
      setAnimatedChartData(null);
    }
    return ()=>{ pointListeners.current.forEach(unsub => typeof unsub === 'function' && unsub()); };
  }, [chartBase.length]);

  // Summary stats
  const avgNum = chartBase.length ? (chartBase.reduce((a,b)=>a+b.stress,0)/chartBase.length) : null;
  const avgStress = avgNum !== null ? avgNum.toFixed(1) : '-';
  const variance = avgNum !== null ? (chartBase.reduce((acc,p)=> acc + Math.pow(p.stress - avgNum, 2), 0) / chartBase.length) : null;
  const varianceStr = variance !== null ? variance.toFixed(2) : '-';
  const moodFreq = filteredTf.reduce((acc,e)=>{ acc[e.mood] = (acc[e.mood]||0)+1; return acc; }, {});
  const topMood = Object.keys(moodFreq).length ? Object.entries(moodFreq).sort((a,b)=>b[1]-a[1])[0] : null;
  // Streak: consecutive days using filtered set (respects mood filter)
  let streak = 0;
  if(chartBase.length){
    const daysSet = new Set(chartBase.map(p=> p.date.toDateString()));
    const today = new Date();
    const totalDays = customRange ? Math.ceil((customRange.end - customRange.start)/(86400000))+1 : timeframe;
    for(let i=0;i<totalDays;i++){
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()-i);
      // If custom range enforce boundary
      if(customRange){ if(d < new Date(customRange.start.getFullYear(),customRange.start.getMonth(),customRange.start.getDate())) break; }
      if(daysSet.has(d.toDateString())) streak++; else break;
    }
  }

  // Median / Min / Max
  let median = '-'; let minStress='-'; let maxStress='-';
  if(chartBase.length){
    const values = chartBase.map(p=>p.stress).sort((a,b)=>a-b);
    const mid = Math.floor(values.length/2);
    median = values.length %2 ? values[mid] : ((values[mid-1]+values[mid])/2).toFixed(1);
    minStress = Math.min(...values);
    maxStress = Math.max(...values);
  }

  // Time-of-day pattern: average stress by 4 buckets
  const todBuckets = { Night:{sum:0,count:0}, Morning:{sum:0,count:0}, Afternoon:{sum:0,count:0}, Evening:{sum:0,count:0} };
  chartBase.forEach(p=>{
    const h = p.date.getHours();
    let k = 'Night';
    if(h>=6 && h<12) k='Morning'; else if(h>=12 && h<18) k='Afternoon'; else if(h>=18 && h<24) k='Evening';
    todBuckets[k].sum += p.stress; todBuckets[k].count += 1;
  });
  const todLabels = ['Night','Morning','Afternoon','Evening'];
  const todValues = todLabels.map(k=> todBuckets[k].count ? Number((todBuckets[k].sum/todBuckets[k].count).toFixed(2)) : 0);

  // Weekly pattern (Sun..Sat)
  const weekdayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const weekdaySums = Array(7).fill(0);
  const weekdayCounts = Array(7).fill(0);
  chartBase.forEach(p=>{ const d = p.date.getDay(); weekdaySums[d]+=p.stress; weekdayCounts[d]++; });
  const weekdayAvg = weekdaySums.map((s,i)=> weekdayCounts[i] ? Number((s/weekdayCounts[i]).toFixed(2)) : 0);

  // Hourly heatmap (0-23)
  const hourSums = Array(24).fill(0);
  const hourCounts = Array(24).fill(0);
  chartBase.forEach(p=>{ const h = p.date.getHours(); hourSums[h]+=p.stress; hourCounts[h]++; });
  const hourAvg = hourSums.map((s,i)=> hourCounts[i] ? Number((s/hourCounts[i]).toFixed(2)) : 0);
  const hourMin = hourAvg.filter(v=>v>0).length ? Math.min(...hourAvg.filter(v=>v>0)) : 0;
  const hourMax = Math.max(...hourAvg);

  const colorForValue = (v) => {
    if(hourMax === 0) return '#E3F2FD';
    const ratio = (v - hourMin) / Math.max(1e-6,(hourMax - hourMin)); // 0..1
    // interpolate between light blue and primary
    const lerp = (a,b,t)=> Math.round(a + (b-a)*t);
    const start = { r: 227, g: 242, b: 253 }; // #E3F2FD
    const end   = { r:   2, g: 136, b: 209 }; // #0288D1
    const r = lerp(start.r, end.r, ratio);
    const g = lerp(start.g, end.g, ratio);
    const b = lerp(start.b, end.b, ratio);
    return `rgb(${r},${g},${b})`;
  };

  const ListHeader = () => (
    <View>
      {/* Professional Header */}
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="heart" size={28} color="#EC407A" />
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text ref={headerRef} style={styles.heading} accessibilityRole='header' accessibilityLabel='Wellness Report'>Wellness Report</Text>
          <Text style={styles.subtitle}>Your mental health insights</Text>
        </View>
      </View>
      
      <View style={styles.timeframeRow}>
        {[7,30,90].map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.timeBtn, !customRange && timeframe===d && styles.timeBtnActive]}
            onPress={()=>{ setCustomRange(null); setTimeframe(d); }}
            disabled={tfLoading}
            accessibilityRole="button"
            accessibilityLabel={`${d} day window`}
            accessibilityState={{ selected: !customRange && timeframe===d, disabled: tfLoading }}
            hitSlop={{ top:8, bottom:8, left:8, right:8 }}
          >
            <Text style={[styles.timeBtnText, !customRange && timeframe===d && styles.timeBtnTextActive]}>{d}D</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.timeBtn, customRange && styles.timeBtnActive]}
          onPress={()=>{ setRangePicking('start'); setRangeModal(true); }}
          accessibilityRole="button"
          accessibilityLabel="Custom date range"
          accessibilityState={{ selected: !!customRange }}
          hitSlop={{ top:8, bottom:8, left:8, right:8 }}
        >
          <Text style={[styles.timeBtnText, customRange && styles.timeBtnTextActive]}>Custom</Text>
        </TouchableOpacity>
        {customRange && (
          <TouchableOpacity
            style={[styles.timeBtn,{ backgroundColor:'#F44336'}]}
            onPress={()=>setCustomRange(null)}
            accessibilityRole="button"
            accessibilityLabel="Clear date range"
            hitSlop={{ top:8, bottom:8, left:8, right:8 }}
          >
            <Text style={[styles.timeBtnText,{ color:'#fff'}]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      {customRange && (
        <Text style={styles.rangeLabel}>{customRange.start.toLocaleDateString()} → {customRange.end.toLocaleDateString()}</Text>
      )}
      {moodFilter && (
        <View style={styles.filterChipRow}>
          <TouchableOpacity
            style={styles.filterChip}
            onPress={()=>setMoodFilter(null)}
            accessibilityRole="button"
            accessibilityLabel={`Clear mood filter ${moodFilter}`}
            hitSlop={{ top:8, bottom:8, left:8, right:8 }}
          >
            <Text style={styles.filterChipText}>Filter: {moodFilter} ✕</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Health Metric Card */}
      {tfEntries.length > 0 && (
        <GradientCard colors={['#EC407A', '#D81B60', '#AD1457']} style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ProgressRing
              size={90}
              progress={Math.max(0, 100 - (avgStress / 10) * 100)}
              strokeWidth={10}
              color="#FFFFFF"
              backgroundColor="rgba(255,255,255,0.3)"
            />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={styles.healthMetricValue}>{(10 - avgStress).toFixed(1)}</Text>
              <Text style={styles.healthMetricLabel}>Wellness Score</Text>
              <Text style={styles.healthMetricSubtext}>Based on {tfEntries.length} entries</Text>
            </View>
          </View>
        </GradientCard>
      )}
      
      {tfEntries.length > 0 ? (
        <Card>
          {/* Chart interaction toggle: keep charts non-interactive for smooth scroll by default */}
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'flex-end', marginBottom:6 }}>
            <Text style={[styles.statLabel,{ marginRight:8 }]}>Chart Touch</Text>
            <Switch value={chartsInteractive} onValueChange={setChartsInteractive} accessibilityLabel="Toggle chart touch interactions" />
          </View>
          <View style={{ flexDirection:'row', flexWrap:'wrap', marginBottom:6, alignItems:'center' }}>
            <View style={styles.statBlock}><Text style={styles.statLabel}>Avg</Text><Text style={styles.statValue}>{avgStress}</Text></View>
            <View style={styles.statBlock}><Text style={styles.statLabel}>Variance</Text><Text style={styles.statValue}>{varianceStr}</Text></View>
            <View style={styles.statBlock}><Text style={styles.statLabel}>Median</Text><Text style={styles.statValue}>{median}</Text></View>
            <View style={styles.statBlock}><Text style={styles.statLabel}>Min–Max</Text><Text style={styles.statValue}>{minStress}-{maxStress}</Text></View>
            <View style={styles.statBlock}><Text style={styles.statLabel}>{moodFilter? 'Streak (Mood)':'Streak'}</Text><Text style={styles.statValue}>{streak}d</Text></View>
            <View style={styles.statBlock}><Text style={styles.statLabel}>Top Mood</Text><Text style={styles.statValue}>{topMood? `${topMood[0]}(${topMood[1]})`:'-'}</Text></View>
            <TouchableOpacity
              style={[styles.shareBtn]}
              onPress={()=>{
              const header = customRange ? `Custom Range ${customRange.start.toLocaleDateString()} - ${customRange.end.toLocaleDateString()}` : `${timeframe} Day Window`;
              const freqLines = Object.entries(moodFreq).sort((a,b)=>b[1]-a[1]).map(([m,c])=>`- ${m}: ${c}`).join('\n');
              const todLines = todLabels.map((l,i)=> `- ${l}: ${todValues[i]}`).join('\n');
              const wLines = weekdayLabels.map((l,i)=> `- ${l}: ${weekdayAvg[i]}`).join('\n');
              const md = `**Wellness Stats**\n${header}\n\n**Avg:** ${avgStress}\n**Variance:** ${varianceStr}\n**Median:** ${median}\n**Min–Max:** ${minStress}-${maxStress}\n**Streak${moodFilter?' (Mood)':''}:** ${streak}d\n**Top Mood:** ${topMood? topMood[0]+' '+topMood[1]: '-'}\n\n**Mood Frequency**\n${freqLines}\n\n**Avg Stress by Time of Day**\n${todLines}\n\n**Avg Stress by Weekday**\n${wLines}`;
              Share.share({ message: md });
              }}
              accessibilityRole="button"
              accessibilityLabel="Share wellness stats"
              hitSlop={{ top:8, bottom:8, left:8, right:8 }}
            >
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.shareBtn,{ backgroundColor:'#6D4C41', marginLeft:8 }]}
              onPress={async ()=>{
                try{
                  const header = customRange ? `${customRange.start.toLocaleDateString()} - ${customRange.end.toLocaleDateString()}` : `${timeframe} Day Window`;
                  const entriesRows = filteredTf.filter(e=>e.createdAt?.seconds).map(e=>{
                    const d = new Date(e.createdAt.seconds*1000);
                    const stressNum = typeof e.stress === 'string' ? parseFloat(e.stress) : e.stress;
                    return { date: d.toLocaleString(), mood: e.mood||'', stress: Number.isFinite(stressNum)? stressNum : '' };
                  });
                  const freqRows = Object.entries(moodFreq).sort((a,b)=>b[1]-a[1]).map(([m,c])=> `<tr><td>${m}</td><td>${c}</td></tr>`).join('');
                  const todRows = todLabels.map((l,i)=> `<tr><td>${l}</td><td>${todValues[i]}</td></tr>`).join('');
                  const weekdayRows = weekdayLabels.map((l,i)=> `<tr><td>${l}</td><td>${weekdayAvg[i]}</td></tr>`).join('');
                  const entryRowsHtml = entriesRows.map(r=> `<tr><td>${r.date}</td><td>${r.mood}</td><td>${r.stress}</td></tr>`).join('');
                  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
                    body{font-family:Arial,Helvetica,sans-serif; padding:16px; color:#0B1722}
                    h1{color:#01579B; margin:0 0 8px}
                    h2{color:#0277BD; margin:16px 0 8px; font-size:16px}
                    .pill{display:inline-block; background:#E1F5FE; color:#01579B; padding:6px 10px; border-radius:16px; margin-right:8px; font-weight:600; font-size:12px}
                    table{border-collapse:collapse; width:100%;}
                    th,td{border:1px solid #E3F2FD; padding:6px 8px; font-size:12px}
                    th{background:#E1F5FE; text-align:left}
                  </style></head><body>
                    <h1>Wellness Report</h1>
                    <div class="pill">${header}</div>
                    <div class="pill">Avg ${avgStress}</div>
                    <div class="pill">Median ${median}</div>
                    <div class="pill">Variance ${varianceStr}</div>
                    <div class="pill">Min–Max ${minStress}-${maxStress}</div>
                    <div class="pill">Streak ${streak}d</div>
                    <h2>Mood Frequency</h2>
                    <table><thead><tr><th>Mood</th><th>Count</th></tr></thead><tbody>${freqRows || '<tr><td colspan="2">None</td></tr>'}</tbody></table>
                    <h2>Avg Stress by Time of Day</h2>
                    <table><thead><tr><th>Time</th><th>Avg Stress</th></tr></thead><tbody>${todRows}</tbody></table>
                    <h2>Avg Stress by Weekday</h2>
                    <table><thead><tr><th>Weekday</th><th>Avg Stress</th></tr></thead><tbody>${weekdayRows}</tbody></table>
                    <h2>Entries</h2>
                    <table><thead><tr><th>Date</th><th>Mood</th><th>Stress</th></tr></thead><tbody>${entryRowsHtml || '<tr><td colspan="3">No entries</td></tr>'}</tbody></table>
                  </body></html>`;
                  const { uri } = await Print.printToFileAsync({ html });
                  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Wellness Report PDF' });
                }catch(e){ Alert.alert('Error', e.message); }
              }}
              accessibilityRole="button"
              accessibilityLabel="Export PDF"
              hitSlop={{ top:8, bottom:8, left:8, right:8 }}
            >
              <Text style={styles.shareBtnText}>PDF</Text>
            </TouchableOpacity>
          </View>
          {autoExtendedMsg ? (
            <Text style={{ fontSize:12, color:'#01579B', marginBottom:6 }}>{autoExtendedMsg}</Text>
          ) : null}
          <Animated.View style={{ opacity: chartFade }}>
            {/* Disable touch handling on chart by default to allow vertical scroll */}
            <View
              pointerEvents={chartsInteractive ? 'auto' : 'none'}
              accessible
              accessibilityRole="image"
              accessibilityLabel="Stress trend line chart"
            >
              <LineChart
                data={animatedChartData || fullChartData}
                width={Dimensions.get("window").width - 32}
                height={180}
                chartConfig={{
                  backgroundColor: "transparent",
                  backgroundGradientFrom: "#FFFFFF",
                  backgroundGradientTo: "#FFFFFF",
                  color: (opacity = 1) => `rgba(2, 136, 209, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(1, 87, 155, ${opacity})`,
                  strokeWidth: 2,
                  propsForDots: { r: "4", strokeWidth: "2", stroke: "#0288D1" },
                }}
                bezier
                style={{ borderRadius: 12 }}
              />
            </View>
          </Animated.View>
          <View style={{ marginTop:12 }}>
            <Text style={[styles.statLabel,{ alignSelf:'flex-start', marginBottom:4 }]}>Avg Stress by Time of Day</Text>
            {/* Disable touch handling to ensure parent list scrolls when toggle off */}
            <View
              pointerEvents={chartsInteractive ? 'auto' : 'none'}
              accessible
              accessibilityRole="image"
              accessibilityLabel="Average stress by time of day bar chart"
            >
              <BarChart
                data={{ labels: todLabels, datasets:[{ data: todValues }] }}
                width={Dimensions.get("window").width - 32}
                height={160}
                fromZero
                chartConfig={{
                  backgroundColor: "transparent",
                  backgroundGradientFrom: "#FFFFFF",
                  backgroundGradientTo: "#FFFFFF",
                  decimalPlaces: 1,
                  color: (opacity=1)=> `rgba(2, 136, 209, ${opacity})`,
                  labelColor: (opacity=1)=> `rgba(1, 87, 155, ${opacity})`,
                  propsForBackgroundLines:{ stroke:'#E3F2FD' }
                }}
                style={{ borderRadius: 12 }}
              />
            </View>
          </View>
          {/* Weekly pattern */}
          <View style={{ marginTop:12 }}>
            <Text style={[styles.statLabel,{ alignSelf:'flex-start', marginBottom:4 }]}>Avg Stress by Weekday</Text>
            {/* Disable touch handling to ensure parent list scrolls when toggle off */}
            <View
              pointerEvents={chartsInteractive ? 'auto' : 'none'}
              accessible
              accessibilityRole="image"
              accessibilityLabel="Average stress by weekday bar chart"
            >
              <BarChart
                data={{ labels: weekdayLabels, datasets:[{ data: weekdayAvg }] }}
                width={Dimensions.get("window").width - 32}
                height={160}
                fromZero
                chartConfig={{
                  backgroundColor: "transparent",
                  backgroundGradientFrom: "#FFFFFF",
                  backgroundGradientTo: "#FFFFFF",
                  decimalPlaces: 1,
                  color: (opacity=1)=> `rgba(2, 136, 209, ${opacity})`,
                  labelColor: (opacity=1)=> `rgba(1, 87, 155, ${opacity})`,
                  propsForBackgroundLines:{ stroke:'#E3F2FD' }
                }}
                style={{ borderRadius: 12 }}
              />
            </View>
          </View>

          {/* Hourly heatmap */}
          <View style={{ marginTop:12 }}>
            <Text style={[styles.statLabel,{ alignSelf:'flex-start', marginBottom:8 }]}>Hourly Heatmap (Avg Stress)</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
              {hourAvg.map((v,i)=> (
                <View key={i} style={{ width:(Dimensions.get("window").width - 32 - (5*6))/6, aspectRatio:1, borderRadius:8, backgroundColor: colorForValue(v), alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ fontSize:10, color:'#0B1722' }}>{i}</Text>
                </View>
              ))}
            </View>
          </View>

          {Object.keys(moodFreq).length > 0 && (
            <Animated.View style={{ marginTop:12, alignItems:'center', transform:[{ scale: pieAnim.interpolate({ inputRange:[0,1], outputRange:[0.85,1] }) }], opacity: pieAnim }}>
              <Text style={[styles.statLabel,{ alignSelf:'flex-start', marginBottom:4 }]}>Mood Distribution</Text>
              {/* Disable pointer events unless interactions are enabled */}
              <View
                pointerEvents={chartsInteractive ? 'auto' : 'none'}
                accessible
                accessibilityRole="image"
                accessibilityLabel="Mood distribution pie chart"
              >
                <PieChart
                  data={Object.entries(moodFreq).map(([m,c],i)=>({
                    name:m,
                    population:c,
                    color: pieColors[i % pieColors.length],
                    legendFontColor:'#01579B',
                    legendFontSize:12,
                    onPress: ()=> setMoodFilter(prev => prev === m ? null : m)
                  }))}
                  width={Dimensions.get("window").width - 64}
                  height={180}
                  chartConfig={{ color:()=> '#0288D1' }}
                  accessor={'population'}
                  backgroundColor={'transparent'}
                  paddingLeft={'8'}
                  absolute
                />
              </View>
            </Animated.View>
          )}
        </Card>
  ) : <Text style={styles.label}>No data yet.</Text>}
      <Text style={styles.subheading}>Journal Entries</Text>
    </View>
  );

  return (
    <>
    <GradientBackground>
    <FlatList
      ref={listRef}
      style={styles.container}
      data={entries}
      keyExtractor={e => e.id}
      ListHeaderComponent={ListHeader}
      ListHeaderComponentStyle={{ paddingBottom: 16 }}
      renderItem={({ item }) => {
        const hasCipher = item.encVer === 2 && item.noteCipher;
        const showPlaceholder = hasCipher && (item.note === '' || typeof item.note === 'undefined');
        const createdStr = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleString() : '';
        return (
          <TouchableOpacity
            style={styles.entry}
            onPress={() => openEdit(item)}
            onLongPress={() => confirmDelete(item)}
            delayLongPress={500}
            accessibilityRole="button"
            accessibilityLabel={`Journal entry. Mood ${item.mood}. Stress ${item.stress}. ${createdStr ? `Created ${createdStr}.` : ''}`}
            accessibilityHint="Double tap to edit. Long press to delete."
            hitSlop={{ top:8, bottom:8, left:8, right:8 }}
          >
            <Text style={styles.mood}>{item.mood} | Stress: {item.stress} {item.legacy && <Text style={styles.legacy}>LEGACY</Text>}</Text>
            {item.note ? (
              <MarkdownPreview text={item.note} style={styles.note} />
            ) : showPlaceholder ? (
              <Text style={styles.notePlaceholder}>Encrypted note (empty or failed to decrypt)</Text>
            ) : null}
            <Text style={styles.date}>{createdStr}</Text>
          </TouchableOpacity>
        );
      }}
      onEndReached={loadMore}
      onEndReachedThreshold={0.2}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 96 }}
      nestedScrollEnabled
      scrollEnabled
      showsVerticalScrollIndicator
      scrollEventThrottle={16}
      onScroll={(e)=>{
        const y = e.nativeEvent.contentOffset?.y || 0;
        if(y > 400 && !showScrollTop) setShowScrollTop(true);
        else if(y <= 400 && showScrollTop) setShowScrollTop(false);
      }}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} /> : null}
  />
  {showScrollTop && (
    <TouchableOpacity
      onPress={()=> listRef.current?.scrollToOffset({ offset:0, animated:true })}
      activeOpacity={0.8}
      style={styles.scrollTopBtn}
      accessibilityRole="button"
      accessibilityLabel="Scroll to top"
      hitSlop={{ top:8, bottom:8, left:8, right:8 }}
    >
      <Text style={styles.scrollTopBtnText}>Top</Text>
    </TouchableOpacity>
  )}
  {loading && entries.length === 0 && (
    <View style={styles.loadingOverlay}><ActivityIndicator size="large" color="#0288D1" /></View>
  )}
  <Modal visible={editModal} transparent animationType="fade" onRequestClose={() => setEditModal(false)}>
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Edit Entry</Text>
        <Text style={styles.modalLabel}>Mood</Text>
        <TextInput value={editMood} onChangeText={setEditMood} style={styles.input} />
        <Text style={styles.modalLabel}>Stress (0-10)</Text>
        <TextInput value={String(editStress)} onChangeText={t=>setEditStress(Number(t)||0)} keyboardType="numeric" style={styles.input} />
        <View style={styles.noteHeaderRow}>
          <Text style={styles.modalLabel}>Note</Text>
          <View style={styles.previewToggleRow}>
            <Text style={styles.previewToggleLabel}>Preview</Text>
            <Switch value={showEditPreview} onValueChange={setShowEditPreview} />
          </View>
        </View>
        {!showEditPreview && (
          <TextInput value={editNote} onChangeText={setEditNote} style={[styles.input,{height:100}]} multiline placeholder="Edit note (Markdown *italic* **bold**)" />
        )}
        {showEditPreview && (
          <View style={styles.previewBox}>
            <MarkdownPreview text={editNote} />
          </View>
        )}
        <View style={styles.modalActions}>
          <TouchableOpacity style={[styles.actionBtn,{backgroundColor:'#B0BEC5'}]} onPress={()=>setEditModal(false)}><Text style={styles.actionText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn,{backgroundColor:'#0288D1'}]} onPress={saveEdit}><Text style={styles.actionText}>Save</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
  </GradientBackground>
  <Modal visible={rangeModal} transparent animationType="fade" onRequestClose={()=>setRangeModal(false)}>
    <View style={styles.modalBackdrop}>
      <View style={[styles.modalCard,{ width:'100%', maxWidth:360 }]}>        
        <Text style={styles.modalTitle}>Select Date Range</Text>
        <Text style={styles.modalLabel}>Start</Text>
        <TouchableOpacity style={styles.rangeBtn} onPress={()=>setRangePicking('start')}><Text style={styles.rangeBtnText}>{customRange?.start? customRange.start.toLocaleDateString(): 'Pick start date'}</Text></TouchableOpacity>
        <Text style={styles.modalLabel}>End</Text>
        <TouchableOpacity style={styles.rangeBtn} onPress={()=>setRangePicking('end')}><Text style={styles.rangeBtnText}>{customRange?.end? customRange.end.toLocaleDateString(): 'Pick end date'}</Text></TouchableOpacity>
        {(rangePicking==='start' || rangePicking==='end') && (
          <DateTimePicker
            value={(rangePicking==='start' ? (customRange?.start|| new Date()) : (customRange?.end || new Date()))}
            mode="date"
            display={Platform.OS==='ios'? 'spinner':'spinner'}
            maximumDate={new Date()}
            onChange={(event, selected)=>{
              // Handle cancel / dismiss
              if(event.type === 'dismissed') { setRangePicking(null); return; }
              if(!selected) return;
              const today = new Date(); today.setHours(0,0,0,0);
              const chosen = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
              if(chosen > today){ Alert.alert('Invalid Date','Cannot select a future date.'); return; }
              setCustomRange(prev => {
                const base = prev? { ...prev } : { start: chosen, end: chosen };
                if(rangePicking==='start') base.start = chosen; else base.end = chosen;
                if(base.end < base.start) base.end = base.start;
                return base;
              });
              // On Android we manually close after a selection; on iOS keep open until user taps Apply (optional UX)
              if(Platform.OS==='android') setRangePicking(null);
            }}
          />
        )}
        <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:12, gap:12 }}>
          <TouchableOpacity style={[styles.actionBtn,{ backgroundColor:'#90A4AE'}]} onPress={()=>setRangeModal(false)}><Text style={styles.actionText}>Close</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn,{ backgroundColor:'#0288D1'}]} onPress={()=>{ if(customRange){ AsyncStorage.setItem('report_range_start', customRange.start.toISOString()); AsyncStorage.setItem('report_range_end', customRange.end.toISOString()); } setRangeModal(false); }}><Text style={styles.actionText}>Apply</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
  </>
  );
}

// Announce and set focus shortly after the list mounts (once unlocked)
// We use a separate effect to not interfere with biometric flow
export function useWellnessA11yAnnounce(unlocked, ref) {
  useEffect(() => {
    if (!unlocked) return;
    const t = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
          if (!enabled) return;
          try {
            const tag = findNodeHandle(ref?.current);
            if (tag) AccessibilityInfo.setAccessibilityFocus?.(tag);
          } catch {}
          AccessibilityInfo.announceForAccessibility('Wellness Report. Charts and insights for your moods and stress.');
        }).catch(()=>{});
      });
    }, 500);
    return () => clearTimeout(t);
  }, [unlocked, ref]);
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#EC407A',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FCE4EC',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EC407A',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heading: { 
    fontSize: 28, 
    fontWeight: "800", 
    color: "#01579B", 
    letterSpacing: 0.5 
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#546E7A',
    marginTop: 2,
  },
  healthMetricValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  healthMetricLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  healthMetricSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
    opacity: 0.8,
    marginTop: 2,
  },
  subheading: { fontSize: 20, fontWeight: "700", color: "#0277BD", marginBottom: 12, letterSpacing: 0.2 },
  label: { fontSize: 17, color: "#0277BD", marginBottom: 14, fontWeight: '600' },
  entry: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#E3F2FD' },
  mood: { fontSize: 17, fontWeight: "700", letterSpacing: 0.2 },
  legacy: { fontSize: 11, color: '#FB8C00', fontWeight: '700', letterSpacing: 0.2 },
  note: { fontSize: 15, color: "#01579B", marginVertical: 6, lineHeight: 22 },
  notePlaceholder: { fontSize: 14, fontStyle: 'italic', color: '#607D8B', marginVertical: 6 },
  date: { fontSize: 13, color: "#90A4AE", marginTop: 4 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)' },
  scrollTopBtn: { position: 'absolute', right: 20, bottom: 32, backgroundColor: '#0288D1', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 28, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  scrollTopBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 28 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#01579B', marginBottom: 12, letterSpacing: 0.3 },
  modalLabel: { fontSize: 15, fontWeight: '600', color: '#0277BD', marginTop: 12 },
  input: { backgroundColor: '#F1F8FE', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 6, borderWidth: 2, borderColor: '#E3F2FD', fontSize: 15 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 12 },
  actionBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.3 }
});
// Additional styles for preview toggle
Object.assign(styles, {
  timeframeRow: { flexDirection: 'row', marginBottom: 16, gap: 10, flexWrap: 'wrap' },
  timeBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, backgroundColor: '#E1F5FE', borderWidth: 2, borderColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  timeBtnActive: { backgroundColor: '#0288D1', borderColor: '#01579B', shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
  timeBtnText: { color: '#0288D1', fontWeight: '700', fontSize: 14, letterSpacing: 0.2 },
  timeBtnTextActive: { color: '#fff' },
  statLabel: { fontSize: 12, color: '#0277BD', fontWeight: '600', letterSpacing: 0.2 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#01579B', marginTop: 4, letterSpacing: 0.2 },
  statBlock: { width: '33%', marginBottom: 10 },
  shareBtn: { backgroundColor: '#0288D1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignSelf: 'flex-start', marginTop: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  shareBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  noteHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  previewToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewToggleLabel: { fontSize: 13, color: '#01579B', marginRight: 6, fontWeight: '600' },
  previewBox: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#E3F2FD' }
});
Object.assign(styles, {
  filterChipRow: { flexDirection: 'row', marginBottom: 12, flexWrap: 'wrap' },
  filterChip: { backgroundColor: '#0288D1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, marginRight: 8, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  filterChipText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 }
});
Object.assign(styles, {
  rangeLabel: { fontSize: 14, color: '#01579B', marginBottom: 8, fontWeight: '600', letterSpacing: 0.2 },
  rangeBtn: { backgroundColor: '#E1F5FE', padding: 14, borderRadius: 12, marginTop: 6, borderWidth: 2, borderColor: '#B3E5FC', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  rangeBtnText: { color: '#01579B', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 }
});
