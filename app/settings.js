import React from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import PrimaryButton from "../src/components/PrimaryButton";
import { auth } from "../firebase/firebaseConfig";
import { signOut } from "firebase/auth";
import { colors, spacing, radius, shadow } from "../src/theme";

export default function SettingsScreen() {
  const router = useRouter();

  const resetOnboarding = async () => {
    await AsyncStorage.removeItem("cs_onboarded");
    Alert.alert("Reset", "Onboarding will show next launch.");
  };

  const logout = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Settings</Text>
        <PrimaryButton title="Reset Onboarding" onPress={resetOnboarding} fullWidth />
        <View style={{ height: spacing.sm }} />
        <PrimaryButton title="Sign Out" onPress={logout} variant="secondary" fullWidth />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg, padding: spacing.lg },
  card: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.lg, width: "88%", ...shadow.card },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: spacing.md, textAlign: "center" },
});
