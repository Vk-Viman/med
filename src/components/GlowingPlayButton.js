import React from "react";
import { TouchableOpacity, View, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export default function GlowingPlayButton({ playing, onPress, disabled }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (playing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.08, duration: 700, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scale.setValue(1);
    }
  }, [playing]);

  return (
    <Animated.View style={[styles.glow, { transform: [{ scale }] }]}> 
      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.85}
        onPress={async () => { try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}; onPress && onPress(); }}
        disabled={disabled}
        accessibilityLabel={playing ? "Pause" : "Play"}
      >
        <Ionicons name={playing ? "pause" : "play"} size={38} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C4DFF",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  btn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#7C4DFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
