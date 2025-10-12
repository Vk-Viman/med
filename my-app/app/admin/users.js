import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import GradientCard from '../../src/components/GradientCard';
import { listUsers, updateUserRole, adminBanUser, adminUnbanUser } from '../../src/services/admin';
import { auth } from '../../firebase/firebaseConfig';
import ShimmerCard from '../../src/components/ShimmerCard';

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
      {/* Professional Header */}
      <ShimmerCard colors={['#E1F5FE', '#B3E5FC', '#81D4FA']} shimmerSpeed={3000}>
        <View style={[styles.header, { borderBottomColor: theme.bg === '#0B1722' ? '#1E3A4C' : '#E0E0E0' }]}>
          <View style={styles.iconBadge}>
            <Ionicons name="people" size={28} color="#0288D1" />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={[styles.title, { color: theme.text }]}>User Management</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>Manage roles and permissions</Text>
          </View>
        </View>
      </ShimmerCard>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E1F5FE',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0288D1',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  input:{ height:52, borderWidth:2, borderRadius:14, paddingHorizontal:16, fontSize:15, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  row:{ padding:18, borderRadius:16, shadowColor:'#0288D1', shadowOpacity:0.12, shadowRadius:10, elevation:4, borderWidth:1, borderColor:'rgba(2,136,209,0.1)', marginBottom:8 },
  name:{ fontSize:16, fontWeight:'800', letterSpacing:0.2 }
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
