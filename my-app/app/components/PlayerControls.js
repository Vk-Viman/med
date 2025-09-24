import React from "react";
import { View, Button, StyleSheet } from "react-native";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";

export default function PlayerControls({ meditation, backgroundSound }) {
  const { play, pause, stop, isPlaying } = useAudioPlayer({ source: meditation?.url });

  return (
    <View style={styles.controls}>
  <Button title="Play" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); play(); }} />
  <Button title="Pause" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); pause(); }} />
      <Button title="Stop" onPress={stop} />
    </View>
  );
}
const styles = StyleSheet.create({
  controls: { flexDirection: "row", justifyContent: "space-around", marginBottom: 20 }
});
