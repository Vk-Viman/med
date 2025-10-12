import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import GradientCard from '../../src/components/GradientCard';
import AnimatedButton from '../../src/components/AnimatedButton';
import { listUsersCount } from '../../src/services/admin';
import { db } from '../../firebase/firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import ShimmerCard from '../../src/components/ShimmerCard';
import SkeletonLoader from '../../src/components/SkeletonLoader';

export default function AdminHome(){
  const router = useRouter();
  const { theme } = useTheme();
  const [counts, setCounts] = useState({ users: 0, meditations: 0, plans: 0, flagged: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ 
    (async()=>{ 
      try { 
        const c = await listUsersCount(); 
        setCounts(p=>({ ...p, users: c })); 
      } catch{} 
      finally { setLoading(false); }
    })(); 
  },[]);
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
      {/* Professional Header with Shimmer */}
      <ShimmerCard 
        colors={['#E8EAF6', '#C5CAE9', '#9FA8DA']}
        style={{ marginBottom: 20, borderRadius: 16, padding: 16 }}
        shimmerSpeed={3500}
      >
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="shield-checkmark" size={28} color="#0288D1" />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={[styles.title, { color: theme.text }]}>Admin Dashboard</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>Manage your meditation app</Text>
          </View>
        </View>
      </ShimmerCard>

      {/* Stats Cards with Shimmer */}
      {loading ? (
        <>
          <View style={styles.cardsRow}>
            <SkeletonLoader height={120} style={{ flex: 1, marginRight: 8, borderRadius: 16 }} />
            <SkeletonLoader height={120} style={{ flex: 1, marginLeft: 8, borderRadius: 16 }} />
          </View>
          <View style={styles.cardsRow}>
            <SkeletonLoader height={120} style={{ flex: 1, marginRight: 8, borderRadius: 16 }} />
            <SkeletonLoader height={120} style={{ flex: 1, marginLeft: 8, borderRadius: 16 }} />
          </View>
        </>
      ) : (
        <>
          <View style={styles.cardsRow}>
            <ShimmerCard colors={['#0288D1', '#0277BD', '#01579B']} style={styles.statCard} shimmerSpeed={3000}>
              <GradientCard colors={['#0288D1', '#01579B']} style={styles.statCard}>
                <Ionicons name="people" size={32} color="#FFFFFF" />
                <Text style={styles.statValue}>{counts.users}</Text>
                <Text style={styles.statLabel}>Users</Text>
              </GradientCard>
            </ShimmerCard>
            <ShimmerCard colors={['#66BB6A', '#4CAF50', '#43A047']} style={styles.statCard} shimmerSpeed={3200}>
              <GradientCard colors={['#66BB6A', '#43A047']} style={styles.statCard}>
                <Ionicons name="leaf" size={32} color="#FFFFFF" />
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Meditations</Text>
              </GradientCard>
            </ShimmerCard>
          </View>
          <View style={styles.cardsRow}>
            <ShimmerCard colors={['#AB47BC', '#9C27B0', '#8E24AA']} style={styles.statCard} shimmerSpeed={3400}>
              <GradientCard colors={['#AB47BC', '#8E24AA']} style={styles.statCard}>
                <Ionicons name="calendar" size={32} color="#FFFFFF" />
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Plans</Text>
              </GradientCard>
            </ShimmerCard>
            <ShimmerCard 
              colors={['#EF5350', '#F44336', '#C62828']} 
              style={styles.statCard} 
              shimmerSpeed={2800}
              enabled={counts.flagged > 0}
            >
              <GradientCard colors={['#EF5350', '#C62828']} style={styles.statCard}>
                <Ionicons name="warning" size={32} color="#FFFFFF" />
                <Text style={styles.statValue}>{counts.flagged}</Text>
                <Text style={styles.statLabel}>Reports</Text>
              </GradientCard>
            </ShimmerCard>
          </View>
        </>
      )}
      <View style={{ height: 20 }} />
      
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
      <View style={styles.gridContainer}>
        <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed, { backgroundColor: theme.card }]} onPress={()=> router.push('/admin/users')} accessibilityLabel="Manage Users" accessibilityRole='button'>
          <Ionicons name='people' size={26} color="#0288D1" />
          <Text style={[styles.gridLabel,{ color: theme.text }]}>Users</Text>
        </Pressable>
        
        <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed, { backgroundColor: theme.card }]} onPress={()=> router.push('/admin/moderation')} accessibilityLabel="Moderation" accessibilityRole='button'>
          <Ionicons name='shield-checkmark' size={26} color="#0288D1" />
          <Text style={[styles.gridLabel,{ color: theme.text }]}>Moderation</Text>
        </Pressable>
        
        <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed, { backgroundColor: theme.card }]} onPress={()=> router.push('/admin/settings')} accessibilityLabel="Admin Settings" accessibilityRole='button'>
          <Ionicons name='settings' size={26} color="#0288D1" />
          <Text style={[styles.gridLabel,{ color: theme.text }]}>Settings</Text>
        </Pressable>
        
        <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed, { backgroundColor: theme.card }]} onPress={()=> router.push('/admin/mutes')} accessibilityLabel="Global Mutes" accessibilityRole='button'>
          <Ionicons name='volume-mute' size={26} color="#0288D1" />
          <Text style={[styles.gridLabel,{ color: theme.text }]}>Mutes</Text>
        </Pressable>
        
        <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed, { backgroundColor: theme.card }]} onPress={()=> router.push('/admin/analytics')} accessibilityLabel="Analytics" accessibilityRole='button'>
          <Ionicons name='analytics' size={26} color="#0288D1" />
          <Text style={[styles.gridLabel,{ color: theme.text }]}>Analytics</Text>
        </Pressable>
        
        <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed, { backgroundColor: theme.card }]} onPress={()=> router.push('/admin/privacy')} accessibilityLabel="Privacy Center" accessibilityRole='button'>
          <Ionicons name='lock-closed' size={26} color="#0288D1" />
          <Text style={[styles.gridLabel,{ color: theme.text }]}>Privacy</Text>
        </Pressable>
        
        <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed, { backgroundColor: theme.card }]} onPress={()=> router.push('/admin/profile')} accessibilityLabel="Admin Profile" accessibilityRole='button'>
          <Ionicons name='person' size={26} color="#0288D1" />
          <Text style={[styles.gridLabel,{ color: theme.text }]}>Profile</Text>
        </Pressable>
        
        <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed, { backgroundColor: theme.card }]} onPress={()=> router.push('/admin/meditations')} accessibilityLabel="Meditations" accessibilityRole='button'>
          <Ionicons name='leaf' size={26} color="#0288D1" />
          <Text style={[styles.gridLabel,{ color: theme.text }]}>Meditations</Text>
        </Pressable>
        
        <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed, { backgroundColor: theme.card }]} onPress={()=> router.push('/admin/plans')} accessibilityLabel="Plans" accessibilityRole='button'>
          <Ionicons name='calendar' size={26} color="#0288D1" />
          <Text style={[styles.gridLabel,{ color: theme.text }]}>Plans</Text>
        </Pressable>
        
        <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed, { backgroundColor: theme.card }]} onPress={()=> router.push('/admin/community')} accessibilityLabel="Community" accessibilityRole='button'>
          <Ionicons name='people-circle' size={26} color="#0288D1" />
          <Text style={[styles.gridLabel,{ color: theme.text }]}>Community</Text>
        </Pressable>
        
        <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed, { backgroundColor: theme.card }]} onPress={()=> router.push('/admin/badges')} accessibilityLabel="Badges" accessibilityRole='button'>
          <Ionicons name='trophy' size={26} color="#0288D1" />
          <Text style={[styles.gridLabel,{ color: theme.text }]}>Badges</Text>
        </Pressable>
        
        <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed, { backgroundColor: theme.card }]} onPress={()=> router.push('/admin/audit')} accessibilityLabel="Audit Log" accessibilityRole='button'>
          <Ionicons name='list' size={26} color="#0288D1" />
          <Text style={[styles.gridLabel,{ color: theme.text }]}>Audit Log</Text>
        </Pressable>
        
        <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed, { backgroundColor: theme.card }]} onPress={()=> router.push('/admin/broadcast')} accessibilityLabel="Broadcast" accessibilityRole='button'>
          <Ionicons name='megaphone' size={26} color="#0288D1" />
          <Text style={[styles.gridLabel,{ color: theme.text }]}>Broadcast</Text>
        </Pressable>
      </View>
    </ScrollView>
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
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
    letterSpacing: 0.2,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  gridCard: {
    width: '48%',
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
