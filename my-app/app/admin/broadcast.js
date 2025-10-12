import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import GradientCard from '../../src/components/GradientCard';
import { db, auth } from '../../firebase/firebaseConfig';
import { collection, getDocs, query, orderBy, limit, startAfter, doc } from 'firebase/firestore';
import { inboxAdd } from '../../src/services/inbox';
import ShimmerCard from '../../src/components/ShimmerCard';
import PulseButton from '../../src/components/PulseButton';

/* Broadcast screen
   Fan-out an announcement/digest to all users by iterating the users collection in pages.
   CAUTION: This is client-only and should be rate limited; only exposed to admins (ensure route protected elsewhere).
*/
export default function AdminBroadcast(){
  const { theme } = useTheme();
  const [title, setTitle] = useState('Weekly Digest');
  const [body, setBody] = useState('Here is your weekly community summary.');
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [estimate, setEstimate] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(()=>{
    (async()=>{
      try {
        const uid = auth.currentUser?.uid; if(!uid){ setAllowed(false); setChecking(false); return; }
        const profSnap = await getDocs(query(collection(db,'users'), limit(1))); // placeholder to ensure permission
      } catch {}
      try {
        const uid = auth.currentUser?.uid; if(!uid){ setAllowed(false); return; }
        const pRef = doc(db,'users',uid);
        const pSnap = await getDocs(query(collection(db,'users'), limit(1))); // minimal side-effect
      } catch {}
      try {
        const uid = auth.currentUser?.uid; if(!uid){ setAllowed(false); setChecking(false); return; }
        const profDoc = await (await import('firebase/firestore')).getDoc(doc(db,'users',uid));
        const role = profDoc?.data()?.role || '';
        setAllowed(role==='admin' || role==='superadmin');
      } catch { setAllowed(false); }
      setChecking(false);
    })();
  }, [auth.currentUser?.uid]);

  const loadEstimate = async ()=>{
    try { const snap = await getDocs(query(collection(db,'users'), limit(1))); setEstimate(snap.size>=0? 'Unknown (requires aggregate)': ''); } catch {}
  };

  const fanOut = async ()=>{
    if(!title.trim() || !body.trim()) return Alert.alert('Missing','Title and body required.');
    if(sending) return;
    Alert.alert('Confirm broadcast', 'Send this notification to all users?', [
      { text:'Cancel', style:'cancel' },
      { text:'Send', style:'destructive', onPress: async ()=>{
        setSending(true); setSentCount(0);
        try {
          let last=null; const pageSize=200; let pages=0; const started=Date.now();
          while(true){
            let qRef = query(collection(db,'users'), orderBy('createdAt','desc'), limit(pageSize));
            if(last) qRef = query(collection(db,'users'), orderBy('createdAt','desc'), startAfter(last), limit(pageSize));
            const snap = await getDocs(qRef);
            if(snap.empty) break;
            for(const d of snap.docs){
              try { await inboxAdd({ uid:d.id, type:'digest', title:title.trim(), body: body.trim().slice(0,180) }); setSentCount(c=> c+1); } catch {}
            }
            last = snap.docs[snap.docs.length-1];
            pages++; if(pages>50){ break; } // safety cap
            // Brief yield to UI
            await new Promise(r=> setTimeout(r, 100));
          }
          const duration = Math.round((Date.now()-started)/1000);
          Alert.alert('Done', `Broadcast sent to ~${sentCount} users in ${duration}s`);
        } catch(e){
          Alert.alert('Failed', e?.message || 'Broadcast failed');
        } finally { setSending(false); }
      }}
    ]);
  };

  if(checking){
    return (
      <SafeAreaView style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary||'#0288D1'} />
        <Text style={{ marginTop:12, color: theme.textMuted }}>Checking access…</Text>
      </SafeAreaView>
    );
  }
  if(!allowed){
    return (
      <SafeAreaView style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: theme.bg }}>
        <Text style={{ color: theme.text, fontSize:18, fontWeight:'700', marginBottom:8 }}>Access Denied</Text>
        <Text style={{ color: theme.textMuted, textAlign:'center', paddingHorizontal:32 }}>You do not have permission to send global broadcasts. Contact an administrator.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex:1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding:16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(38, 166, 154, 0.2)' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#E0F2F1', justifyContent: 'center', alignItems: 'center', shadowColor: '#26A69A', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
            <Ionicons name="megaphone" size={28} color="#26A69A" />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: 0.3, color: theme.text }}>Broadcast Messages</Text>
            <Text style={{ fontSize: 14, fontWeight: '500', marginTop: 4, color: theme.textMuted }}>Send Announcements to All Users</Text>
          </View>
        </View>
        <Text style={{ color: theme.textMuted, marginBottom:20, fontSize:15, lineHeight:22 }}>Send a one-time inbox notification to every user. Use sparingly. This runs client-side and pages through users (no Cloud Functions).</Text>
        <Text style={{ fontWeight:'700', color: theme.text, fontSize:15, marginBottom:6, letterSpacing:0.2 }}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder='Announcement title' placeholderTextColor={theme.textMuted} style={{ borderWidth:2, borderColor: theme.border||'#90CAF9', borderRadius:14, padding:14, color: theme.text, marginTop:4, marginBottom:16, fontSize:15, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 }} />
        <Text style={{ fontWeight:'700', color: theme.text, fontSize:15, marginBottom:6, letterSpacing:0.2 }}>Body</Text>
        <TextInput value={body} onChangeText={setBody} placeholder='Summary body (<=180 chars)' placeholderTextColor={theme.textMuted} multiline style={{ borderWidth:2, borderColor: theme.border||'#90CAF9', borderRadius:14, padding:14, color: theme.text, marginTop:4, height:140, marginBottom:16, textAlignVertical:'top', fontSize:15, lineHeight:22, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 }} />
        <PrimaryButton title={sending? `Sending… ${sentCount}` : 'Send Broadcast'} onPress={fanOut} disabled={sending} fullWidth />
        <View style={{ height:16 }} />
        {sending && (
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <ActivityIndicator color={theme.primary||'#0288D1'} />
            <Text style={{ color: theme.textMuted, fontSize:12 }}>Processing… Keep app open.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
