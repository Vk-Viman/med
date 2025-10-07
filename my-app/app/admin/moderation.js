import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Button, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebase/firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function ModerationScreen(){
  const { theme } = useTheme();
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open'); // open | resolved | dismissed | all
  const filtered = useMemo(()=> reports.filter(r=> statusFilter==='all' ? true : r.status===statusFilter), [reports, statusFilter]);

  useEffect(()=>{
    const q = query(collection(db,'reports'), orderBy('createdAt','desc'));
    const unsub = onSnapshot(q, (snap)=>{
      setReports(snap.docs.map(d=> ({ id:d.id, ...d.data() })));
    });
    return ()=> { try { unsub(); } catch {} };
  },[]);

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

  return (
    <SafeAreaView style={{ flex:1, padding:16, backgroundColor: theme.bg }}>
      <Text style={{ color: theme.text, fontSize:20, fontWeight:'800', marginBottom:10 }}>Moderation</Text>
      <View style={{ flexDirection:'row', gap:8, marginBottom:10 }}>
        {['open','resolved','dismissed','all'].map(s => (
          <Button key={s} title={s} onPress={()=> setStatusFilter(s)} color={statusFilter===s? '#0288D1' : undefined} />
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(it)=> it.id}
        renderItem={({ item }) => (
          <View style={[styles.card,{ backgroundColor: theme.card }]}> 
            <Text style={{ color: theme.text, fontWeight:'700' }}>Post: {item.postId}</Text>
            <Text style={{ color: theme.textMuted }}>Reason: {item.reason}</Text>
            <Text style={{ color: theme.textMuted }}>Status: {item.status}</Text>
            <TouchableOpacity style={{ marginTop:6 }} onPress={()=> Alert.alert('Post preview', `Post ID: ${item.postId}\n(Use Admin -> Posts to view/edit full content)`) }>
              <Text style={{ color:'#0288D1', fontWeight:'700' }}>Quick view</Text>
            </TouchableOpacity>
            <View style={{ height:6 }} />
            <View style={{ flexDirection:'row', gap:8 }}>
              <Button title="Dismiss" onPress={()=> dismiss(item)} />
              <Button title="Hide" color="#f57c00" onPress={()=> hidePost(item)} />
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
