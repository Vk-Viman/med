import React, { useEffect, useMemo, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
        <Text style={styles.title}>Meditation Player</Text>
        <View style={styles.todayPill}>
          <Text style={styles.todayLabel}>Today's minutes</Text>
          <Text style={styles.todayValue}>{todayMinutes.toFixed(1)}m</Text>
        </View>
        {selectedMeditation && (
          <Text style={{ marginBottom: spacing.sm, color: colors.mutedText || '#455A64' }}>
            Selected: {selectedMeditation?.title || '—'}
          </Text>
        )}
        {favoriteMeds.length > 0 && (
          <View style={{ marginBottom: spacing.sm }}>
            <Text style={{ color: colors.mutedText || '#607D8B', fontWeight: '700', marginBottom: 6 }}>Your favorites</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {favoriteMeds.map(m => (
                <TouchableOpacity key={m.id} onPress={() => setSelectedMeditation(m)} style={styles.favChip} accessibilityRole="button" accessibilityLabel={`Play favorite ${m.title}`}>
                  <Text style={styles.favChipTxt}>★ {m.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        <MeditationList onSelect={setSelectedMeditation} selected={selectedMeditation} />
        <PlayerControls meditation={selectedMeditation} backgroundSound={backgroundSound} disabled={!selectedMeditation} accessibilityLabel={selectedMeditation? 'Play selected meditation' : 'Select a meditation to enable playback'} />
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
  title: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: spacing.sm },
  todayPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  todayLabel: { color: colors.mutedText || "#607D8B", fontWeight: "600" },
  todayValue: { color: colors.primary || "#0288D1", fontWeight: "800" },
  favChip: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#FFF3E0", borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: "#FFE0B2" },
  favChipTxt: { color: "#E65100", fontWeight: "700" },
  topBtn: { position: 'absolute', right: 16, bottom: 16, backgroundColor: colors.primary || '#0288D1', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width:0, height:2 }, elevation: 3 },
  topBtnText: { color: '#fff', fontWeight: '800' }
});
