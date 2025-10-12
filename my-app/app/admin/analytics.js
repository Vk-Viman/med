import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import GradientCard from '../../src/components/GradientCard';
import { getCommunityAnalytics, getChallengeAnalytics, getRetentionAnalytics, getCohortSignupWeeks, adminComputeAndStoreAnalytics, getAnalyticsSnapshot } from '../../src/services/admin';
import ShimmerCard from '../../src/components/ShimmerCard';
import SkeletonLoader from '../../src/components/SkeletonLoader';

export default function AdminAnalytics(){
  const { theme } = useTheme();
  const [comm, setComm] = useState(null);
  const [chals, setChals] = useState([]);
  const [ret, setRet] = useState([]);
  const [coh, setCoh] = useState([]);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [rangeDays, setRangeDays] = useState(7);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async()=>{
    setLoading(true);
    try {
      // Try snapshot first if endDate is set; dateKey = YYYYMMDD of endDate
      if (endDate) {
        const key = `${endDate.getFullYear()}${String(endDate.getMonth()+1).padStart(2,'0')}${String(endDate.getDate()).padStart(2,'0')}`;
        const snap = await getAnalyticsSnapshot({ dateKey: key });
        if (snap) {
          setComm(snap.community||{});
          setChals(snap.challenges||[]);
          setRet(snap.cohorts||[]);
          setCoh(snap.signup||[]);
          setLoading(false);
          return;
        }
      }

      const opts = (startDate && endDate) ? { start: startDate, end: endDate } : { windowDays: 7 };
      const [c, cs, r, co] = await Promise.all([
        getCommunityAnalytics(opts),
        getChallengeAnalytics({ windowDays: 30 }),
        getRetentionAnalytics({ weeks: 6 }),
        getCohortSignupWeeks({ recent: 8 })
      ]);
      setComm(c); setChals(cs); setRet(r); setCoh(co);
    } catch(e){ Alert.alert('Failed', e?.message||'Could not load analytics'); }
    finally{ setLoading(false); }
  };

  useEffect(()=>{ load(); },[]);

  return (
    <ScrollView style={{ flex:1, backgroundColor: theme.bg }} contentContainerStyle={{ padding:16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <ShimmerCard colors={['#E8EAF6', '#C5CAE9', '#9FA8DA']} shimmerSpeed={3000}>
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="bar-chart" size={28} color="#AB47BC" />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={[styles.title, { color: theme.text }]}>Analytics Dashboard</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>Insights & Performance Metrics</Text>
          </View>
        </View>
      </ShimmerCard>
      <View style={{ flexDirection:'row', gap:8, alignItems:'center', marginVertical:8, flexWrap:'wrap' }}>
        <PrimaryButton small title={startDate? startDate.toISOString().slice(0,10) : 'Pick start'} onPress={()=> setShowStart(true)} />
        <PrimaryButton small title={endDate? endDate.toISOString().slice(0,10) : 'Pick end'} onPress={()=> setShowEnd(true)} />
        {showStart && (
          <DateTimePicker
            mode='date'
            display='default'
            value={startDate || new Date()}
            onChange={(e,d)=>{
              if (e?.type === 'dismissed') { setShowStart(false); return; }
              if (d) {
                const s=new Date(d.getFullYear(), d.getMonth(), d.getDate());
                setStartDate(s);
              }
              setShowStart(false);
            }}
          />
        )}
        {showEnd && (
          <DateTimePicker
            mode='date'
            display='default'
            value={endDate || new Date()}
            onChange={(e,d)=>{
              if (e?.type === 'dismissed') { setShowEnd(false); return; }
              if (d) {
                const s=new Date(d.getFullYear(), d.getMonth(), d.getDate());
                setEndDate(s);
              }
              setShowEnd(false);
            }}
          />
        )}
        <View style={{ flexDirection:'row', gap:6 }}>
          <PrimaryButton small title='7d' onPress={()=>{ const e=new Date(); const s=new Date(); s.setDate(e.getDate()-7); setStartDate(s); setEndDate(e); setRangeDays(7); }} />
          <PrimaryButton small title='30d' onPress={()=>{ const e=new Date(); const s=new Date(); s.setDate(e.getDate()-30); setStartDate(s); setEndDate(e); setRangeDays(30); }} />
          <PrimaryButton small title='90d' onPress={()=>{ const e=new Date(); const s=new Date(); s.setDate(e.getDate()-90); setStartDate(s); setEndDate(e); setRangeDays(90); }} />
        </View>
        <PrimaryButton title={loading? 'Loading…' : 'Refresh'} onPress={load} />
      </View>
      <View style={{ flexDirection:'row', gap:8, marginBottom:8, flexWrap:'wrap' }}>
  <PrimaryButton title='Compute & Store Snapshot' onPress={async()=>{ try { setBusy(true); const r = await adminComputeAndStoreAnalytics({ rangeDays }); Alert.alert('Stored', `Saved admin_analytics/${r.key}`); } catch(e){ Alert.alert('Failed', e?.message||'Error'); } finally{ setBusy(false); } }} />
  <PrimaryButton title='Export PDF (Summary)' onPress={async()=>{
          try {
            setBusy(true);
            const Print = await import('expo-print');
            const Sharing = await import('expo-sharing');
            const fmt = (n)=> typeof n==='number'? n.toLocaleString() : String(n||'');
            const dateRange = startDate && endDate ? `${startDate.toISOString().slice(0,10)} → ${endDate.toISOString().slice(0,10)}` : `${rangeDays} days`;
            const html = `
              <html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
              <style>
              body{ font-family: -apple-system, Roboto, Arial, sans-serif; padding:16px; color:#073B4C }
              h1{ margin:0 0 8px 0; font-size:22px }
              h2{ margin:16px 0 6px 0; font-size:16px }
              .card{ border:1px solid #E0E0E0; border-radius:10px; padding:12px; margin:8px 0 }
              .muted{ color:#607D8B }
              table{ width:100%; border-collapse:collapse }
              th,td{ text-align:left; padding:6px; border-bottom:1px solid #EEE }
              </style></head><body>
              <h1>Analytics Summary</h1>
              <div class="muted">Range: ${dateRange}</div>
              <div class="card">
                <h2>Community</h2>
                <div>Posts: ${fmt(comm?.postsCount)} • Active posters: ${fmt(comm?.activePosters)}</div>
                <div>Flagged: ${fmt(comm?.flaggedCount)} • Rate: ${fmt(Math.round((comm?.flaggedRate||0)*100))}%</div>
                <div>Reports: ${fmt(comm?.reportsCount)}</div>
              </div>
              <div class="card">
                <h2>Challenges</h2>
                <table><thead><tr><th>Title</th><th>Participants</th><th>Completed</th><th>Rate</th><th>Minutes</th></tr></thead>
                <tbody>
                  ${(chals||[]).map(c=> `<tr><td>${c.title||c.id}</td><td>${fmt(c.participants)}</td><td>${fmt(c.completed)}</td><td>${fmt(Math.round((c.completionRate||0)*100))}%</td><td>${fmt(c.totalMinutes)}</td></tr>`).join('')}
                </tbody></table>
              </div>
              <div class="card">
                <h2>Retention cohorts (weekly)</h2>
                <table><thead><tr><th>Cohort</th><th>Size</th><th>W0</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>W5</th></tr></thead>
                <tbody>
                  ${(ret||[]).map(r=> `<tr><td>${r.cohort}</td><td>${fmt(r.size)}</td>` +
                    [0,1,2,3,4,5].map(w=>{
                      const wk=r.weeks?.[w]||{active:0,rate:0};
                      return `<td>${fmt(wk.active)} (${fmt(Math.round((wk.rate||0)*100))}%)</td>`;
                    }).join('') + '</tr>').join('')}
                </tbody></table>
              </div>
              <div class="card">
                <h2>Signup cohorts</h2>
                <table><thead><tr><th>Week</th><th>Signups</th></tr></thead>
                <tbody>
                  ${(coh||[]).map(c=> `<tr><td>${c.cohort}</td><td>${fmt(c.count)}</td></tr>`).join('')}
                </tbody></table>
              </div>
              </body></html>`;
            const { uri } = await Print.printToFileAsync({ html });
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
              await Sharing.shareAsync(uri, { mimeType:'application/pdf', dialogTitle:'Share Analytics Summary' });
            } else {
              Alert.alert('PDF ready', uri);
            }
          } catch(e){ Alert.alert('Failed', e?.message||'Error'); }
          finally{ setBusy(false); }
        }} />
  <PrimaryButton title='Export Excel' onPress={async()=>{
          try {
            setBusy(true);
            const Sharing = await import('expo-sharing');
            // Build workbook
            const wb = XLSX.utils.book_new();

            // Community sheet (single-row summary)
            const communityRows = [
              {
                start: comm?.start ? new Date(comm.start).toISOString() : '',
                end: comm?.end ? new Date(comm.end).toISOString() : '',
                postsCount: comm?.postsCount ?? 0,
                activePosters: comm?.activePosters ?? 0,
                flaggedCount: comm?.flaggedCount ?? 0,
                flaggedRate: comm?.flaggedRate ?? 0,
                reportsCount: comm?.reportsCount ?? 0,
              },
            ];
            const wsCommunity = XLSX.utils.json_to_sheet(communityRows);
            XLSX.utils.book_append_sheet(wb, wsCommunity, 'Community');

            // Challenges sheet
            const chRows = (chals||[]).map(c => ({
              title: c.title || c.id,
              participants: c.participants ?? 0,
              completed: c.completed ?? 0,
              completionRate: c.completionRate ?? 0,
              totalMinutes: c.totalMinutes ?? 0,
            }));
            const wsChal = XLSX.utils.json_to_sheet(chRows);
            XLSX.utils.book_append_sheet(wb, wsChal, 'Challenges');

            // Retention cohorts sheet
            const retRows = (ret||[]).map(r => ({
              cohort: r.cohort,
              size: r.size ?? 0,
              W0_active: r.weeks?.[0]?.active ?? 0,
              W0_rate: r.weeks?.[0]?.rate ?? 0,
              W1_active: r.weeks?.[1]?.active ?? 0,
              W1_rate: r.weeks?.[1]?.rate ?? 0,
              W2_active: r.weeks?.[2]?.active ?? 0,
              W2_rate: r.weeks?.[2]?.rate ?? 0,
              W3_active: r.weeks?.[3]?.active ?? 0,
              W3_rate: r.weeks?.[3]?.rate ?? 0,
              W4_active: r.weeks?.[4]?.active ?? 0,
              W4_rate: r.weeks?.[4]?.rate ?? 0,
              W5_active: r.weeks?.[5]?.active ?? 0,
              W5_rate: r.weeks?.[5]?.rate ?? 0,
            }));
            const wsRet = XLSX.utils.json_to_sheet(retRows);
            XLSX.utils.book_append_sheet(wb, wsRet, 'Retention');

            // Signup cohorts sheet
            const cohRows = (coh||[]).map(c => ({ week: c.cohort, signups: c.count }));
            const wsCoh = XLSX.utils.json_to_sheet(cohRows);
            XLSX.utils.book_append_sheet(wb, wsCoh, 'Signups');

            // Write workbook as base64 xlsx
            const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
            const ts = Date.now();
            const path = `${FileSystem.cacheDirectory}analytics_${ts}.xlsx`;
            await FileSystem.writeAsStringAsync(path, b64, { encoding: 'base64' });

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
              await Sharing.shareAsync(path, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Share Analytics Excel' });
            } else {
              Alert.alert('Excel ready', path);
            }
          } catch(e){ Alert.alert('Failed', e?.message||'Error'); }
          finally{ setBusy(false); }
        }} />
      </View>

      <Text style={[styles.h2,{ color: theme.text, marginTop: 12 }]}>Community (7d)</Text>
      {comm && (
        <GradientCard colors={['#AB47BC', '#8E24AA']} style={{ marginTop: 12 }}>
          <Text style={[styles.kv, { color: '#fff', fontWeight: '800', fontSize: 16, marginBottom: 8 }]}>
            Community Activity
          </Text>
          <Text style={[styles.kv,{ color: '#fff' }]}>
            Posts: <Text style={styles.k}>{comm.postsCount}</Text>  •  Active posters: <Text style={styles.k}>{comm.activePosters}</Text>
          </Text>
          <Text style={[styles.kv,{ color: '#fff' }]}>Flagged: <Text style={styles.k}>{comm.flaggedCount}</Text>  •  Rate: <Text style={styles.k}>{(comm.flaggedRate*100).toFixed(1)}%</Text></Text>
          <Text style={[styles.kv,{ color: '#fff', opacity: 0.9 }]}>Reports: {comm.reportsCount}</Text>
        </GradientCard>
      )}

      <Text style={[styles.h2,{ color: theme.text, marginTop: 12 }]}>Challenges</Text>
      {chals.map(c => (
        <GradientCard key={c.id} colors={['#26A69A', '#00897B']} style={{ marginTop: 12 }}>
          <Text style={[styles.kv,{ color: '#fff', fontWeight: '800', fontSize: 16 }]}>{c.title}</Text>
          <Text style={[styles.kv,{ color: '#fff', marginTop: 4 }]}>Participants: {c.participants} • Completed: {c.completed} • Rate {(c.completionRate*100).toFixed(0)}%</Text>
          <Text style={[styles.kv,{ color: '#fff', opacity: 0.9 }]}>Total minutes: {c.totalMinutes}</Text>
        </GradientCard>
      ))}

      <Text style={[styles.h2,{ color: theme.text, marginTop: 12 }]}>Retention cohorts</Text>
      {ret.map(row => (
        <View key={row.cohort} style={[styles.card,{ backgroundColor: theme.card }]}> 
          <Text style={[styles.kv,{ color: theme.text }]}>Cohort {row.cohort} (n={row.size})</Text>
          <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap', marginTop:6 }}>
            {Object.keys(row.weeks).map(w => (
              <View key={w} style={[styles.badge, { backgroundColor: theme.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD' }]}>
                <Text style={{ color: theme.text }}>{Number(w)+1}w: {(row.weeks[w].rate*100).toFixed(0)}%</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <Text style={[styles.h2,{ color: theme.text, marginTop: 12 }]}>Signup cohorts</Text>
      <View style={[styles.card,{ backgroundColor: theme.card }]}> 
        <View style={{ gap:6 }}>
          {coh.map(c => (
            <Text key={c.cohort} style={{ color: theme.textMuted }}>{c.cohort}: {c.count}</Text>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(171, 71, 188, 0.2)' },
  iconBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3E5F5', justifyContent: 'center', alignItems: 'center', shadowColor: '#AB47BC', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: 0.3 },
  subtitle: { fontSize: 14, fontWeight: '500', marginTop: 4 },
  h1:{ fontSize:28, fontWeight:'800', letterSpacing:0.3, marginBottom:4 },
  h2:{ fontSize:20, fontWeight:'800', letterSpacing:0.2, marginTop:8 },
  card:{ padding:18, borderRadius:16, marginTop:12, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, elevation:3, borderWidth:1, borderColor:'rgba(0,0,0,0.05)' },
  kv:{ fontSize:15, lineHeight:24 },
  k:{ fontWeight:'800', letterSpacing:0.2 },
  badge:{ paddingHorizontal:14, paddingVertical:8, borderRadius:16, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:1 },
  input:{ height:48, paddingHorizontal:14, borderRadius:12, minWidth:160, fontSize:15, borderWidth:2, borderColor:'rgba(0,0,0,0.1)', shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 }
});
