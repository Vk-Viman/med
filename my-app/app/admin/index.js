import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { listUsersCount } from '../../src/services/admin';
import { db } from '../../firebase/firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import ShimmerCard from '../../src/components/ShimmerCard';

export default function AdminHome(){
  const router = useRouter();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isNarrow = width < 360;
  const [counts, setCounts] = useState({ users: 0, meditations: 0, plans: 0, flagged: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ 
    (async()=>{ 
      try { const c = await listUsersCount(); setCounts(p=>({ ...p, users: c })); }
      catch {}
      finally { setLoading(false); }
    })(); 
  },[]);

  useEffect(()=>{
    (async()=>{
      try{
        const qRef = query(collection(db,'reports'), where('status','==','open'));
        const s = await getDocs(qRef);
        setCounts(p=>({ ...p, flagged: s.size }));
      }catch{}
    })();
  },[]);

  const actions = useMemo(() => ([
    { key: 'users', icon: 'people', label: 'Users', route: '/admin/users' },
    { key: 'moderation', icon: 'shield-checkmark', label: 'Moderation', route: '/admin/moderation' },
    { key: 'settings', icon: 'settings', label: 'Settings', route: '/admin/settings' },
    { key: 'mutes', icon: 'volume-mute', label: 'Mutes', route: '/admin/mutes' },
    { key: 'analytics', icon: 'analytics', label: 'Analytics', route: '/admin/analytics' },
    { key: 'privacy', icon: 'lock-closed', label: 'Privacy', route: '/admin/privacy' },
    { key: 'profile', icon: 'person', label: 'Profile', route: '/admin/profile' },
    { key: 'meditations', icon: 'leaf', label: 'Meditations', route: '/admin/meditations' },
    { key: 'plans', icon: 'calendar', label: 'Plans', route: '/admin/plans' },
    { key: 'community', icon: 'people-circle', label: 'Community', route: '/admin/community' },
    { key: 'badges', icon: 'trophy', label: 'Badges', route: '/admin/badges' },
    { key: 'audit', icon: 'list', label: 'Audit Log', route: '/admin/audit' },
    { key: 'broadcast', icon: 'megaphone', label: 'Broadcast', route: '/admin/broadcast' },
  ]), []);

  return (
    <SafeAreaView style={{ flex:1, backgroundColor: theme.bg }}>
      <FlatList
        contentContainerStyle={{ padding:16, paddingBottom: 80 }}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps='handled'
        numColumns={isNarrow ? 1 : 2}
        data={actions}
        keyExtractor={(item)=> item.key}
        columnWrapperStyle={!isNarrow ? { gap: 12 } : undefined}
        ListHeaderComponent={(
          <View>
            <ShimmerCard colors={['#E8EAF6', '#C5CAE9', '#9FA8DA']} style={{ marginBottom: 20, borderRadius: 16, padding: 16 }} shimmerSpeed={3500}>
              <View style={styles.header}>
                <View style={styles.iconBadge}>
                  <Ionicons name="shield-checkmark" size={28} color="#0288D1" />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={[styles.title, { color: theme.text }]}>Admin Dashboard</Text>
                  <Text style={[styles.subtitle, { color: theme.textMuted }]}>Manage and monitor your app</Text>
                </View>
              </View>
            </ShimmerCard>

            <View style={styles.cardsPlainRow}>
              <View style={[styles.statPlain, { backgroundColor: theme.card }]}>
                <Ionicons name="people" size={18} color={theme.text} />
                <Text style={[styles.statPlainValue, { color: theme.text }]}>{counts.users}</Text>
                <Text style={[styles.statPlainLabel, { color: theme.textMuted }]}>Users</Text>
              </View>
              <View style={[styles.statPlain, { backgroundColor: theme.card }]}>
                <Ionicons name="leaf" size={18} color={theme.text} />
                <Text style={[styles.statPlainValue, { color: theme.text }]}>0</Text>
                <Text style={[styles.statPlainLabel, { color: theme.textMuted }]}>Meditations</Text>
              </View>
            </View>
            <View style={styles.cardsPlainRow}>
              <View style={[styles.statPlain, { backgroundColor: theme.card }]}>
                <Ionicons name="calendar" size={18} color={theme.text} />
                <Text style={[styles.statPlainValue, { color: theme.text }]}>0</Text>
                <Text style={[styles.statPlainLabel, { color: theme.textMuted }]}>Plans</Text>
              </View>
              <View style={[styles.statPlain, { backgroundColor: theme.card }]}>
                <Ionicons name="warning" size={18} color={theme.text} />
                <Text style={[styles.statPlainValue, { color: theme.text }]}>{counts.flagged}</Text>
                <Text style={[styles.statPlainLabel, { color: theme.textMuted }]}>Reports</Text>
              </View>
            </View>
            <View style={{ height: 20 }} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Admin Tools</Text>
            <Text style={{ color: theme.textMuted, fontSize: 10, marginTop: 2 }}>v-idx-2</Text>
          </View>
        )}
        ListFooterComponent={<View style={{ height: 40 }} />}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed })=> [
              styles.gridCard,
              isNarrow && styles.gridCardFull,
              pressed && styles.gridPressed,
              { backgroundColor: theme.card, marginBottom: 12 }
            ]}
            onPress={() => router.push(item.route)}
            accessibilityLabel={item.label}
            accessibilityRole='button'
          >
            <Ionicons name={item.icon} size={26} color="#0288D1" />
            <Text style={[styles.gridLabel, { color: theme.text }]}>{item.label}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  cardsPlainRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statPlain: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statPlainValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  statPlainLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.2,
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
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minHeight: 88,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  gridCard: {
    flex: 1,
    minHeight: 110,
    aspectRatio: 1.3,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  gridCardFull: {
    width: '100%',
    aspectRatio: 3.5,
  },
  gridPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    letterSpacing: 0.2,
  },
});
