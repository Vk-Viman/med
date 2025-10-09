import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import { listUsersCount } from '../../src/services/admin';
import { db } from '../../firebase/firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';

export default function AdminHome(){
  const router = useRouter();
  const { theme } = useTheme();
  const [counts, setCounts] = useState({ users: 0, meditations: 0, plans: 0, flagged: 0 });
  useEffect(()=>{ (async()=>{ try { const c = await listUsersCount(); setCounts(p=>({ ...p, users: c })); } catch{} })(); },[]);
  useEffect(()=>{
    (async()=>{
      try{
        const qRef = query(collection(db,'reports'), where('status','==','open'));
        const s = await getDocs(qRef);
        setCounts(p=>({ ...p, flagged: s.size }));
      }catch{
        // ignore for non-admin or permission-denied
      }
    })();
  },[]);
  return (
    <ScrollView style={{ flex:1, backgroundColor: theme.bg }} contentContainerStyle={{ padding:16 }}>
      <Text style={[styles.title, { color: theme.text }]}>Admin Dashboard</Text>
      <View style={styles.cardsRow}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.metric, { color: theme.text }]}>{counts.users}</Text>
          <Text style={[styles.label, { color: theme.textMuted }]}>Users</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.metric, { color: theme.text }]}>0</Text>
          <Text style={[styles.label, { color: theme.textMuted }]}>Meditations</Text>
        </View>
      </View>
      <View style={styles.cardsRow}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.metric, { color: theme.text }]}>0</Text>
          <Text style={[styles.label, { color: theme.textMuted }]}>Plans</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.metric, { color: theme.text }]}>{counts.flagged}</Text>
          <Text style={[styles.label, { color: theme.textMuted }]}>Open Reports</Text>
        </View>
      </View>
      <View style={{ height: 12 }} />
  <PrimaryButton title="Manage Users" onPress={()=> router.push('/admin/users')} fullWidth />
      <View style={{ height: 8 }} />
  <PrimaryButton title="Moderation" onPress={()=> router.push('/admin/moderation')} fullWidth variant='secondary' />
  <View style={{ height: 8 }} />
  <PrimaryButton title="Admin Settings" onPress={()=> router.push('/admin/settings')} fullWidth variant='secondary' />
  <View style={{ height: 8 }} />
  <PrimaryButton title="Global Mutes" onPress={()=> router.push('/admin/mutes')} fullWidth variant='secondary' />
  <View style={{ height: 8 }} />
  <PrimaryButton title="Analytics" onPress={()=> router.push('/admin/analytics')} fullWidth variant='secondary' />
  <View style={{ height: 8 }} />
  <PrimaryButton title="Privacy Center" onPress={()=> router.push('/admin/privacy')} fullWidth variant='secondary' />
  <View style={{ height: 8 }} />
  <PrimaryButton title="Admin Profile" onPress={()=> router.push('/admin/profile')} fullWidth variant='secondary' />
  <View style={{ height: 8 }} />
      <PrimaryButton title="Meditations" onPress={()=> router.push('/admin/meditations')} fullWidth variant='secondary' />
      <View style={{ height: 8 }} />
      <PrimaryButton title="Plans" onPress={()=> router.push('/admin/plans')} fullWidth variant='secondary' />
      <View style={{ height: 8 }} />
      <PrimaryButton title="Community" onPress={()=> router.push('/admin/community')} fullWidth variant='secondary' />
      <View style={{ height: 8 }} />
      <PrimaryButton title="Badges" onPress={()=> router.push('/admin/badges')} fullWidth variant='secondary' />
      <View style={{ height: 8 }} />
      <PrimaryButton title="Audit Log" onPress={()=> router.push('/admin/audit')} fullWidth variant='secondary' />
      <View style={{ height: 8 }} />
      <PrimaryButton title="Broadcast" onPress={()=> router.push('/admin/broadcast')} fullWidth variant='secondary' />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title:{ fontSize:28, fontWeight:'800', marginBottom:20, letterSpacing: 0.3 },
  cardsRow:{ flexDirection:'row', gap:16, marginBottom:16 },
  card:{ flex:1, padding:20, borderRadius:16, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, elevation:3, borderWidth:1, borderColor:'rgba(0,0,0,0.05)' },
  metric:{ fontSize:32, fontWeight:'800', letterSpacing: 0.2 },
  label:{ fontSize:13, fontWeight:'700', marginTop:6, letterSpacing: 0.2 },
});
