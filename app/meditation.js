import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MeditationList from "../src/components/MeditationList";
import PlayerControls from "../src/components/PlayerControls";
import BackgroundSoundSwitcher from "../src/components/BackgroundSoundSwitcher";
import { colors, spacing } from "../src/theme";
import GradientBackground from "../src/components/GradientBackground";
import { auth, db } from "../firebase/firebaseConfig";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";

export default function MeditationPlayerScreen() {
  const [selectedMeditation, setSelectedMeditation] = useState(null);
  const [backgroundSound, setBackgroundSound] = useState("none");
  const [todayMinutes, setTodayMinutes] = useState(0);

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

    return (
      <GradientBackground>
        <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Meditation Player</Text>
      <View style={styles.todayPill}>
        <Text style={styles.todayLabel}>Today's minutes</Text>
        <Text style={styles.todayValue}>{todayMinutes.toFixed(1)}m</Text>
      </View>
      <MeditationList onSelect={setSelectedMeditation} selected={selectedMeditation} />
      <PlayerControls meditation={selectedMeditation} backgroundSound={backgroundSound} />
      <BackgroundSoundSwitcher value={backgroundSound} onChange={setBackgroundSound} />
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
