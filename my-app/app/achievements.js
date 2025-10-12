import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Animated, AccessibilityInfo, Platform, findNodeHandle, InteractionManager, Modal, Pressable, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GradientBackground from '../src/components/GradientBackground';
import Card from '../src/components/Card';
import { useTheme } from '../src/theme/ThemeProvider';
import { auth, db } from '../firebase/firebaseConfig';
import { listAllUserBadges, badgeEmoji, evaluateStreakBadges } from '../src/badges';
import { doc, getDoc } from 'firebase/firestore';
import { getBadgeMeta, nextMinuteThreshold, nextStreakThreshold, progressTowards, loadAdminBadgesIntoCatalog } from '../src/constants/badges';
import { listAdminBadgesForUser } from '../src/services/admin';
import { getCachedAggStats, setCachedAggStats } from '../src/utils/statsCache';
import { Ionicons } from '@expo/vector-icons';
import GradientCard from '../src/components/GradientCard';
import EmptyState from '../src/components/EmptyState';
import ShimmerCard from '../src/components/ShimmerCard';
import SkeletonLoader from '../src/components/SkeletonLoader';
import { handleError } from '../src/utils/errorHandler';

export default function AchievementsScreen(){
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const announcerRef = useRef(null);
  const [selected, setSelected] = useState(null); // { id, name, awardedAt }
  const [stats, setStats] = useState({ totalMinutes: 0, streak: 0 });

  const loadBadges = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      // Merge admin-defined badges into catalog
      const locale = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : (Intl?.DateTimeFormat?.().resolvedOptions?.().locale || 'en');
      try { 
        await loadAdminBadgesIntoCatalog({ 
          fetchAdminBadges: listAdminBadgesForUser, 
          locale: String(locale).split('-')[0] 
        }); 
      } catch (error) {
        handleError(error, 'Achievements:loadAdminBadges', { showAlert: false });
      }
      
      const uid = auth.currentUser?.uid;
      if (uid) {
        // Re-evaluate streak badges before loading
        try {
          await evaluateStreakBadges(uid, stats.streak);
        } catch (error) {
          handleError(error, 'Achievements:evaluateStreak', { showAlert: false });
        }
        
        const list = await listAllUserBadges(uid);
        setItems(list);
        
        // Fetch aggregate stats
        try {
          const cached = await getCachedAggStats(uid);
          if (cached) {
            setStats({ 
              totalMinutes: Number(cached.totalMinutes || 0), 
              streak: Number(cached.streak || 0) 
            });
          }
          
          const sRef = doc(db, 'users', uid, 'stats', 'aggregate');
          const sSnap = await getDoc(sRef);
          if (snapExists(sSnap)) {
            const d = sSnap.data() || {};
            setStats({ 
              totalMinutes: Number(d.totalMinutes || 0), 
              streak: Number(d.streak || 0) 
            });
            await setCachedAggStats(uid, d);
          }
        } catch (error) {
          handleError(error, 'Achievements:loadStats', { showAlert: false });
        }
      }
    } catch (error) {
      handleError(error, 'Achievements:loadBadges', { showAlert: true });
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [stats.streak]);

  useEffect(() => {
    loadBadges(true);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBadges(false);
    setRefreshing(false);
  }, [loadBadges]);

  function snapExists(s){ try { return typeof s?.exists === 'function' ? s.exists() : !!s?.exists; } catch { return false; } }

  // Announce screen on focus for screen readers
  useEffect(()=>{
    const handle = setTimeout(()=>{
      try {
        InteractionManager.runAfterInteractions(() => {
          AccessibilityInfo.isScreenReaderEnabled().then((enabled)=>{
            if(!enabled) return;
            try {
              const tag = findNodeHandle(announcerRef.current);
              if (tag) AccessibilityInfo.setAccessibilityFocus?.(tag);
            } catch {}
            AccessibilityInfo.announceForAccessibility('Achievements screen. Browse your earned badges.');
          });
        });
      } catch {}
    }, 400);
    return ()=> clearTimeout(handle);
  },[]);

  const AchievementItem = ({ item, index }) => {
    const when = item.awardedAt?.seconds ? new Date(item.awardedAt.seconds*1000) : null;
    const dateStr = when ? when.toLocaleDateString() : '';
    const a11yLabel = `${item.name || item.id} badge${dateStr? `, awarded ${dateStr}`:''}`;
    const scale = useRef(new Animated.Value(0.85)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    useEffect(()=>{
      const anim = Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 220 + Math.min(index*30, 240), useNativeDriver: true })
      ]);
      anim.start();
      return () => anim.stop();
    },[index, scale, opacity]);
    return (
      <Animated.View style={{ transform:[{ scale }], opacity }}>
        <Pressable onPress={()=> setSelected(item)} accessibilityRole='button' accessibilityLabel={`Show details for ${item.name || item.id}`}>
          <ShimmerCard 
            colors={['#FFA726', '#FB8C00', '#F57C00']} 
            style={styles.row}
            shimmerSpeed={3000}
          >
            <Text style={styles.emoji}>{badgeEmoji(item.id)}</Text>
            <View style={{ flex:1 }}>
              <Text style={[styles.title,{ color: '#fff' }]}>{item.name || item.id}</Text>
              {!!dateStr && <Text style={[styles.subtitle,{ color: '#FFE0B2' }]}>Awarded {dateStr}</Text>}
            </View>
          </ShimmerCard>
        </Pressable>
      </Animated.View>
    );
  };

  const renderItem = ({ item, index }) => (
    <AchievementItem item={item} index={index} />
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        {/* Enhanced Header */}
        <View style={styles.headerContainer}>
          <View style={styles.iconBadge}>
            <Ionicons name="trophy" size={28} color="#FFA726" />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text
              ref={announcerRef}
              accessibilityRole='header'
              accessibilityLabel='Achievements'
              style={[styles.header,{ color: theme.text }]}
            >
              Achievements
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Your badges and milestones
            </Text>
          </View>
        </View>
        {loading ? (
          <View style={{ paddingHorizontal: 16 }}>
            {[...Array(4)].map((_, i) => (
              <SkeletonLoader key={i} height={80} style={{ marginBottom: 12 }} />
            ))}
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon="trophy-outline"
            title="No badges yet"
            subtitle="Keep meditating and logging moods to unlock achievements"
          />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it)=> it.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={{ paddingBottom: 32 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
                title="Pull to refresh achievements"
              />
            }
            // Performance optimizations
            windowSize={10}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={true}
            initialNumToRender={8}
            accessibilityLabel='Earned badges list'
            accessibilityHint='Swipe through to hear each badge. Pull down to refresh.'
          />
        )}

        <BadgeDetailsModal
          visible={!!selected}
          onClose={()=> setSelected(null)}
          badge={selected}
          stats={stats}
          theme={theme}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

function ProgressRow({ label, pct, theme }){
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <View style={{ height: 8, backgroundColor: theme.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD', borderRadius: 6, overflow:'hidden' }}>
        <View style={{ height: '100%', width: `${pct}%`, backgroundColor: theme.primary }} />
      </View>
    </View>
  );
}

function BadgeDetailsModal({ visible, onClose, badge, stats, theme }){
  if(!visible || !badge) return null;
  const meta = getBadgeMeta(badge.id) || { name: badge.name || badge.id, description: '' };
  const total = Number(stats?.totalMinutes||0);
  const streak = Number(stats?.streak||0);
  const nextMin = nextMinuteThreshold(total);
  const nextStreak = nextStreakThreshold(streak);
  const pctMin = nextMin ? progressTowards(nextMin, total) : 100;
  const pctStreak = nextStreak ? progressTowards(nextStreak, streak) : 100;
  return (
    <Modal visible transparent animationType='fade' onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.modalBackdrop}>
        <Pressable onPress={(e)=> e.stopPropagation()} style={[styles.modalCard,{ backgroundColor: theme.card }]}> 
          {meta.iconUrl ? (
            <Image source={{ uri: meta.iconUrl }} style={{ width: 64, height: 64, alignSelf:'center', marginBottom: 6, borderRadius: 12 }} />
          ) : (
            <Text style={{ fontSize: 28, textAlign:'center' }}>{meta.emoji || badgeEmoji(badge.id)}</Text>
          )}
          <Text style={{ fontSize: 18, fontWeight:'800', color: theme.text, textAlign:'center' }}>{meta.name}</Text>
          {!!meta.description && <Text style={{ color: theme.textMuted, textAlign:'center', marginTop: 4 }}>{meta.description}</Text>}
          {meta.type === 'minute' && nextMin && (
            <ProgressRow label={`Progress to ${nextMin} minutes`} pct={pctMin} theme={theme} />
          )}
          {meta.type === 'streak' && nextStreak && (
            <ProgressRow label={`Progress to ${nextStreak}-day streak`} pct={pctStreak} theme={theme} />
          )}
          {String(badge.id).startsWith('challenge_') && (
            <Text style={{ color: theme.textMuted, marginTop: 8 }}>Complete more challenges to earn more rewards.</Text>
          )}
          <Pressable onPress={onClose} style={[styles.closeBtn,{ backgroundColor: theme.primary }]} accessibilityRole='button' accessibilityLabel='Close'>
            <Text style={{ color:'#fff', fontWeight:'800' }}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:{ 
    flex:1, 
    paddingHorizontal:20, 
    paddingTop:16 
  },
  header:{ 
    fontSize:28, 
    fontWeight:'800', 
    marginBottom:20,
    letterSpacing: 0.5,
  },
  row:{ 
    flexDirection:'row', 
    alignItems:'center', 
    padding:16,
    minHeight: 72, // Ensure minimum touch target (44pt+)
    borderRadius:16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  emoji:{ 
    fontSize:36, 
    marginRight:16 
  },
  title:{ 
    fontSize:17, 
    fontWeight:'800',
    letterSpacing: 0.3,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFA726',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  subtitle:{ 
    fontSize:13, 
    fontWeight:'600',
    marginTop: 2,
  },
  center:{ 
    flex:1, 
    alignItems:'center', 
    justifyContent:'center' 
  },
  centerCard:{ 
    padding:28, 
    borderRadius:20, 
    alignItems:'center',
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  emptyTitle:{ 
    fontSize:20, 
    fontWeight:'800', 
    marginBottom:8,
    letterSpacing: 0.3,
  },
  emptySub:{ 
    fontSize:15, 
    fontWeight:'500', 
    textAlign:'center',
    lineHeight: 22,
  },
  modalBackdrop:{ 
    flex:1, 
    backgroundColor:'rgba(0,0,0,0.5)', 
    alignItems:'center', 
    justifyContent:'center', 
    padding:24 
  },
  modalCard:{ 
    width: '100%', 
    maxWidth: 420, 
    borderRadius: 24, 
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  closeBtn:{ 
    alignSelf:'center', 
    marginTop: 16, 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  }
});
