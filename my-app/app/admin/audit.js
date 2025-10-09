import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { db } from '../../firebase/firebaseConfig';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { safeSnapshot } from '../../src/utils/safeSnapshot';

export default function AdminAuditLog(){
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  useEffect(()=>{
    const q = query(collection(db,'admin_audit_logs'), orderBy('createdAt','desc'), limit(200));
    const unsub = safeSnapshot(q, (snap)=>{
      setItems(snap.docs.map(d=> ({ id:d.id, ...(d.data()||{}) })));
    });
    return ()=> { try { unsub(); } catch {} };
  },[]);
  const renderItem = ({ item }) => (
    <View style={[styles.card, { backgroundColor: theme.card }]}> 
      <Text style={{ color: theme.text, fontWeight:'700' }}>{item.action}</Text>
      <Text style={{ color: theme.textMuted }}>postId: {item.postId || '—'}  reportId: {item.reportId || '—'}</Text>
      <Text style={{ color: theme.textMuted }}>by: {item.adminUid || '—'} at {item.createdAt?.toDate? item.createdAt.toDate().toLocaleString() : '—'}</Text>
    </View>
  );
  return (
    <SafeAreaView style={{ flex:1, backgroundColor: theme.bg, padding:16 }}>
      <Text style={{ color: theme.text, fontSize:20, fontWeight:'800', marginBottom:10 }}>Audit Log</Text>
      <FlatList data={items} keyExtractor={(it)=> it.id} renderItem={renderItem} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  card:{ padding:18, borderRadius:16, marginBottom:14, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, elevation:3, borderWidth:1, borderColor:'rgba(0,0,0,0.05)' },
});
