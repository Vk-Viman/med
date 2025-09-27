import React, { useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Text, Animated } from "react-native";
import { selection } from "../utils/haptics";
import { useTheme } from "../theme/ThemeProvider";

const sounds = [
  { label: "None", value: "none" },
  { label: "Rain", value: "rain" },
  { label: "Ocean", value: "ocean" }
];

function Chip({ label, selected, onPress, theme }){
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(selected ? 1 : 0.9)).current;
  const runPressAnim = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: selected ? 1 : 0.9, duration: 160, useNativeDriver: true }),
      ])
    ]).start();
  };
  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <TouchableOpacity
        onPress={() => { selection(); onPress?.(); runPressAnim(); }}
        style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.card, borderColor: theme.primary }, selected && styles.chipSelected]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`Background sound ${label}${selected?' selected':''}`}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[styles.chipText, { color: selected ? theme.primaryContrast : theme.text }]}>{label.toUpperCase()}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function BackgroundSoundSwitcher({ value, onChange }) {
  const { theme } = useTheme();
  return (
    <View style={styles.switcher}>
      {sounds.map(s => (
        <Chip key={s.value} label={s.label} selected={value === s.value} onPress={() => onChange(s.value)} theme={theme} />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  switcher: { flexDirection: "row", justifyContent: "space-around", marginTop: 10 },
  chip:{ paddingVertical:12, paddingHorizontal:16, borderRadius:12, minWidth: 72, alignItems:'center', borderWidth: 1 },
  chipSelected:{},
  chipText:{ fontWeight:'800', letterSpacing:0.5 },
});
