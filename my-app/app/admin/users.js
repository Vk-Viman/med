import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { listUsers } from '../../src/services/admin';

export default function AdminUsers(){
  const router = useRouter();
  const { theme } = useTheme();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ (async()=>{ try { const rows = await listUsers({ limit:100 }); setUsers(rows); } catch{} setLoading(false); })(); },[]);
  const filtered = users.filter(u => (u.email||'').toLowerCase().includes(q.toLowerCase()) || (u.displayName||'').toLowerCase().includes(q.toLowerCase()));
  return (
    <View style={{ flex:1, backgroundColor: theme.bg }}>
      <View style={{ padding:12 }}>
        <TextInput placeholder='Search by name or email' placeholderTextColor={theme.textMuted} value={q} onChangeText={setQ} style={[styles.input, { color: theme.text, borderColor: '#90CAF9', backgroundColor: theme.bg === '#0B1722' ? '#0F1E2C' : '#ffffffAA' }]} />
      </View>
      <FlatList data={filtered} keyExtractor={(item)=> item.id} renderItem={({ item })=> (
        <TouchableOpacity onPress={()=> router.push(`/admin/user/${item.id}`)} style={[styles.row, { backgroundColor: theme.card }]}> 
          <Text style={[styles.name, { color: theme.text }]}>{item.displayName || '—'}</Text>
          <Text style={{ color: theme.textMuted, fontSize:12 }}>{item.email}</Text>
          <Text style={{ color: item.userType==='admin'? '#2E7D32':'#555', fontWeight:'700', marginTop:4 }}>{item.userType || 'user'}</Text>
          <View style={{ height:6 }} />
          {item.lastActivity && <Text style={{ color: theme.textMuted, fontSize:12 }}>Last activity: {formatDate(item.lastActivity)}</Text>}
          {typeof item.entriesCount === 'number' && <Text style={{ color: theme.textMuted, fontSize:12 }}>Entries: {item.entriesCount}</Text>}
        </TouchableOpacity>
      )} contentContainerStyle={{ padding:12, gap:10 }} />
    </View>
  );
}
const styles = StyleSheet.create({
  input:{ height:44, borderWidth:1, borderRadius:12, paddingHorizontal:10 },
  row:{ padding:12, borderRadius:12 },
  name:{ fontSize:14, fontWeight:'700' }
});

function formatDate(ts){
  try {
    if(!ts) return '';
    // Firestore Timestamp or JS Date
    let d;
    if(ts && typeof ts.toDate === 'function'){ d = ts.toDate(); }
    else if(ts instanceof Date){ d = ts; }
    else if(typeof ts === 'number'){ d = new Date(ts); }
    else return '';
    const pad = n=> String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}
