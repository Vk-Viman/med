import React, { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";

const meditations = [
  { id: 1, title: "Morning Calm", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: 2, title: "Stress Relief", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: 3, title: "Deep Relaxation", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" }
];

function Item({ med, selected, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 30 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={[styles.item, selected && styles.selected]} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        <Text style={styles.text}>{med.title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MeditationList({ onSelect, selected }) {
  return (
    <View style={styles.list}>
      {meditations.map(med => (
        <Item key={med.id} med={med} selected={selected?.id === med.id} onPress={() => onSelect(med)} />
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
