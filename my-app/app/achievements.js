import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Animated, AccessibilityInfo, Platform, findNodeHandle, InteractionManager, Modal, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GradientBackground from '../src/components/GradientBackground';
import Card from '../src/components/Card';
import { useTheme } from '../src/theme/ThemeProvider';
import { auth, db } from '../firebase/firebaseConfig';
import { listAllUserBadges, badgeEmoji } from '../src/badges';
import { doc, getDoc } from 'firebase/firestore';
import { getBadgeMeta, nextMinuteThreshold, nextStreakThreshold, progressTowards, loadAdminBadgesIntoCatalog } from '../src/constants/badges';
import { listAdminBadgesForUser } from '../src/services/admin';
import { getCachedAggStats, setCachedAggStats } from '../src/utils/statsCache';

export default function AchievementsScreen(){
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const announcerRef = useRef(null);
  const [selected, setSelected] = useState(null); // { id, name, awardedAt }
  const [stats, setStats] = useState({ totalMinutes: 0, streak: 0 });

  useEffect(()=>{
    let mounted = true;
    (async()=>{
      try{
        // Merge admin-defined badges into catalog for richer details (read-only on user side)
  const locale = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : (Intl?.DateTimeFormat?.().resolvedOptions?.().locale || 'en');
  try { await loadAdminBadgesIntoCatalog({ fetchAdminBadges: listAdminBadgesForUser, locale: String(locale).split('-')[0] }); } catch {}
        const uid = auth.currentUser?.uid;
        if(uid){
          const list = await listAllUserBadges(uid);
          if(mounted) setItems(list);
          // fetch aggregate stats for progress-to-next
          try{
            const cached = await getCachedAggStats(uid); if(cached) setStats({ totalMinutes: Number(cached.totalMinutes||0), streak: Number(cached.streak||0) });
            const sRef = doc(db, 'users', uid, 'stats', 'aggregate');
            const sSnap = await getDoc(sRef);
            if(snapExists(sSnap)){
              const d = sSnap.data()||{};
              setStats({ totalMinutes: Number(d.totalMinutes||0), streak: Number(d.streak||0) });
              try { await setCachedAggStats(uid, d); } catch {}
            }
          } catch{}
        }
      } finally { if(mounted) setLoading(false); }
    })();
    return ()=>{ mounted = false; };
  },[]);

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
          <Card style={styles.row} accessible accessibilityRole='text' accessibilityLabel={a11yLabel}>
            <Text style={styles.emoji}>{badgeEmoji(item.id)}</Text>
            <View style={{ flex:1 }}>
              <Text style={[styles.title,{ color: theme.text }]}>{item.name || item.id}</Text>
              {!!dateStr && <Text style={[styles.subtitle,{ color: theme.textMuted }]}>Awarded {dateStr}</Text>}
            </View>
          </Card>
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
        <Text
          ref={announcerRef}
          accessibilityRole='header'
          accessibilityLabel='Achievements'
          style={[styles.header,{ color: theme.text }]}
        >
          Achievements
        </Text>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        ) : items.length === 0 ? (
          <Card style={styles.centerCard}>
            <Text accessibilityRole='header' style={[styles.emptyTitle,{ color: theme.text }]}>No badges yet</Text>
            <Text accessibilityLabel='Keep meditating and logging moods to unlock achievements.' style={[styles.emptySub,{ color: theme.textMuted }]}>Keep meditating and logging moods to unlock achievements.</Text>
          </Card>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it)=> it.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            contentContainerStyle={{ paddingBottom: 32 }}
            accessibilityLabel='Earned badges list'
            accessibilityHint='Swipe through to hear each badge'
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
  container:{ flex:1, paddingHorizontal:16, paddingTop:12 },
  header:{ fontSize:22, fontWeight:'800', marginBottom:12 },
  row:{ flexDirection:'row', alignItems:'center', padding:12, borderRadius:14 },
  emoji:{ fontSize:22, marginRight:12 },
  title:{ fontSize:14, fontWeight:'800' },
  subtitle:{ fontSize:12, fontWeight:'600' },
  center:{ flex:1, alignItems:'center', justifyContent:'center' },
  centerCard:{ padding:16, borderRadius:14, alignItems:'center' },
  emptyTitle:{ fontSize:16, fontWeight:'800', marginBottom:4 },
  emptySub:{ fontSize:12, fontWeight:'600', textAlign:'center' },
  modalBackdrop:{ flex:1, backgroundColor:'rgba(0,0,0,0.4)', alignItems:'center', justifyContent:'center', padding:20 },
  modalCard:{ width: '100%', maxWidth: 420, borderRadius: 16, padding: 16 },
  closeBtn:{ alignSelf:'center', marginTop: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }
});
