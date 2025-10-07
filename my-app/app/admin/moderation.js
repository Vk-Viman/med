import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Button, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../../firebase/firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function ModerationScreen(){
  const { theme } = useTheme();
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open'); // open | resolved | dismissed | all
  const [toxFilter, setToxFilter] = useState('any'); // any | flagged | pending
  const [postMeta, setPostMeta] = useState({}); // { [postId]: { toxicityScore, toxicityReason, flagged, hidden, reviewStatus, text, createdAt } }
  const [busy, setBusy] = useState(false);
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
    const unsub = onSnapshot(q, (snap)=>{
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
    try { await updateDoc(doc(db,'reports',r.id), { status:'dismissed' }); } catch {}
  };
  const hidePost = async (r)=>{
    try {
      await updateDoc(doc(db,'posts',r.postId), { hidden: true });
      await updateDoc(doc(db,'reports',r.id), { status:'resolved' });
      Alert.alert('Post hidden','The post has been hidden.');
    } catch {}
  };
  const approveAndUnhide = async (r)=>{
    try {
      await updateDoc(doc(db,'posts',r.postId), { hidden: false, reviewStatus:'approved' });
      await updateDoc(doc(db,'reports',r.id), { status:'resolved' });
      Alert.alert('Approved','The post has been unhidden.');
    } catch {}
  };
  const unhidePost = async (r)=>{
    try {
      await updateDoc(doc(db,'posts',r.postId), { hidden: false });
      Alert.alert('Post restored','The post is visible again.');
    } catch {}
  };
  const deletePost = async (r)=>{
    try {
      await deleteDoc(doc(db,'posts',r.postId));
      await updateDoc(doc(db,'reports',r.id), { status:'resolved' });
      Alert.alert('Post deleted','The post has been deleted.');
    } catch {}
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
    } catch(e){
      Alert.alert('Recheck failed', e.message || 'Unknown error');
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex:1, padding:16, backgroundColor: theme.bg }}>
      <Text style={{ color: theme.text, fontSize:20, fontWeight:'800', marginBottom:10 }}>Moderation</Text>
      <View style={{ flexDirection:'row', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        {['open','resolved','dismissed','all'].map(s => (
          <Button key={s} title={s} onPress={()=> setStatusFilter(s)} color={statusFilter===s? '#0288D1' : undefined} />
        ))}
        {['any','flagged','pending'].map(s => (
          <Button key={s} title={s} onPress={()=> setToxFilter(s)} color={toxFilter===s? '#0288D1' : undefined} />
        ))}
        <Button title={busy? 'Rechecking…' : 'Recheck open reports'} onPress={recheckOpenReports} disabled={busy} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(it)=> it.id}
        renderItem={({ item }) => (
          <View style={[styles.card,{ backgroundColor: theme.card }]}> 
            <Text style={{ color: theme.text, fontWeight:'700' }}>Post: {item.postId}</Text>
            {(() => { const m = postMeta[item.postId]||{}; return m.flagged && !m.hidden ? (
              <Text style={{ color:'#f57c00', fontWeight:'700' }}>Flagged</Text>
            ) : null; })()}
            <Text style={{ color: theme.textMuted }}>Reason: {item.reason}</Text>
            <Text style={{ color: theme.textMuted }}>Status: {item.status}</Text>
            {(() => { const m = postMeta[item.postId]||{}; return (
              <Text style={{ color: theme.textMuted }}>Toxicity: {m.toxicityScore? (m.toxicityScore*100).toFixed(0): '0'}% {m.toxicityReason? `• ${m.toxicityReason}`:''}</Text>
            ); })()}
            {/* Inline post preview text */}
            {(() => { const m = postMeta[item.postId]||{}; return m.text ? (
              <Text style={{ color: theme.text, marginTop:6 }} numberOfLines={3}>{m.text}</Text>
            ) : null; })()}
            <View style={{ height:6 }} />
            <View style={{ flexDirection:'row', gap:8 }}>
              <Button title="Dismiss" onPress={()=> dismiss(item)} />
              <Button title="Hide" color="#f57c00" onPress={()=> hidePost(item)} />
              <Button title="Approve+Unhide" color="#2e7d32" onPress={()=> approveAndUnhide(item)} />
              <Button title="Unhide" onPress={()=> unhidePost(item)} />
              <Button title="Delete" color="#c62828" onPress={()=> deletePost(item)} />
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card:{ padding:12, borderRadius:12, marginBottom:10 }
});
