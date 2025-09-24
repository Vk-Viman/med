import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, RefreshControl, Switch, Animated } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import GradientBackground from "../src/components/GradientBackground";
import { db, auth } from "../firebase/firebaseConfig";
import { collection, query, orderBy, getDocs } from "firebase/firestore"; // legacy direct fetch kept for chart initial version
import { LineChart, PieChart } from "react-native-chart-kit";
import CryptoJS from "crypto-js";
import { listMoodEntriesPage, listMoodEntriesSince, decryptEntry, updateMoodEntry, deleteMoodEntry, flushQueue } from "../src/services/moodEntries";
import MarkdownPreview from "../src/components/MarkdownPreview";
import { Dimensions } from "react-native";
import Card from "../src/components/Card";

const pieColors = ['#42A5F5','#66BB6A','#FFA726','#AB47BC','#EC407A','#FF7043'];

export default function WellnessReport() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const chartFade = useRef(new Animated.Value(1)).current;
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

  useEffect(() => { flushQueue(); loadPage(true); }, []);

  // Load persisted timeframe on mount
  useEffect(()=>{ (async()=>{ try{ const stored = await AsyncStorage.getItem('report_timeframe'); if(stored) setTimeframe(Number(stored)); }catch{} })(); },[]);

  // Load timeframe specific entries when timeframe changes
  useEffect(()=>{
    (async () => {
      const uid = auth.currentUser?.uid; if(!uid) return;
      setTfLoading(true);
      try {
        // persist selection
        try { await AsyncStorage.setItem('report_timeframe', String(timeframe)); } catch{}
        // animate fade out
        chartFade.setValue(0);
        const docs = await listMoodEntriesSince({ days: timeframe });
        const decrypted = [];
        for(const d of docs){
          const base = { ...d.data(), id: d.id };
          const full = await decryptEntry(uid, base);
          decrypted.push(full);
        }
        setTfEntries(decrypted);
      } catch(e) { /* silent for now */ }
      setTfLoading(false);
      Animated.timing(chartFade,{ toValue:1, duration:250, useNativeDriver:true }).start();
    })();
  }, [timeframe]);

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
  const chartBase = filteredTf.filter(e => e.createdAt?.seconds).map(e => ({
    date: new Date(e.createdAt.seconds * 1000),
    stress: e.stress || 0
  }));
  // dynamic label thinning
  const labelEvery = chartBase.length > 10 ? Math.ceil(chartBase.length / 7) : 1;
  const chartData = {
    labels: chartBase.map((p,i)=> i % labelEvery === 0 ? `${p.date.getDate()}/${p.date.getMonth()+1}`: ''),
    datasets: [{ data: chartBase.map(p=>p.stress) }]
  };

  // Summary stats
  const avgStress = chartBase.length ? (chartBase.reduce((a,b)=>a+b.stress,0)/chartBase.length).toFixed(1) : '-';
  const moodFreq = filteredTf.reduce((acc,e)=>{ acc[e.mood] = (acc[e.mood]||0)+1; return acc; }, {});
  const topMood = Object.keys(moodFreq).length ? Object.entries(moodFreq).sort((a,b)=>b[1]-a[1])[0] : null;
  // Streak: consecutive days (from today backwards) where there is at least one entry
  let streak = 0;
  if(tfEntries.length){
    const daysSet = new Set(tfEntries.filter(e=>e.createdAt?.seconds).map(e=>{
      const d = new Date(e.createdAt.seconds*1000); return d.toDateString();
    }));
    const today = new Date();
    for(let i=0;i<timeframe;i++){
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()-i);
      if(daysSet.has(d.toDateString())) streak++; else break;
    }
  }

  const ListHeader = () => (
    <View>
      <Text style={styles.heading}>Wellness Report</Text>
      <View style={styles.timeframeRow}>
        {[7,30,90].map(d => (
          <TouchableOpacity key={d} style={[styles.timeBtn, timeframe===d && styles.timeBtnActive]} onPress={()=>setTimeframe(d)} disabled={tfLoading}>
            <Text style={[styles.timeBtnText, timeframe===d && styles.timeBtnTextActive]}>{d}D</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.timeBtn,{opacity:0.6}]} onPress={()=>Alert.alert('Custom Range','TODO: Date range picker not implemented yet')}>
          <Text style={styles.timeBtnText}>Custom</Text>
        </TouchableOpacity>
      </View>
      {moodFilter && (
        <View style={styles.filterChipRow}>
          <TouchableOpacity style={styles.filterChip} onPress={()=>setMoodFilter(null)}>
            <Text style={styles.filterChipText}>Filter: {moodFilter} ✕</Text>
          </TouchableOpacity>
        </View>
      )}
      {tfEntries.length > 0 ? (
        <Card>
          <View style={{ padding:4, flexDirection:'row', justifyContent:'space-between', marginBottom:4 }}>
            <View style={{ flex:1 }}>
              <Text style={styles.statLabel}>Avg Stress</Text>
              <Text style={styles.statValue}>{avgStress}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={styles.statLabel}>Top Mood</Text>
              <Text style={styles.statValue}>{topMood? `${topMood[0]} (${topMood[1]})`:'-'}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={styles.statLabel}>Streak</Text>
              <Text style={styles.statValue}>{streak}d</Text>
            </View>
          </View>
          <Animated.View style={{ opacity: chartFade }}>
            <LineChart
              data={chartData}
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
          </Animated.View>
          {Object.keys(moodFreq).length > 0 && (
            <View style={{ marginTop:12, alignItems:'center' }}>
              <Text style={[styles.statLabel,{ alignSelf:'flex-start', marginBottom:4 }]}>Mood Distribution</Text>
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
          )}
        </Card>
  ) : <Text style={styles.label}>No data yet.</Text>}
      <Text style={styles.subheading}>Journal Entries</Text>
    </View>
  );

  return (
    <GradientBackground>
    <FlatList
      style={styles.container}
      data={entries}
      keyExtractor={e => e.id}
      ListHeaderComponent={ListHeader}
      renderItem={({ item }) => {
        const hasCipher = item.encVer === 2 && item.noteCipher;
        const showPlaceholder = hasCipher && (item.note === '' || typeof item.note === 'undefined');
        return (
          <TouchableOpacity style={styles.entry} onPress={() => openEdit(item)} onLongPress={() => confirmDelete(item)} delayLongPress={500}>
            <Text style={styles.mood}>{item.mood} | Stress: {item.stress} {item.legacy && <Text style={styles.legacy}>LEGACY</Text>}</Text>
            {item.note ? (
              <MarkdownPreview text={item.note} style={styles.note} />
            ) : showPlaceholder ? (
              <Text style={styles.notePlaceholder}>Encrypted note (empty or failed to decrypt)</Text>
            ) : null}
            <Text style={styles.date}>{item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleString() : ''}</Text>
          </TouchableOpacity>
        );
      }}
      onEndReached={loadMore}
      onEndReachedThreshold={0.2}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 24 }}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} /> : null}
  />
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#01579B", marginBottom: 12 },
  subheading: { fontSize: 18, fontWeight: "600", color: "#0277BD", marginBottom: 8 },
  label: { fontSize: 16, color: "#0277BD", marginBottom: 12 },
  entry: { backgroundColor: "#fff", borderRadius: 8, padding: 12, marginBottom: 10 },
  mood: { fontSize: 16, fontWeight: "600" },
  legacy: { fontSize:10, color:'#FB8C00', fontWeight:'700' },
  note: { fontSize: 15, color: "#01579B", marginVertical: 4 },
  notePlaceholder:{ fontSize:13, fontStyle:'italic', color:'#607D8B', marginVertical:4 },
  date: { fontSize: 12, color: "#90A4AE" },
  loadingOverlay:{ position:'absolute', top:0,left:0,right:0,bottom:0, alignItems:'center', justifyContent:'center' },
  modalBackdrop:{ flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', padding:24 },
  modalCard:{ backgroundColor:'#fff', borderRadius:16, padding:16 },
  modalTitle:{ fontSize:18, fontWeight:'700', color:'#01579B', marginBottom:8 },
  modalLabel:{ fontSize:14, fontWeight:'600', color:'#0277BD', marginTop:8 },
  input:{ backgroundColor:'#F1F8FE', borderRadius:8, paddingHorizontal:10, paddingVertical:8, marginTop:4 },
  modalActions:{ flexDirection:'row', justifyContent:'flex-end', marginTop:16, gap:12 },
  actionBtn:{ paddingHorizontal:16, paddingVertical:10, borderRadius:8 },
  actionText:{ color:'#fff', fontWeight:'600' }
});
// Additional styles for preview toggle
Object.assign(styles, {
  timeframeRow:{ flexDirection:'row', marginBottom:12, gap:8 },
  timeBtn:{ paddingHorizontal:14, paddingVertical:6, borderRadius:20, backgroundColor:'#E1F5FE' },
  timeBtnActive:{ backgroundColor:'#0288D1' },
  timeBtnText:{ color:'#0288D1', fontWeight:'600', fontSize:12 },
  timeBtnTextActive:{ color:'#fff' },
  statLabel:{ fontSize:11, color:'#0277BD', fontWeight:'600' },
  statValue:{ fontSize:14, fontWeight:'700', color:'#01579B', marginTop:2 },
  noteHeaderRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:8 },
  previewToggleRow:{ flexDirection:'row', alignItems:'center', gap:6 },
  previewToggleLabel:{ fontSize:12, color:'#01579B', marginRight:4 },
  previewBox:{ backgroundColor:'#FFFFFF', borderRadius:8, padding:10, marginTop:6 }
});
Object.assign(styles, {
  filterChipRow:{ flexDirection:'row', marginBottom:8 },
  filterChip:{ backgroundColor:'#0288D1', paddingHorizontal:12, paddingVertical:6, borderRadius:20 },
  filterChipText:{ color:'#fff', fontSize:12, fontWeight:'600' }
});
