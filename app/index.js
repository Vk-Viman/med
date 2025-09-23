import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import PrimaryButton from "../src/components/PrimaryButton";
import { colors, spacing, radius, shadow } from "../src/theme";
import { useTheme } from "../src/theme/ThemeProvider";
import GradientBackground from "../src/components/GradientBackground";
import { Ionicons } from "@expo/vector-icons";
import Card from "../src/components/Card";

export default function HomeScreen() {
  const router = useRouter();
  const { theme, toggle, mode } = useTheme();
  return (
    <GradientBackground>
  <SafeAreaView style={[styles.container, { backgroundColor: "transparent" }]}> 
      <View style={[styles.header]}>
        <TouchableOpacity accessibilityLabel="Toggle theme" onPress={toggle}>
          <Ionicons name={mode === "light" ? "sunny-outline" : "moon-outline"} size={22} color={theme.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/settings")}> 
          <Image source={require("../assets/icon.png")} style={{ width: 28, height: 28, borderRadius: 14 }} />
        </TouchableOpacity>
      </View>
      <Card style={[styles.cardWrap]}> 
        <View style={styles.waveAccent}>
          <Ionicons name="water-outline" size={44} color="#CFE9FF" style={{ opacity: 0.5 }} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Welcome to Calm Space</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>Guided Meditation & Stress Relief</Text>
  <PrimaryButton title="Start Meditation" onPress={() => router.push("/meditation")} fullWidth left={<Ionicons name="play-circle" size={18} color="#fff" />} />
  <View style={{ height: spacing.md }} />
  <PrimaryButton title="Personalized Plan" onPress={() => router.push("/plan")} fullWidth left={<Ionicons name="sparkles-outline" size={18} color="#fff" />} />
  <View style={{ height: spacing.md }} />
  <PrimaryButton title="Weekly Report" onPress={() => router.push("/report")} fullWidth left={<Ionicons name="stats-chart-outline" size={18} color="#fff" />} />
  <View style={{ height: spacing.md }} />
  <PrimaryButton title="Mood & Stress Tracker" onPress={() => router.push("/moodTracker")} fullWidth left={<Ionicons name="happy-outline" size={18} color="#fff" />} />
  <View style={{ height: spacing.md }} />
  <PrimaryButton title="Wellness Report" onPress={() => router.push("/wellnessReport")} fullWidth left={<Ionicons name="pulse-outline" size={18} color="#fff" />} />
  <View style={{ height: spacing.md }} />
  <PrimaryButton title="Biometric Login" onPress={() => router.push("/biometricLogin")} variant="secondary" fullWidth left={<Ionicons name="finger-print-outline" size={18} color="#01579B" />} />
  <View style={{ height: spacing.md }} />
  <PrimaryButton title="Reminder Settings" onPress={() => router.push("/notifications")} variant="secondary" fullWidth left={<Ionicons name="notifications-outline" size={18} color="#01579B" />} />
  <View style={{ height: spacing.md }} />
  <PrimaryButton title="Settings" onPress={() => router.push("/settings")} variant="secondary" fullWidth left={<Ionicons name="settings-outline" size={18} color="#01579B" />} />
      </Card>
    </SafeAreaView>
    </GradientBackground>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.lg },
  header: { position: "absolute", top: spacing.lg, left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardWrap: { padding: spacing.lg, borderRadius: 20, position: "relative" },
  waveAccent: { position: "absolute", top: 12, right: 18, zIndex: 0 },
  title: { fontSize: 28, fontWeight: "800", color: colors.text, marginBottom: spacing.sm, textAlign: "center" },
  subtitle: { fontSize: 16, color: colors.textMuted, marginBottom: spacing.md, textAlign: "center" }
});
