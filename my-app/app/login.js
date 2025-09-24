import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import GradientBackground from "../src/components/GradientBackground";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { auth } from "../firebase/firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ensureUserProfile } from "../src/services/userProfile";
import PrimaryButton from "../src/components/PrimaryButton";
import { colors, spacing, radius, shadow } from "../src/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
  await signInWithEmailAndPassword(auth, email, password);
  try { await ensureUserProfile(); } catch {}
  router.replace("/(tabs)");
    } catch (e) {
      setError(e.message);
    }
  };

  const handleBiometricLogin = async () => {
    setError("");
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        setError("Biometric auth not available or not enrolled on this device.");
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: "Login with biometrics" });
      if (!res.success) {
        setError("Biometric authentication failed.");
        return;
      }
      if (auth.currentUser) {
        router.replace("/(tabs)");
      } else {
        setError("No existing session. Please sign in once with email/password to enable biometric quick login.");
      }
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
        <Text style={styles.title}>Login</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={18} color="#5C6BC0" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        </View>
        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={18} color="#5C6BC0" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton title="Login" onPress={async () => { try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}; handleLogin(); }} fullWidth />
        <View style={{ height: spacing.sm }} />
  <PrimaryButton title="Login with Biometrics" onPress={handleBiometricLogin} variant="secondary" fullWidth />
  <View style={{ height: spacing.sm }} />
        <PrimaryButton title="Sign Up" onPress={() => router.replace("/signup")} variant="secondary" fullWidth />
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
