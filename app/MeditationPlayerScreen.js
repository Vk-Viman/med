import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import MeditationList from "./components/MeditationList";
import PlayerControls from "./components/PlayerControls";
import BackgroundSoundSwitcher from "./components/BackgroundSoundSwitcher";

export default function MeditationPlayerScreen() {
  const [selectedMeditation, setSelectedMeditation] = useState(null);
  const [backgroundSound, setBackgroundSound] = useState("none");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meditation Player</Text>
      <MeditationList onSelect={setSelectedMeditation} selected={selectedMeditation} />
      <PlayerControls meditation={selectedMeditation} backgroundSound={backgroundSound} />
      <BackgroundSoundSwitcher value={backgroundSound} onChange={setBackgroundSound} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#E1F5FE" },
  title: { fontSize: 22, fontWeight: "bold", color: "#0288D1", marginBottom: 10 }
});
