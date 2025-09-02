import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Calm Space</Text>
      <Text style={styles.subtitle}>Guided Meditation & Stress Relief</Text>
      <Button title="Start Meditation" onPress={() => router.push("/meditation")} />
  <View style={{ height: 12 }} />
  <Button title="Personalized Plan" onPress={() => router.push("/plan")} />
  <View style={{ height: 12 }} />
  <Button title="Weekly Report" onPress={() => router.push("/report")} />
  <View style={{ height: 12 }} />
  <Button title="Reminder Settings" onPress={() => router.push("/notifications")} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#B3E5FC" },
  title: { fontSize: 26, fontWeight: "bold", color: "#01579B", marginBottom: 10 },
  subtitle: { fontSize: 18, color: "#0277BD", marginBottom: 30 }
});
