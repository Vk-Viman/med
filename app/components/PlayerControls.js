import React, { useRef } from "react";
import { View, Button, StyleSheet } from "react-native";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

export default function PlayerControls({ meditation, backgroundSound }) {
  const soundRef = useRef(null);

  const play = async () => {
    if (!meditation) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }
    const { sound } = await Audio.Sound.createAsync({ uri: meditation.url });
    soundRef.current = sound;
    await sound.playAsync();
  };
  const pause = async () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (soundRef.current) await soundRef.current.pauseAsync();
  };
  const stop = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  };
  // Background sound logic can be added here

  return (
    <View style={styles.controls}>
      <Button title="Play" onPress={play} />
      <Button title="Pause" onPress={pause} />
      <Button title="Stop" onPress={stop} />
    </View>
  );
}
const styles = StyleSheet.create({
  controls: { flexDirection: "row", justifyContent: "space-around", marginBottom: 20 }
});
