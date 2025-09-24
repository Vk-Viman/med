import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientBackground from "../src/components/GradientBackground";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { auth } from "../firebase/firebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import PrimaryButton from "../src/components/PrimaryButton";
import { colors, spacing, radius, shadow } from "../src/theme";

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async () => {
    try {
  await createUserWithEmailAndPassword(auth, email, password);
  router.replace("/");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
        <Text style={styles.title}>Create account</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={18} color="#5C6BC0" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        </View>
        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={18} color="#5C6BC0" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton title="Create account" onPress={async () => { try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}; handleSignup(); }} fullWidth />
        <View style={{ height: spacing.sm }} />
        <Text style={{ textAlign: "center", color: "#607D8B", marginBottom: spacing.sm }}>
          Tip: After your first login, you can use biometric quick login on this device.
        </Text>
        <View style={{ height: spacing.sm }} />
        <PrimaryButton title="Back to Login" onPress={() => router.replace("/login")} variant="secondary" fullWidth />
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg, padding: spacing.lg },
  card: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.lg, width: "88%", ...shadow.card },
  title: { fontSize: 26, marginBottom: spacing.md, color: colors.text, fontWeight: "800", textAlign: "center" },
  inputWrap: { width: "100%", height: 48, borderColor: "#90CAF9", borderWidth: 1, marginBottom: spacing.sm, borderRadius: 14, backgroundColor: "#ffffffAA", flexDirection: "row", alignItems: "center" },
  inputIcon: { marginLeft: 10, marginRight: 6 },
  input: { flex: 1, height: "100%", paddingHorizontal: spacing.sm },
  error: { color: "red", marginBottom: spacing.sm }
});
