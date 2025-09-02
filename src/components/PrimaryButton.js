import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";

export default function PrimaryButton({ title, onPress, style, disabled }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.btn, disabled && styles.disabled, style]}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: "#0288D1",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  text: { color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
