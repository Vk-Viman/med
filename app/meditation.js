import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MeditationList from "../src/components/MeditationList";
import PlayerControls from "../src/components/PlayerControls";
import BackgroundSoundSwitcher from "../src/components/BackgroundSoundSwitcher";
import { colors, spacing } from "../src/theme";
import GradientBackground from "../src/components/GradientBackground";

export default function MeditationPlayerScreen() {
  const [selectedMeditation, setSelectedMeditation] = useState(null);
  const [backgroundSound, setBackgroundSound] = useState("none");

    return (
      <GradientBackground>
        <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Meditation Player</Text>
      <MeditationList onSelect={setSelectedMeditation} selected={selectedMeditation} />
      <PlayerControls meditation={selectedMeditation} backgroundSound={backgroundSound} />
      <BackgroundSoundSwitcher value={backgroundSound} onChange={setBackgroundSound} />
        </SafeAreaView>
      </GradientBackground>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: spacing.md }
});
