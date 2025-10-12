import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Button, Alert, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase/firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { safeSnapshot } from '../../src/utils/safeSnapshot';
import { adminExportReportsCsv } from '../../src/services/admin';
import { useTheme } from '../../src/theme/ThemeProvider';
import GradientCard from '../../src/components/GradientCard';
import ShimmerCard from '../../src/components/ShimmerCard';

export default function ModerationScreen(){
  const { theme } = useTheme();
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open'); // open | resolved | dismissed | all
  const [toxFilter, setToxFilter] = useState('any'); // any | flagged | pending
  const [postMeta, setPostMeta] = useState({}); // { [postId]: { toxicityScore, toxicityReason, flagged, hidden, reviewStatus, text, createdAt } }
  const [busy, setBusy] = useState(false);
  const [manualPostId, setManualPostId] = useState('');
  const filtered = useMemo(()=> {
    return reports.filter(r=> {
      if(!(statusFilter==='all' ? true : r.status===statusFilter)) return false;
      if(toxFilter==='flagged') return !!r.flagged || r.toxicityScore>=0.6;
      if(toxFilter==='pending') return r.reviewStatus==='pending';
      return true;
    });
  }, [reports, statusFilter, toxFilter]);

  useEffect(()=>{
    const q = query(collection(db,'reports'), orderBy('createdAt','desc'));
    const unsub = safeSnapshot(q, (snap)=>{
      const rows = snap.docs.map(d=> ({ id:d.id, ...d.data() }));
      setReports(rows);
    });
    return ()=> { try { unsub(); } catch {} };
  },[]);

  // Enrich with post metadata for toxicity, flags, and preview text
  useEffect(()=>{
    (async()=>{
      try {
        const ids = Array.from(new Set(reports.map(r=> r.postId).filter(Boolean)));
        const entries = await Promise.all(ids.map(async id=>{
          try { const s = await getDoc(doc(db,'posts',id)); return [id, s.exists()? (s.data()||{}) : {}]; } catch { return [id, {}]; }
        }));
        const map = {};
        entries.forEach(([id,data])=>{
          map[id] = {
            toxicityScore: Number(data?.toxicityScore||0),
            toxicityReason: data?.toxicityReason || '',
            flagged: !!data?.flagged,
            hidden: !!data?.hidden,
            reviewStatus: data?.reviewStatus || '',
            text: data?.text || '',
            createdAt: data?.createdAt || null,
          };
        });
        setPostMeta(map);
      } catch {}
    })();
  }, [reports.length]);

  const dismiss = async (r)=>{
    try {
      await updateDoc(doc(db,'reports',r.id), { status:'dismissed' });
      try { await addDoc(collection(db,'admin_audit_logs'), { action:'dismiss', reportId: r.id, postId: r.postId||null, adminUid: auth.currentUser?.uid||null, createdAt: serverTimestamp() }); } catch {}
    } catch {}
  };
  const hidePost = async (r)=>{
    try {
      await updateDoc(doc(db,'posts',r.postId), { hidden: true });
      await updateDoc(doc(db,'reports',r.id), { status:'resolved' });
      Alert.alert('Post hidden','The post has been hidden.');
      try { await addDoc(collection(db,'admin_audit_logs'), { action:'hide', reportId: r.id, postId: r.postId||null, adminUid: auth.currentUser?.uid||null, createdAt: serverTimestamp() }); } catch {}
    } catch {}
  };
  const approveAndUnhide = async (r)=>{
    try {
      await updateDoc(doc(db,'posts',r.postId), { hidden: false, reviewStatus:'approved' });
      await updateDoc(doc(db,'reports',r.id), { status:'resolved' });
      Alert.alert('Approved','The post has been unhidden.');
      try { await addDoc(collection(db,'admin_audit_logs'), { action:'approve_unhide', reportId: r.id, postId: r.postId||null, adminUid: auth.currentUser?.uid||null, createdAt: serverTimestamp() }); } catch {}
    } catch {}
  };
  const unhidePost = async (r)=>{
    try {
      await updateDoc(doc(db,'posts',r.postId), { hidden: false });
      Alert.alert('Post restored','The post is visible again.');
      try { await addDoc(collection(db,'admin_audit_logs'), { action:'unhide', reportId: r.id, postId: r.postId||null, adminUid: auth.currentUser?.uid||null, createdAt: serverTimestamp() }); } catch {}
    } catch {}
  };
  const deletePost = async (r)=>{
    try {
      await deleteDoc(doc(db,'posts',r.postId));
      await updateDoc(doc(db,'reports',r.id), { status:'resolved' });
      Alert.alert('Post deleted','The post has been deleted.');
      try { await addDoc(collection(db,'admin_audit_logs'), { action:'delete', reportId: r.id, postId: r.postId||null, adminUid: auth.currentUser?.uid||null, createdAt: serverTimestamp() }); } catch {}
    } catch {}
  };

  // Manual flags utility (works with Admin > Community list that shows posts where flagged == true)
  const manualFlagById = async ()=>{
    const id = manualPostId.trim(); if(!id) return Alert.alert('Validation','Enter a post ID');
    try {
      await updateDoc(doc(db,'posts',id), { flagged: true, reviewStatus: 'pending', updatedAt: serverTimestamp() });
      setManualPostId('');
      Alert.alert('Flagged','Post was marked as flagged.');
      try { await addDoc(collection(db,'admin_audit_logs'), { action:'manual_flag', postId: id, adminUid: auth.currentUser?.uid||null, createdAt: serverTimestamp() }); } catch {}
    } catch(e){ Alert.alert('Error', e?.message || 'Failed to set flag'); }
  };
  const manualClearById = async ()=>{
    const id = manualPostId.trim(); if(!id) return Alert.alert('Validation','Enter a post ID');
    try {
      await updateDoc(doc(db,'posts',id), { flagged: false, updatedAt: serverTimestamp() });
      setManualPostId('');
      Alert.alert('Cleared','Post flag was cleared.');
      try { await addDoc(collection(db,'admin_audit_logs'), { action:'manual_flag_clear', postId: id, adminUid: auth.currentUser?.uid||null, createdAt: serverTimestamp() }); } catch {}
    } catch(e){ Alert.alert('Error', e?.message || 'Failed to clear flag'); }
  };
  const manualFlagFromReport = async (postId)=>{
    if(!postId) return; try {
      await updateDoc(doc(db,'posts',postId), { flagged: true, reviewStatus:'pending', updatedAt: serverTimestamp() });
      Alert.alert('Flagged','Post was marked as flagged.');
      try { await addDoc(collection(db,'admin_audit_logs'), { action:'manual_flag', postId, adminUid: auth.currentUser?.uid||null, createdAt: serverTimestamp() }); } catch {}
    } catch(e){ Alert.alert('Error', e?.message || 'Failed to set flag'); }
  };
  const manualClearFromReport = async (postId)=>{
    if(!postId) return; try {
      await updateDoc(doc(db,'posts',postId), { flagged: false, updatedAt: serverTimestamp() });
      Alert.alert('Cleared','Post flag was cleared.');
      try { await addDoc(collection(db,'admin_audit_logs'), { action:'manual_flag_clear', postId, adminUid: auth.currentUser?.uid||null, createdAt: serverTimestamp() }); } catch {}
    } catch(e){ Alert.alert('Error', e?.message || 'Failed to clear flag'); }
  };

  const recheckOpenReports = async ()=>{
    try {
      setBusy(true);
      const token = await auth.currentUser?.getIdToken?.();
      if(!token){ Alert.alert('Auth required','Sign in as admin to run recheck.'); setBusy(false); return; }
      const projectId = auth?.app?.options?.projectId || 'calmspace-4c73f';
      const url = `https://us-central1-${projectId}.cloudfunctions.net/recheckReports`;
      const resp = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({}) });
      const data = await resp.json();
      if(!resp.ok) throw new Error(data?.error || 'Failed');
      Alert.alert('Recheck complete', `Checked ${data.checked||0}, auto-hidden ${data.hidden||0}.`);
      try { await addDoc(collection(db,'admin_audit_logs'), { action:'recheck_reports', result: data, adminUid: auth.currentUser?.uid||null, createdAt: serverTimestamp() }); } catch {}
    } catch(e){
      Alert.alert('Recheck failed', e.message || 'Unknown error');
    } finally { setBusy(false); }
  };

  const exportCsv = async()=>{
    try {
      const res = await adminExportReportsCsv({ status: statusFilter==='all'? 'all': statusFilter, limit: 2000 });
      Alert.alert('Export ready', 'CSV uploaded. Open link from audit log or Storage: ' + res.path);
    } catch(e){ Alert.alert('Export failed', e?.message||'Could not export'); }
  };

  return (
    <SafeAreaView style={{ flex:1, padding:16, backgroundColor: theme.bg }}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="shield-checkmark" size={28} color="#EF5350" />
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={[styles.title, { color: theme.text }]}>Content Moderation</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>Review & Manage Reports</Text>
        </View>
      </View>
      <View style={{ flexDirection:'row', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        {['open','resolved','dismissed','all'].map(s => (
          <Button key={s} title={s} onPress={()=> setStatusFilter(s)} color={statusFilter===s? '#0288D1' : undefined} />
        ))}
        {['any','flagged','pending'].map(s => (
          <Button key={s} title={s} onPress={()=> setToxFilter(s)} color={toxFilter===s? '#0288D1' : undefined} />
        ))}
        <Button title={busy? 'Rechecking…' : 'Recheck open reports'} onPress={recheckOpenReports} disabled={busy} />
        <Button title="Export CSV" onPress={exportCsv} />
      </View>

      {/* Manual Flags Utility */}
      <View style={{ backgroundColor: theme.card, borderRadius:12, padding:12, marginBottom:12 }}>
        <Text style={{ color: theme.text, fontWeight:'700', marginBottom:6 }}>Manual flags</Text>
        <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
          <TextInput
            placeholder='Post ID'
            placeholderTextColor={theme.textMuted}
            value={manualPostId}
            onChangeText={setManualPostId}
            autoCapitalize='none'
            autoCorrect={false}
            style={{ flex:1, paddingHorizontal:12, paddingVertical:8, borderRadius:10, backgroundColor: theme.bg === '#0B1722' ? '#10202f' : '#E3F2FD', color: theme.text }}
          />
          <Button title='Flag' onPress={manualFlagById} />
          <Button title='Clear' color='#2e7d32' onPress={manualClearById} />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(it)=> it.id}
        renderItem={({ item }) => {
          const m = postMeta[item.postId]||{};
          const isFlagged = m.flagged && !m.hidden;
          return (
            <GradientCard colors={isFlagged ? ['#FFA726', '#EF5350'] : ['#78909C', '#546E7A']} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name={isFlagged ? "warning" : "document-text"} size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight:'800', fontSize: 16, marginLeft: 8 }}>Post: {item.postId}</Text>
              </View>
              {isFlagged && <Text style={{ color:'#fff', fontWeight:'700', marginBottom: 4 }}>⚠️ Flagged</Text>}
              <Text style={{ color: '#fff', opacity: 0.9 }}>Reason: {item.reason}</Text>
              <Text style={{ color: '#fff', opacity: 0.9 }}>Status: {item.status}</Text>
              <Text style={{ color: '#fff', opacity: 0.9 }}>Toxicity: {m.toxicityScore? (m.toxicityScore*100).toFixed(0): '0'}% {m.toxicityReason? `• ${m.toxicityReason}`:''}</Text>
              {m.text && <Text style={{ color: '#fff', marginTop:6, fontStyle: 'italic' }} numberOfLines={3}>"{m.text}"</Text>}
              <View style={{ height:6 }} />
              <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
                <Button title="Dismiss" onPress={()=> dismiss(item)} />
                <Button title="Hide" color="#f57c00" onPress={()=> hidePost(item)} />
                <Button title="Approve+Unhide" color="#2e7d32" onPress={()=> approveAndUnhide(item)} />
                <Button title="Unhide" onPress={()=> unhidePost(item)} />
                <Button title="Delete" color="#c62828" onPress={()=> deletePost(item)} />
                <Button title="Manual Flag" onPress={()=> manualFlagFromReport(item.postId)} />
                <Button title="Clear Flag" onPress={()=> manualClearFromReport(item.postId)} />
              </View>
            </GradientCard>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(239, 83, 80, 0.2)' },
  iconBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFEBEE', justifyContent: 'center', alignItems: 'center', shadowColor: '#EF5350', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: 0.3 },
  subtitle: { fontSize: 14, fontWeight: '500', marginTop: 4 },
  card:{ padding:18, borderRadius:16, marginBottom:14, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, elevation:3, borderWidth:1, borderColor:'rgba(0,0,0,0.05)' }
});
