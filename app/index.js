import React from "react";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import PrimaryButton from "../src/components/PrimaryButton";

export default function HomeScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome to Calm Space</Text>
      <Text style={styles.subtitle}>Guided Meditation & Stress Relief</Text>
      <PrimaryButton title="Start Meditation" onPress={() => router.push("/meditation")} />
      <View style={{ height: 12 }} />
      <PrimaryButton title="Personalized Plan" onPress={() => router.push("/plan")} />
      <View style={{ height: 12 }} />
      <PrimaryButton title="Weekly Report" onPress={() => router.push("/report")} />
      <View style={{ height: 12 }} />
      <PrimaryButton title="Reminder Settings" onPress={() => router.push("/notifications")} style={{ backgroundColor: "#B3E5FC" }} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#B3E5FC" },
  title: { fontSize: 26, fontWeight: "bold", color: "#01579B", marginBottom: 10 },
  subtitle: { fontSize: 18, color: "#0277BD", marginBottom: 30 }
});
