import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Animated, AccessibilityInfo, Platform, findNodeHandle, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GradientBackground from '../src/components/GradientBackground';
import Card from '../src/components/Card';
import { useTheme } from '../src/theme/ThemeProvider';
import { auth } from '../firebase/firebaseConfig';
import { listAllUserBadges, badgeEmoji } from '../src/badges';

export default function AchievementsScreen(){
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const announcerRef = useRef(null);

  useEffect(()=>{
    let mounted = true;
    (async()=>{
      try{
        const uid = auth.currentUser?.uid;
        if(uid){
          const list = await listAllUserBadges(uid);
          if(mounted) setItems(list);
        }
      } finally { if(mounted) setLoading(false); }
    })();
    return ()=>{ mounted = false; };
  },[]);

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
        <Card style={styles.row} accessible accessibilityRole='text' accessibilityLabel={a11yLabel}>
          <Text style={styles.emoji}>{badgeEmoji(item.id)}</Text>
          <View style={{ flex:1 }}>
            <Text style={[styles.title,{ color: theme.text }]}>{item.name || item.id}</Text>
            {!!dateStr && <Text style={[styles.subtitle,{ color: theme.textMuted }]}>Awarded {dateStr}</Text>}
          </View>
        </Card>
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
      </SafeAreaView>
    </GradientBackground>
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
  emptySub:{ fontSize:12, fontWeight:'600', textAlign:'center' }
});
