import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Alert, Platform, ScrollView, AccessibilityInfo, InteractionManager, findNodeHandle, Pressable } from "react-native";
import { useTheme } from "../src/theme/ThemeProvider";
import GradientBackground from "../src/components/GradientBackground";
import Card from "../src/components/Card";
import { auth } from "../firebase/firebaseConfig";
import { collection, query, where, onSnapshot, Timestamp, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { LineChart } from "react-native-chart-kit";
import { safeSnapshot } from "../src/utils/safeSnapshot";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import GradientCard from "../src/components/GradientCard";
import ProgressRing from "../src/components/ProgressRing";

const BIOMETRIC_PREF_KEY = 'pref_biometric_enabled_v1';

export default function WeeklyReportScreen() {
  const [minutesByDay, setMinutesByDay] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [prevWeekTotal, setPrevWeekTotal] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [tips, setTips] = useState([]);
  const [unlocked, setUnlocked] = useState(false);
  const router = useRouter();
  const titleRef = useRef(null);
  const shareViewRef = useRef(null);
  const { theme } = useTheme();

  // Biometric gate on enter (if user enabled it)
  useEffect(() => {
    (async () => {
      try {
        const pref = await AsyncStorage.getItem(BIOMETRIC_PREF_KEY);
        const enabled = pref === '1';
        if (!enabled) { setUnlocked(true); return; }
        // Skip on web
        if (Platform.OS === 'web') { setUnlocked(true); return; }
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !enrolled) { setUnlocked(true); return; }
        const res = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock report" });
        if (res.success) { setUnlocked(true); } else { Alert.alert('Locked', 'Biometric authentication canceled.'); try { router.back(); } catch {} }
      } catch {
        setUnlocked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    const user = auth.currentUser;
    if (!user) return;
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    try {
      const q = query(
        collection(db, "users", user.uid, "sessions"),
        where("endedAt", ">=", Timestamp.fromDate(start))
      );
      const unsub = safeSnapshot(q, (snap) => {
        const arrSec = [0, 0, 0, 0, 0, 0, 0];
        snap.forEach((doc) => {
          const d = doc.data();
          if (!d.durationSec || !d.endedAt) return;
          const dayIdx = Math.max(0, Math.min(6, Math.floor((d.endedAt.toDate() - start) / (24 * 60 * 60 * 1000))));
          arrSec[dayIdx] += d.durationSec;
        });
        // Convert to minutes with one decimal so short sessions show up
        const arrMin = arrSec.map((s) => Math.round((s / 60) * 10) / 10);
        setMinutesByDay(arrMin);
        // Derive adherence-based tips when current week changes
        deriveTips(arrMin);
      });
      return () => unsub();
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  }, [unlocked]);

  // PDF export is supported via expo-print (installed)

  // Previous week total (for trend), and streak over last 30 days
  useEffect(() => {
    if (!unlocked) return;
    const user = auth.currentUser; if (!user) return;
    (async () => {
      try {
        const now = new Date();
        const startCurr = new Date(now);
        startCurr.setDate(now.getDate() - 6);
        startCurr.setHours(0,0,0,0);
        const startPrev = new Date(startCurr);
        startPrev.setDate(startCurr.getDate() - 7);

        // Previous week window: [startPrev, startCurr)
        const qPrev = query(
          collection(db, 'users', user.uid, 'sessions'),
          where('endedAt', '>=', Timestamp.fromDate(startPrev)),
          where('endedAt', '<', Timestamp.fromDate(startCurr))
        );
        const prevSnap = await getDocs(qPrev);
        let prevSec = 0;
        prevSnap.forEach(doc => {
          const d = doc.data();
          if (!d.durationSec) return; prevSec += d.durationSec;
        });
        setPrevWeekTotal(Math.round((prevSec/60)*10)/10);
      } catch {}

      try {
        // Streak over last 30 days
        const ref = collection(db, 'users', user.uid, 'sessions');
        const q = query(ref, orderBy('endedAt','desc'), limit(200));
        const snap = await getDocs(q);
        const days = new Set();
        const today = new Date(); today.setHours(0,0,0,0);
        snap.forEach(doc => {
          const d = doc.data(); const dt = d?.endedAt?.toDate?.(); if(!dt) return;
          const key = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).toISOString().slice(0,10);
          days.add(key);
        });
        let streak = 0;
        for(let i=0;i<30;i++){
          const dt = new Date(today); dt.setDate(today.getDate()-i);
          const key = dt.toISOString().slice(0,10);
          if(days.has(key)) streak++; else break;
        }
        setStreakDays(streak);
      } catch {}
    })();
  }, [unlocked]);

  function deriveTips(weekArrMin){
    try {
      const total = weekArrMin.reduce((a,b)=>a+b,0);
      const daysActive = weekArrMin.filter(v=>v>0).length;
      const avg = total / Math.max(weekArrMin.length,1);
      const t = [];
      if (streakDays >= 5) t.push('Great streak! Keep momentum with a consistent time each day.');
      if (daysActive <= 2) t.push('Try 5–10 minute sessions and enable the backup reminder in Settings.');
      if (avg < 7) t.push('Short, frequent sessions work best—aim for a quick pause after a routine (coffee, lunch).');
      if (avg >= 15) t.push('Consider one longer mid-week session to deepen your practice.');
      // Trend-aware tip will be added when we have current vs previous deltas at render time
      setTips(t.slice(0,3));
    } catch {}
  }

  // Announce screen and focus heading after interactions
  useEffect(() => {
    if (!unlocked) return;
    const t = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
          if (!enabled) return;
          try {
            const tag = findNodeHandle(titleRef.current);
            if (tag) AccessibilityInfo.setAccessibilityFocus?.(tag);
          } catch {}
          AccessibilityInfo.announceForAccessibility('Weekly Report. Meditation minutes for the past week.');
        }).catch(()=>{});
      });
    }, 400);
    return () => clearTimeout(t);
  }, [unlocked]);

  const screenWidth = Dimensions.get("window").width - 24;
  // Build labels as dates (e.g., 17, 18, 19, ..., Today)
  const dateLabels = (() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const arr = [];
    for (let i = 6; i >= 1; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      arr.push(d.toLocaleDateString(undefined, { day: "2-digit" }));
    }
    arr.push("Today");
    return arr;
  })();

  const noData = minutesByDay.every((v) => v === 0);
  const currentTotal = minutesByDay.reduce((a, b) => a + b, 0);
  const trendDelta = currentTotal - prevWeekTotal;
  const trendPct = prevWeekTotal > 0 ? Math.round((trendDelta / prevWeekTotal) * 100) : null;
  const trendLabel = trendPct === null ? '—' : `${trendPct >= 0 ? '+' : ''}${trendPct}%`;
  const activeDays = minutesByDay.filter(v=>v>0).length;

  return (
    <GradientBackground>
    <ScrollView style={{ flex:1 }} contentContainerStyle={styles.container}>
  <View ref={shareViewRef} collapsable={false} style={[styles.shareCapture, { backgroundColor: theme.card }]}>
  
  {/* Professional Header */}
  <View style={styles.header}>
    <View style={styles.iconBadge}>
      <Ionicons name="bar-chart" size={28} color="#AB47BC" />
    </View>
    <View style={{ flex: 1, marginLeft: 16 }}>
      <Text ref={titleRef} style={styles.title} accessibilityRole='header' accessibilityLabel='Weekly Report'>Weekly Report</Text>
      <Text style={styles.subtitle}>Your meditation insights</Text>
    </View>
  </View>
        <Card>
          <LineChart
            data={{ labels: dateLabels, datasets: [{ data: minutesByDay }] }}
            width={screenWidth}
            height={220}
            yAxisSuffix="m"
            chartConfig={{
              backgroundColor: "transparent",
              backgroundGradientFrom: "#FFFFFF",
              backgroundGradientTo: "#FFFFFF",
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(2, 136, 209, ${opacity})`,
              labelColor: () => "#01579B",
            }}
            bezier
            style={{ borderRadius: 12 }}
          />
        </Card>
        
        {/* Stats Card with Progress Ring */}
        <GradientCard colors={['#AB47BC', '#8E24AA', '#6A1B9A']} style={{ marginTop: 16 }}>
          <View style={{ alignItems: 'center' }}>
            <ProgressRing
              size={100}
              progress={Math.min(100, (currentTotal / 140) * 100)}
              strokeWidth={10}
              color="#FFFFFF"
              backgroundColor="rgba(255,255,255,0.3)"
            />
            <Text style={styles.statsValue}>{currentTotal.toFixed(1)}</Text>
            <Text style={styles.statsLabel}>Total Minutes</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{activeDays}</Text>
                <Text style={styles.statLabel}>Active Days</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, trendDelta>=0?{color:'#66BB6A'}:{color:'#EF5350'}]}>{trendLabel}</Text>
                <Text style={styles.statLabel}>WoW Change</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{streakDays}</Text>
                <Text style={styles.statLabel}>Streak Days</Text>
              </View>
            </View>
          </View>
        </GradientCard>

        {/* Insights */}
        <Card>
          <Text style={styles.sectionTitle}>Insights</Text>
          {trendPct !== null && (
            <Text style={styles.insight}>You're {trendDelta >= 0 ? 'up' : 'down'} {Math.abs(trendPct)}% vs last week ({prevWeekTotal.toFixed(1)}m).</Text>
          )}
          {trendPct === null && (
            <Text style={styles.insight}>Not enough data from last week yet—keep logging sessions.</Text>
          )}
          {streakDays >= 3 && (
            <Text style={styles.insight}>Nice streak of {streakDays} days. Consistency compounds!</Text>
          )}
          {streakDays === 0 && (
            <Text style={styles.insight}>Start today to begin your streak.</Text>
          )}
        </Card>

        {/* Recommended tips */}
        <Card>
          <Text style={styles.sectionTitle}>Recommended tips</Text>
          {[...tips,
            ...(trendPct !== null && trendPct < -10 ? ['A small, consistent window works best—anchor your session to a routine.'] : []),
          ].slice(0,3).map((t,i)=>(
            <Text key={i} style={styles.tip}>• {t}</Text>
          ))}
          {tips.length === 0 && trendPct === null && (
            <Text style={styles.tip}>• Try a 5-minute session to get started—every minute counts.</Text>
          )}
        </Card>

        {/* Export / Share */}
        <Card>
          <Text style={styles.sectionTitle}>Export</Text>
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionBtn} onPress={async ()=>{
              try{
                const Print = await import('expo-print');
                const Sharing = await import('expo-sharing');
                const html = buildReportHtml({ dateLabels, minutesByDay, currentTotal, prevWeekTotal, trendPct, streakDays, activeDays });
                const { uri } = await Print.printToFileAsync({ html });
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Weekly Report' });
                } else {
                  Alert.alert('Saved', 'PDF generated at: ' + uri);
                }
              } catch(e){ Alert.alert('Export failed', e?.message || String(e)); }
            }}>
              <Text style={styles.actionText}>Share as PDF</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={async ()=>{
              try{
                const { captureRef } = await import('react-native-view-shot');
                const Sharing = await import('expo-sharing');
                const uri = await captureRef(shareViewRef, { format: 'png', quality: 0.9, backgroundColor: theme.card });
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Weekly Report' });
                } else {
                  Alert.alert('Saved', 'Image generated at: ' + uri);
                }
              } catch(e){ Alert.alert('Export failed', e?.message || String(e)); }
            }}>
              <Text style={styles.actionText}>Share as Image</Text>
            </Pressable>
          </View>
        </Card>
        {noData && (
          <Text style={styles.hint}>Tip: press Play for a short session, then Pause to log it.</Text>
        )}
  </View>
      </ScrollView>
    </GradientBackground>
  );
}

function buildReportHtml({ dateLabels, minutesByDay, currentTotal, prevWeekTotal, trendPct, streakDays, activeDays }){
  const rows = dateLabels.map((lbl, i) => `<tr><td>${lbl}</td><td style="text-align:right">${minutesByDay[i].toFixed(1)} m</td></tr>`).join('');
  const trendStr = trendPct === null ? '—' : `${trendPct >= 0 ? '+' : ''}${trendPct}%`;
  return `
  <html><head><meta charset="utf-8"/>
  <style>
    body{ font-family: -apple-system,Segoe UI,Roboto,Arial,sans-serif; padding:16px; color:#074b6d }
    h1{ color:#0288D1 }
    table{ width:100%; border-collapse:collapse; margin-top:8px }
    td{ padding:6px 4px; border-bottom:1px solid #e0f2f1 }
    .kpis{ margin:8px 0; display:flex; gap:16px; color:#01579B }
  </style></head>
  <body>
    <h1>Weekly Report</h1>
    <div class="kpis">
      <div>Total: ${currentTotal.toFixed(1)} m</div>
      <div>Active days: ${activeDays}/7</div>
      <div>WoW: ${trendStr}</div>
      <div>Streak: ${streakDays} day${streakDays===1?'':'s'}</div>
    </div>
    <table>
      ${rows}
    </table>
    <p style="margin-top:10px; color:#00796B">Prev week total: ${prevWeekTotal.toFixed(1)} m</p>
  </body></html>`;
}

const styles = StyleSheet.create({
  container: { padding: 12, paddingBottom: 24 },
  shareCapture: { borderRadius: 12, paddingBottom: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#AB47BC',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#AB47BC',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  title: { 
    fontSize: 28, 
    fontWeight: "800", 
    color: "#0288D1", 
    letterSpacing: 0.5 
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#546E7A',
    marginTop: 2,
  },
  statsValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginTop: 12,
  },
  statsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.8,
    marginTop: 4,
  },
  total: { marginTop: 12, fontWeight: "600", color: "#01579B" },
  hint: { marginTop: 8, color: "#607D8B" },
  row: { flexDirection: 'row', gap: 16, marginTop: 8, flexWrap: 'wrap' },
  kpi: { color: '#01579B', fontWeight: '600' },
  up: { color: '#2e7d32' },
  down: { color: '#c62828' },
  sectionTitle: { fontWeight: '700', color: '#01579B', marginBottom: 6 },
  insight: { color: '#355F6B', marginTop: 4 },
  tip: { color: '#355F6B', marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { backgroundColor: '#0288D1', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  actionText: { color: 'white', fontWeight: '700' },
});
