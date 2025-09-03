import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

const meditations = [
  { id: 1, title: "Morning Calm", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: 2, title: "Stress Relief", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: 3, title: "Deep Relaxation", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" }
];

export default function MeditationList({ onSelect, selected }) {
  return (
    <View style={styles.list}>
      {meditations.map(med => (
        <TouchableOpacity key={med.id} style={[styles.item, selected?.id === med.id && styles.selected]} onPress={() => onSelect(med)}>
          <Text style={styles.text}>{med.title}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  list: { marginBottom: 20 },
  item: { padding: 12, backgroundColor: "#B3E5FC", marginBottom: 8, borderRadius: 8 },
  selected: { backgroundColor: "#81D4FA" },
  text: { fontSize: 16, color: "#01579B" }
});
