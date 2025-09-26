import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { listUserMoodMeta } from '../../../../src/services/admin';

export default function AdminUserMoods(){
  const { uid } = useLocalSearchParams();
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ (async()=>{ try { setItems(await listUserMoodMeta(String(uid), { limit: 50 })); } catch{} setLoading(false); })(); }, [uid]);
  return (
    <View style={{ flex:1, backgroundColor: theme.bg, padding:12 }}>
      {loading ? (
        <Text style={{ color: theme.text }}>Loading...</Text>
      ) : (
        <FlatList data={items} keyExtractor={(it)=> it.id} renderItem={({ item })=> (
          <View style={{ padding:12, borderRadius:12, backgroundColor: theme.card, marginBottom:8 }}>
            <Text style={{ color: theme.text, fontWeight:'700' }}>{item.id}</Text>
            <Text style={{ color: theme.textMuted, fontSize:12 }}>{item.createdAt?.seconds ? new Date(item.createdAt.seconds*1000).toLocaleString() : '(no date)'}</Text>
          </View>
        )} />
      )}
    </View>
  );
}
