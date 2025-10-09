import React, { useEffect, useMemo, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MeditationList from "../src/components/MeditationList";
import PlayerControls from "../src/components/PlayerControls";
import BackgroundSoundSwitcher from "../src/components/BackgroundSoundSwitcher";
import { colors, spacing } from "../src/theme";
import GradientBackground from "../src/components/GradientBackground";
import { auth, db } from "../firebase/firebaseConfig";
import { collection, onSnapshot, query, where, Timestamp, doc, getDocs } from "firebase/firestore";
import { safeSnapshot } from "../src/utils/safeSnapshot";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import { getMeditationById } from '../src/services/meditations';
import GradientCard from "../src/components/GradientCard";
import ProgressRing from "../src/components/ProgressRing";

export default function MeditationPlayerScreen() {
  const [selectedMeditation, setSelectedMeditation] = useState(null);
  const [backgroundSound, setBackgroundSound] = useState("none");
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [favoriteMeds, setFavoriteMeds] = useState([]);
  const [showTop, setShowTop] = useState(false);
  const scrollRef = useRef(null);
  const params = useLocalSearchParams();
  const uid = auth.currentUser?.uid || "local";
  const lastMedKey = `@med:lastSelection:${uid}`;
  const lastBgKey = `@med:lastBg:${uid}`;
  const favKey = `@med:favorites:${uid}`;
  
  // Breathing circle animation
  const breatheAnim = useRef(new Animated.Value(0)).current;
  const [isBreathing, setIsBreathing] = useState(false);
  
  useEffect(() => {
    if (!selectedMeditation) return;
    
    // Start breathing animation
    setIsBreathing(true);
    const breatheCycle = Animated.loop(
      Animated.sequence([
        // Inhale
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        // Hold
        Animated.delay(1000),
        // Exhale
        Animated.timing(breatheAnim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
        // Hold
        Animated.delay(1000),
      ])
    );
    breatheCycle.start();
    
    return () => {
      breatheCycle.stop();
      setIsBreathing(false);
    };
  }, [selectedMeditation]);

  // Subscribe to today's total minutes so users see immediate progress
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "users", user.uid, "sessions"),
      where("endedAt", ">=", Timestamp.fromDate(startOfDay))
    );
  const unsub = safeSnapshot(q, (snap) => {
      let totalSec = 0;
      snap.forEach((d) => {
        const data = d.data();
        if (data?.durationSec) totalSec += data.durationSec;
      });
      const minutes = Math.round((totalSec / 60) * 10) / 10;
      setTodayMinutes(minutes);
    });
    return () => unsub();
  }, []);

  // Restore last selection and background sound
  useEffect(() => {
    (async () => {
      try {
        const [rawMed, rawBg] = await Promise.all([
          AsyncStorage.getItem(lastMedKey),
          AsyncStorage.getItem(lastBgKey),
        ]);
        if (rawMed) {
          const parsed = JSON.parse(rawMed);
          setSelectedMeditation(parsed);
        }
        if (rawBg) setBackgroundSound(rawBg);
      } catch {}
    })();
  }, [lastMedKey, lastBgKey]);

  // Persist changes
  useEffect(() => {
    if (selectedMeditation) {
      AsyncStorage.setItem(lastMedKey, JSON.stringify(selectedMeditation)).catch(() => {});
    }
  }, [selectedMeditation, lastMedKey]);

  useEffect(() => {
    if (backgroundSound) {
      AsyncStorage.setItem(lastBgKey, backgroundSound).catch(() => {});
    }
  }, [backgroundSound, lastBgKey]);

  // Favorites quick access row
  useEffect(() => {
    let unsub = null;
    const loadFromIds = async (ids) => {
      try {
        if (!ids || ids.length === 0) { setFavoriteMeds([]); return; }
        const rows = await Promise.all(ids.slice(0, 20).map(async (id) => {
          try { return await getMeditationById(String(id)); } catch { return null; }
        }));
        setFavoriteMeds(rows.filter(Boolean));
      } catch { setFavoriteMeds([]); }
    };
    (async () => {
      if (auth.currentUser && auth.currentUser.uid) {
        try {
          const ref = collection(db, 'users', auth.currentUser.uid, 'favorites');
          unsub = safeSnapshot(ref, async (snap) => {
            const ids = snap.docs.map(d => d.id);
            await loadFromIds(ids);
          });
          return;
        } catch {}
      }
      // Fallback to local favorites when signed-out or failure
      try {
        const raw = await AsyncStorage.getItem(favKey);
        const ids = raw ? JSON.parse(raw) : [];
        await loadFromIds(ids);
      } catch { setFavoriteMeds([]); }
    })();
    return () => { try { unsub && unsub(); } catch {} };
  }, [favKey, uid]);

  // Handle Replay params
  useEffect(() => {
    (async () => {
      if (!params) return;
      const { replayId, replayUrl, replayTitle } = params;
      if (replayId) {
        try {
          const rec = await getMeditationById(String(replayId));
          if (rec && rec.title && rec.category) {
            setSelectedMeditation({ id: rec.id, title: rec.title, category: rec.category, url: rec.url || replayUrl || '' });
            return;
          }
        } catch {}
      }
      if (replayUrl) {
        const temp = { id: `replay:${Date.now()}`, title: replayTitle || 'Session Replay', category: 'Replay', url: String(replayUrl) };
        setSelectedMeditation(temp);
      }
    })();
    // Note: do not overwrite last selection with a one-off replay; keep persistence as-is
  }, [params?.replayId, params?.replayUrl]);

    return (
      <GradientBackground>
        <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        keyboardShouldPersistTaps="handled"
        onScroll={(e)=>{ try { setShowTop((e?.nativeEvent?.contentOffset?.y||0) > 200); } catch {} }}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="leaf" size={28} color="#66BB6A" />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.title}>Meditation</Text>
            <Text style={styles.subtitle}>Find your inner peace</Text>
          </View>
        </View>
        
        <GradientCard 
          colors={['#66BB6A', '#43A047', '#2E7D32']} 
          style={styles.todayCard}
        >
          <View style={styles.todayContent}>
            <Text style={styles.todayLabel}>Today's Practice</Text>
            <Text style={styles.todayValue}>{todayMinutes.toFixed(1)} min</Text>
            <View style={styles.progressIndicator}>
              <ProgressRing
                progress={Math.min(100, (todayMinutes / 20) * 100)}
                size={60}
                strokeWidth={6}
                color="#FFFFFF"
                backgroundColor="rgba(255,255,255,0.3)"
                animated
              />
              <View style={styles.progressLabel}>
                <Text style={styles.progressPercent}>
                  {Math.min(100, Math.round((todayMinutes / 20) * 100))}%
                </Text>
              </View>
            </View>
          </View>
        </GradientCard>
        {selectedMeditation && (
          <GradientCard 
            colors={['#E1F5FE', '#B3E5FC', '#81D4FA']} 
            style={styles.selectedCard}
          >
            {/* Breathing circle animation */}
            {isBreathing && (
              <View style={styles.breathingContainer}>
                <Animated.View
                  style={[
                    styles.breathingCircle,
                    {
                      transform: [
                        {
                          scale: breatheAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1.2],
                          }),
                        },
                      ],
                      opacity: breatheAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 0.8],
                      }),
                    },
                  ]}
                />
                <View style={styles.breathingCenter}>
                  <Ionicons name="flower-outline" size={32} color="#fff" />
                </View>
              </View>
            )}
            
            <View style={styles.selectedContent}>
              <View style={styles.nowPlayingBadge}>
                <Ionicons name="musical-notes" size={14} color="#0288D1" />
                <Text style={styles.selectedLabel}>NOW PLAYING</Text>
              </View>
              <Text style={styles.selectedTitle}>{selectedMeditation?.title || '—'}</Text>
              <View style={styles.categoryBadge}>
                <Ionicons name="pricetag" size={12} color="#01579B" />
                <Text style={styles.selectedCategory}>{selectedMeditation?.category || 'Meditation'}</Text>
              </View>
            </View>
          </GradientCard>
        )}
        {favoriteMeds.length > 0 && (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={styles.sectionHeader}>⭐ Your Favorites</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {favoriteMeds.map(m => (
                <TouchableOpacity key={m.id} onPress={() => setSelectedMeditation(m)} style={styles.favChip} accessibilityRole="button" accessibilityLabel={`Play favorite ${m.title}`}>
                  <Text style={styles.favChipEmoji}>★</Text>
                  <Text style={styles.favChipTxt}>{m.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        <Text style={styles.sectionHeader}>🎵 Browse Meditations</Text>
        <MeditationList onSelect={setSelectedMeditation} selected={selectedMeditation} />
        <View style={styles.playerSection}>
          <PlayerControls meditation={selectedMeditation} backgroundSound={backgroundSound} disabled={!selectedMeditation} accessibilityLabel={selectedMeditation? 'Play selected meditation' : 'Select a meditation to enable playback'} />
        </View>
        <Text style={styles.sectionHeader}>🌊 Background Sounds</Text>
        <BackgroundSoundSwitcher value={backgroundSound} onChange={setBackgroundSound} />
      </ScrollView>
      {showTop && (
        <TouchableOpacity
          onPress={()=> { try { scrollRef.current?.scrollTo({ y: 0, animated: true }); } catch {} }}
          style={styles.topBtn}
          accessibilityRole="button"
          accessibilityLabel="Scroll to top"
        >
          <Text style={styles.topBtnText}>↑ Top</Text>
        </TouchableOpacity>
      )}
        </SafeAreaView>
      </GradientBackground>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
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
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#43A047',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  title: { 
    fontSize: 24, 
    fontWeight: "800", 
    color: colors.text,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 4,
  },
  todayCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: "#43A047",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  todayContent: { flex: 1 },
  todayLabel: { 
    color: "#FFFFFF", 
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  todayValue: { 
    color: "#FFFFFF", 
    fontWeight: "800",
    fontSize: 36,
    letterSpacing: -0.5,
  },
  progressIndicator: {
    marginTop: 12,
  },
  progressLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercent: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  selectedCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: "#0288D1",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    minHeight: 160,
  },
  breathingContainer: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breathingCircle: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0288D1',
  },
  breathingCenter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0288D1',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  selectedContent: {
    flex: 1,
    paddingRight: 100, // Space for breathing circle
  },
  nowPlayingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    marginBottom: 12,
    shadowColor: '#0288D1',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  selectedLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0288D1",
    letterSpacing: 1.2,
  },
  selectedTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#01579B",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedCategory: {
    fontSize: 14,
    color: "#01579B",
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  favChip: { 
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md, 
    paddingVertical: spacing.sm + 2, 
    backgroundColor: "#FFF3E0", 
    borderRadius: 20, 
    marginRight: spacing.sm, 
    borderWidth: 1.5, 
    borderColor: "#FFD54F",
    shadowColor: "#FF6F00",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  favChipEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  favChipTxt: { 
    color: "#E65100", 
    fontWeight: "700",
    fontSize: 14,
  },
  playerSection: {
    marginVertical: spacing.md,
  },
  topBtn: { 
    position: 'absolute', 
    right: 16, 
    bottom: 16, 
    backgroundColor: colors.primary || '#0288D1', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 24, 
    shadowColor: '#000', 
    shadowOpacity: 0.25, 
    shadowRadius: 8, 
    shadowOffset: { width:0, height:4 }, 
    elevation: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  topBtnText: { 
    color: '#fff', 
    fontWeight: '800',
    fontSize: 14,
  }
});
