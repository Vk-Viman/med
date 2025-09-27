import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MeditationList from "../src/components/MeditationList";
import PlayerControls from "../src/components/PlayerControls";
import BackgroundSoundSwitcher from "../src/components/BackgroundSoundSwitcher";
import { colors, spacing } from "../src/theme";
import GradientBackground from "../src/components/GradientBackground";
import { auth, db } from "../firebase/firebaseConfig";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import { getMeditationById } from '../src/services/admin';

export default function MeditationPlayerScreen() {
  const [selectedMeditation, setSelectedMeditation] = useState(null);
  const [backgroundSound, setBackgroundSound] = useState("none");
  const [todayMinutes, setTodayMinutes] = useState(0);
  const params = useLocalSearchParams();
  const uid = auth.currentUser?.uid || "local";
  const lastMedKey = `@med:lastSelection:${uid}`;
  const lastBgKey = `@med:lastBg:${uid}`;

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
    const unsub = onSnapshot(q, (snap) => {
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled">
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
        <MeditationList onSelect={setSelectedMeditation} selected={selectedMeditation} />
        <PlayerControls meditation={selectedMeditation} backgroundSound={backgroundSound} disabled={!selectedMeditation} accessibilityLabel={selectedMeditation? 'Play selected meditation' : 'Select a meditation to enable playback'} />
        <BackgroundSoundSwitcher value={backgroundSound} onChange={setBackgroundSound} />
      </ScrollView>
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
});
