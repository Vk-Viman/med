import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import MeditationList from "./components/MeditationList";
import PlayerControls from "./components/PlayerControls";
import BackgroundSoundSwitcher from "./components/BackgroundSoundSwitcher";
import ShimmerCard from "../src/components/ShimmerCard";

export default function MeditationPlayerScreen() {
  const [selectedMeditation, setSelectedMeditation] = useState(null);
  const [backgroundSound, setBackgroundSound] = useState("none");

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <ShimmerCard colors={['#E1F5FE', '#B3E5FC', '#81D4FA']} shimmerSpeed={3000}>
        <Text style={styles.title}>Meditation Player</Text>
      </ShimmerCard>
      <MeditationList onSelect={setSelectedMeditation} selected={selectedMeditation} />
      <ShimmerCard colors={['#E8EAF6', '#C5CAE9', '#9FA8DA']} shimmerSpeed={3200} enabled={!!selectedMeditation}>
        <PlayerControls meditation={selectedMeditation} backgroundSound={backgroundSound} />
      </ShimmerCard>
      <BackgroundSoundSwitcher value={backgroundSound} onChange={setBackgroundSound} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#E1F5FE" },
  title: { fontSize: 22, fontWeight: "bold", color: "#0288D1", marginBottom: 10 }
});
