import React, { useEffect, useRef } from "react";
import { View, Button, StyleSheet } from "react-native";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { auth, db } from "../../firebase/firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function PlayerControls({ meditation, backgroundSound }) {
  // Create a single player instance for this component
  const player = useAudioPlayer();
  const sessionStartRef = useRef(null);

  // Update the audio source whenever the selected meditation changes
  useEffect(() => {
    const url = meditation?.url;
    if (url) {
      try {
        player.replace({ uri: url });
      } catch {}
    } else {
      // No selection — release any loaded source
      try {
        player.remove();
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meditation?.url]);

  const play = async () => {
    if (!meditation?.url) return;
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    player.play();
  if (!sessionStartRef.current) sessionStartRef.current = Date.now();
  };

  const pause = async () => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    player.pause();
  };

  const stop = async () => {
    // expo-audio has no stop(); emulate by pausing and seeking to start
    player.pause();
    try { await player.seekTo(0); } catch {}
    const startedAt = sessionStartRef.current;
    sessionStartRef.current = null;
    const user = auth.currentUser;
    if (startedAt && user && meditation) {
      const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      try {
        await addDoc(collection(db, "users", user.uid, "sessions"), {
          meditationId: meditation.id ?? null,
          meditationTitle: meditation.title ?? null,
          durationSec,
          startedAt: new Date(startedAt),
          endedAt: serverTimestamp(),
          backgroundSound: backgroundSound ?? "none",
        });
      } catch {}
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
