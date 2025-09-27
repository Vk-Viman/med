import React from "react";
import { TouchableOpacity, View, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeProvider";

export default function GlowingPlayButton({ playing, onPress, disabled }) {
  const { theme } = useTheme();
  const scale = React.useRef(new Animated.Value(1)).current;
  const loopRef = React.useRef(null);
  React.useEffect(() => {
    if (playing) {
      const seq = Animated.sequence([
        Animated.timing(scale, { toValue: 1.06, duration: 650, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]);
      const lp = Animated.loop(seq);
      loopRef.current = lp;
      lp.start();
    } else {
      try { loopRef.current?.stop(); } catch {}
      scale.setValue(1);
    }
    return () => { try { loopRef.current?.stop(); } catch {} };
  }, [playing]);

  return (
    <Animated.View style={[styles.glow, { shadowColor: theme.primary, transform: [{ scale }] }]}> 
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: theme.primary }]}
        activeOpacity={0.85}
        onPress={async () => { try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}; onPress && onPress(); }}
        disabled={disabled}
        accessibilityLabel={playing ? "Pause" : "Play"}
      >
        <Ionicons name={playing ? "pause" : "play"} size={38} color={theme.primaryContrast || '#fff'} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: {
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  btn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
