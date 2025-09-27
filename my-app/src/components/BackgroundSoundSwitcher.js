import React from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { selection } from "../utils/haptics";

const sounds = [
  { label: "None", value: "none" },
  { label: "Rain", value: "rain" },
  { label: "Ocean", value: "ocean" }
];

export default function BackgroundSoundSwitcher({ value, onChange }) {
  return (
    <View style={styles.switcher}>
      {sounds.map(s => {
        const selected = value === s.value;
        return (
          <TouchableOpacity
            key={s.value}
            onPress={() => { selection(); onChange(s.value); }}
            style={[styles.chip, selected && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Background sound ${s.label}${selected?' selected':''}`}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{s.label.toUpperCase()}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  switcher: { flexDirection: "row", justifyContent: "space-around", marginTop: 10 },
  chip:{ paddingVertical:10, paddingHorizontal:14, borderRadius:10, backgroundColor:'#B3E5FC' },
  chipSelected:{ backgroundColor:'#0288D1' },
  chipText:{ color:'#01579B', fontWeight:'800', letterSpacing:0.5 },
  chipTextSelected:{ color:'#fff' }
});
