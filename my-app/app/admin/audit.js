import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import GradientCard from '../../src/components/GradientCard';
import { db } from '../../firebase/firebaseConfig';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { safeSnapshot } from '../../src/utils/safeSnapshot';
import ShimmerCard from '../../src/components/ShimmerCard';
import SkeletonLoader from '../../src/components/SkeletonLoader';

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
    <GradientCard colors={['#78909C', '#546E7A']} style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Ionicons name="document-text" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight:'800', fontSize: 16, marginLeft: 8 }}>{item.action}</Text>
      </View>
      <Text style={{ color: '#fff', opacity: 0.9 }}>postId: {item.postId || '—'}  reportId: {item.reportId || '—'}</Text>
      <Text style={{ color: '#fff', opacity: 0.9, fontSize: 12, marginTop: 2 }}>by: {item.adminUid || '—'}</Text>
      <Text style={{ color: '#fff', opacity: 0.8, fontSize: 11, marginTop: 2 }}>at {item.createdAt?.toDate? item.createdAt.toDate().toLocaleString() : '—'}</Text>
    </GradientCard>
  );
  return (
    <SafeAreaView style={{ flex:1, backgroundColor: theme.bg, padding:16 }}>
      <ShimmerCard colors={['#CFD8DC', '#B0BEC5', '#90A4AE']} shimmerSpeed={3000}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(120, 144, 156, 0.2)' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#ECEFF1', justifyContent: 'center', alignItems: 'center', shadowColor: '#78909C', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
            <Ionicons name="newspaper" size={28} color="#78909C" />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: 0.3, color: theme.text }}>Audit Log</Text>
            <Text style={{ fontSize: 14, fontWeight: '500', marginTop: 4, color: theme.textMuted }}>Admin Action History</Text>
          </View>
        </View>
      </ShimmerCard>
      <FlatList data={items} keyExtractor={(it)=> it.id} renderItem={renderItem} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  card:{ padding:18, borderRadius:16, marginBottom:14, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, elevation:3, borderWidth:1, borderColor:'rgba(0,0,0,0.05)' },
});
