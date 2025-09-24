import React, { useRef } from "react";
import { TouchableOpacity, Text, StyleSheet, View, Animated, StyleSheet as RNStyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

export default function PrimaryButton({ title, onPress, style, disabled, variant = "primary", left, right, fullWidth }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 30 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  const handlePress = async () => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    onPress && onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        accessibilityRole="button"
        style={[
          styles.btn,
          variant === "secondary" && styles.secondary,
          fullWidth && styles.fullWidth,
          disabled && styles.disabled,
          style,
        ]}
        activeOpacity={0.85}
        onPress={handlePress}
        disabled={disabled}
        onPressIn={pressIn}
        onPressOut={pressOut}
      >
        {variant !== "secondary" && (
          <LinearGradient
            colors={["#5EC6FF", "#9C8CFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBg}
          />
        )}
        <View style={styles.content}>
          {left ? <View style={styles.icon}>{left}</View> : null}
          <Text style={[styles.text, variant === "secondary" && styles.textSecondary]} numberOfLines={1}>
            {title}
          </Text>
          {right ? <View style={styles.icon}>{right}</View> : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
  backgroundColor: "#5EC6FF", // base color so primary never looks grey if gradient fails
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden", // ensures gradient corners clip on Android
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  gradientBg: { ...RNStyleSheet.absoluteFillObject, borderRadius: 20 },
  content: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  icon: { width: 18, height: 18 },
  text: { color: "#fff", fontWeight: "700" },
  textSecondary: { color: "#01579B" },
  secondary: { backgroundColor: "#B3E5FC" },
  disabled: { opacity: 0.6 },
  fullWidth: { alignSelf: "stretch" },
});
