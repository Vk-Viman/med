import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, SafeAreaView } from "react-native";
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
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create account</Text>
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton title="Create account" onPress={handleSignup} fullWidth />
        <View style={{ height: spacing.sm }} />
        <PrimaryButton title="Back to Login" onPress={() => router.replace("/login")} variant="secondary" fullWidth />
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg, padding: spacing.lg },
  card: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.lg, width: "88%", ...shadow.card },
  title: { fontSize: 26, marginBottom: spacing.md, color: colors.text, fontWeight: "800", textAlign: "center" },
  input: { width: "100%", height: 44, borderColor: "#90CAF9", borderWidth: 1, marginBottom: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  error: { color: "red", marginBottom: spacing.sm }
});
