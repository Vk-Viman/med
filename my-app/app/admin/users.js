import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { listUsers, updateUserRole, adminBanUser, adminUnbanUser } from '../../src/services/admin';
import { auth } from '../../firebase/firebaseConfig';

export default function AdminUsers(){
  const router = useRouter();
  const { theme } = useTheme();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  useEffect(()=>{ (async()=>{ try { const rows = await listUsers({ limit:100 }); setUsers(rows); } catch(e){ setErr(e?.message||'Failed to load users'); } setLoading(false); })(); },[]);
  const filtered = users.filter(u => (u.email||'').toLowerCase().includes(q.toLowerCase()) || (u.displayName||'').toLowerCase().includes(q.toLowerCase()));
  return (
    <View style={{ flex:1, backgroundColor: theme.bg }}>
      <View style={{ padding:12 }}>
        <TextInput placeholder='Search by name or email' placeholderTextColor={theme.textMuted} value={q} onChangeText={setQ} style={[styles.input, { color: theme.text, borderColor: '#90CAF9', backgroundColor: theme.bg === '#0B1722' ? '#0F1E2C' : '#ffffffAA' }]} />
      </View>
      {loading ? null : filtered.length === 0 ? (
        <View style={{ padding:16 }}>
          <Text style={{ color: theme.textMuted }}>
            {err ? `Could not load users (${err}). Ensure your account is admin (users/{uid}.userType = 'admin').` : 'No matching users.'}
          </Text>
        </View>
      ) : (
      <FlatList data={filtered} keyExtractor={(item)=> item.id} renderItem={({ item })=> {
        const isAdmin = String(item.userType||'').trim().toLowerCase() === 'admin';
  const isSelf = auth.currentUser?.uid === item.id;
  const isBanned = !!item.banned;
        const makeRole = async (role)=>{
          try{
            if (isSelf && role !== 'admin') {
              Alert.alert('Blocked', 'You cannot demote your own account.');
              return;
            }
            await updateUserRole(item.id, role);
            // Optimistic UI update
            setUsers(prev=> prev.map(u=> u.id===item.id? { ...u, userType: role } : u));
            Alert.alert('Updated', `Role set to ${role}.`);
          } catch(e){ Alert.alert('Error', e?.message || 'Failed to update role.'); }
        };
        return (
          <View style={[styles.row, { backgroundColor: theme.card }]}> 
            <TouchableOpacity onPress={()=> router.push(`/admin/user/${item.id}`)}>
              <Text style={[styles.name, { color: theme.text }]}>{item.displayName || '—'}</Text>
              <Text style={{ color: theme.textMuted, fontSize:12 }}>{item.email}</Text>
              <Text style={{ color: isAdmin? '#2E7D32':'#555', fontWeight:'700', marginTop:4 }}>{isAdmin? 'admin' : (item.userType||'user')}</Text>
              <View style={{ height:6 }} />
              {isBanned && <Text style={{ color:'#D32F2F', fontSize:12, fontWeight:'700' }}>BANNED</Text>}
              {item.lastActivity && <Text style={{ color: theme.textMuted, fontSize:12 }}>Last activity: {formatDate(item.lastActivity)}</Text>}
              {typeof item.entriesCount === 'number' && <Text style={{ color: theme.textMuted, fontSize:12 }}>Entries: {item.entriesCount}</Text>}
            </TouchableOpacity>
            <View style={{ height:8 }} />
            <View style={{ flexDirection:'row', gap:12 }}>
              {!isAdmin && (
                <TouchableOpacity onPress={()=> makeRole('admin')}>
                  <Text style={{ color:'#2E7D32', fontWeight:'700' }}>Make admin</Text>
                </TouchableOpacity>
              )}
              {isAdmin && !isSelf && (
                <TouchableOpacity onPress={()=> makeRole('user')}>
                  <Text style={{ color:'#F57C00', fontWeight:'700' }}>Make user</Text>
                </TouchableOpacity>
              )}
              {!isBanned && (
                <TouchableOpacity onPress={async()=>{
                  try {
                    await adminBanUser(item.id, 'Policy violation');
                    setUsers(prev=> prev.map(u=> u.id===item.id? { ...u, banned: true } : u));
                    Alert.alert('Banned','User has been banned.');
                  } catch(e){ Alert.alert('Error', e?.message||'Failed to ban'); }
                }}>
                  <Text style={{ color:'#D32F2F', fontWeight:'700' }}>Ban</Text>
                </TouchableOpacity>
              )}
              {isBanned && (
                <TouchableOpacity onPress={async()=>{
                  try {
                    await adminUnbanUser(item.id);
                    setUsers(prev=> prev.map(u=> u.id===item.id? { ...u, banned: false } : u));
                    Alert.alert('Unbanned','User has been unbanned.');
                  } catch(e){ Alert.alert('Error', e?.message||'Failed to unban'); }
                }}>
                  <Text style={{ color:'#2E7D32', fontWeight:'700' }}>Unban</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      }} contentContainerStyle={{ padding:12, gap:10 }} />
      )}
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
