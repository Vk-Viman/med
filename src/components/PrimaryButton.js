import React, { useRef } from "react";
import { TouchableOpacity, Text, StyleSheet, View, Animated } from "react-native";

export default function PrimaryButton({ title, onPress, style, disabled, variant = "primary", left, right, fullWidth }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 30 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.btn, variant === "secondary" && styles.secondary, fullWidth && styles.fullWidth, disabled && styles.disabled, style]}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      onPressIn={pressIn}
      onPressOut={pressOut}
    >
      <View style={styles.content}>
        {left ? <View style={styles.icon}>{left}</View> : null}
        <Text style={[styles.text, variant === "secondary" && styles.textSecondary]}>{title}</Text>
        {right ? <View style={styles.icon}>{right}</View> : null}
      </View>
    </TouchableOpacity>
    </Animated.View>
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
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { width: 18, height: 18 },
  text: { color: "#fff", fontWeight: "700" },
  textSecondary: { color: "#01579B" },
  secondary: { backgroundColor: "#B3E5FC" },
  disabled: { opacity: 0.6 },
  fullWidth: { alignSelf: "stretch" },
});
