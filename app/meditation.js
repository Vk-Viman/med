import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import MeditationList from "../src/components/MeditationList";
import PlayerControls from "../src/components/PlayerControls";
import BackgroundSoundSwitcher from "../src/components/BackgroundSoundSwitcher";
import { colors, spacing } from "../src/theme";

export default function MeditationPlayerScreen() {
  const [selectedMeditation, setSelectedMeditation] = useState(null);
  const [backgroundSound, setBackgroundSound] = useState("none");

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Meditation Player</Text>
      <MeditationList onSelect={setSelectedMeditation} selected={selectedMeditation} />
      <PlayerControls meditation={selectedMeditation} backgroundSound={backgroundSound} />
      <BackgroundSoundSwitcher value={backgroundSound} onChange={setBackgroundSound} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: spacing.md }
});
