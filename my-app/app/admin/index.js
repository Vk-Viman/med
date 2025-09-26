import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import { listUsersCount } from '../../src/services/admin';

export default function AdminHome(){
  const router = useRouter();
  const { theme } = useTheme();
  const [counts, setCounts] = useState({ users: 0, meditations: 0, plans: 0, flagged: 0 });
  useEffect(()=>{ (async()=>{ try { const c = await listUsersCount(); setCounts(p=>({ ...p, users: c })); } catch{} })(); },[]);
  return (
    <ScrollView style={{ flex:1, backgroundColor: theme.bg }} contentContainerStyle={{ padding:16 }}>
      <Text style={[styles.title, { color: theme.text }]}>Admin Dashboard</Text>
      <View style={styles.cardsRow}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.metric, { color: theme.text }]}>{counts.users}</Text>
          <Text style={[styles.label, { color: theme.textMuted }]}>Users</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.metric, { color: theme.text }]}>{counts.meditations}</Text>
          <Text style={[styles.label, { color: theme.textMuted }]}>Meditations</Text>
        </View>
      </View>
      <View style={styles.cardsRow}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.metric, { color: theme.text }]}>{counts.plans}</Text>
          <Text style={[styles.label, { color: theme.textMuted }]}>Plans</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.metric, { color: theme.text }]}>{counts.flagged}</Text>
          <Text style={[styles.label, { color: theme.textMuted }]}>Flagged Posts</Text>
        </View>
      </View>
      <View style={{ height: 12 }} />
  <PrimaryButton title="Manage Users" onPress={()=> router.push('/admin/users')} fullWidth />
      <View style={{ height: 8 }} />
  <PrimaryButton title="Admin Settings" onPress={()=> router.push('/admin/settings')} fullWidth variant='secondary' />
  <View style={{ height: 8 }} />
  <PrimaryButton title="Privacy Center" onPress={()=> router.push('/admin/privacy')} fullWidth variant='secondary' />
  <View style={{ height: 8 }} />
      <PrimaryButton title="Meditations" onPress={()=> router.push('/admin/meditations')} fullWidth variant='secondary' />
      <View style={{ height: 8 }} />
      <PrimaryButton title="Plans" onPress={()=> router.push('/admin/plans')} fullWidth variant='secondary' />
      <View style={{ height: 8 }} />
      <PrimaryButton title="Community" onPress={()=> router.push('/admin/community')} fullWidth variant='secondary' />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title:{ fontSize:22, fontWeight:'800', marginBottom:12 },
  cardsRow:{ flexDirection:'row', gap:12, marginBottom:12 },
  card:{ flex:1, padding:16, borderRadius:12 },
  metric:{ fontSize:24, fontWeight:'800' },
  label:{ fontSize:12, fontWeight:'600' },
});
