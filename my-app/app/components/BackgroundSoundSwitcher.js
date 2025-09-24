import React from "react";
import { View, Button, StyleSheet } from "react-native";

const sounds = [
  { label: "None", value: "none" },
  { label: "Rain", value: "rain" },
  { label: "Ocean", value: "ocean" }
];

export default function BackgroundSoundSwitcher({ value, onChange }) {
  return (
    <View style={styles.switcher}>
      {sounds.map(s => (
        <Button key={s.value} title={s.label} onPress={() => onChange(s.value)} color={value === s.value ? "#0288D1" : "#B3E5FC"} />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  switcher: { flexDirection: "row", justifyContent: "space-around" }
});
