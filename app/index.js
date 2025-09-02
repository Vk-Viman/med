import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import PrimaryButton from "../src/components/PrimaryButton";
import { colors, spacing, radius, shadow } from "../src/theme";
import { useTheme } from "../src/theme/ThemeProvider";

export default function HomeScreen() {
  const router = useRouter();
  const { theme, toggle, mode } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}> 
      <View style={[styles.header]}>
        <TouchableOpacity onPress={toggle}>
          <Text style={{ color: theme.textMuted }}>{mode === "light" ? "☀️" : "🌙"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/settings")}> 
          <Image source={require("../assets/icon.png")} style={{ width: 28, height: 28, borderRadius: 14 }} />
        </TouchableOpacity>
      </View>
      <View style={[styles.card, { backgroundColor: theme.card }]}> 
        <Text style={[styles.title, { color: theme.text }]}>Welcome to Calm Space</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>Guided Meditation & Stress Relief</Text>
        <PrimaryButton title="Start Meditation" onPress={() => router.push("/meditation")} fullWidth />
        <View style={{ height: spacing.sm }} />
        <PrimaryButton title="Personalized Plan" onPress={() => router.push("/plan")} fullWidth />
        <View style={{ height: spacing.sm }} />
        <PrimaryButton title="Weekly Report" onPress={() => router.push("/report")} fullWidth />
        <View style={{ height: spacing.sm }} />
  <PrimaryButton title="Reminder Settings" onPress={() => router.push("/notifications")} variant="secondary" fullWidth />
  <View style={{ height: spacing.sm }} />
  <PrimaryButton title="Settings" onPress={() => router.push("/settings")} variant="secondary" fullWidth />
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { position: "absolute", top: spacing.lg, left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  card: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.lg, width: "88%", ...shadow.card },
  title: { fontSize: 28, fontWeight: "800", color: colors.text, marginBottom: spacing.sm, textAlign: "center" },
  subtitle: { fontSize: 16, color: colors.textMuted, marginBottom: spacing.md, textAlign: "center" }
});
