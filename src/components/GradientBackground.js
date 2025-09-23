import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeProvider";

export default function GradientBackground({ children, style, colorsOverride }) {
  const { mode } = useTheme();
  const light = ["#CFE9FF", "#E3D7FF"]; // pastel blue -> purple
  const dark = ["#0F172A", "#3B2C59"];  // deep blue-gray -> purple
  const colors = colorsOverride || (mode === "light" ? light : dark);
  return (
    <View style={[styles.fill, style]}>
      <LinearGradient colors={colors} style={styles.fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
