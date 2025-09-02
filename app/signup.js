import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { auth } from "../firebase/firebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import PrimaryButton from "../src/components/PrimaryButton";

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
      <Text style={styles.title}>Sign Up</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton title="Create account" onPress={handleSignup} />
      <View style={{ height: 12 }} />
      <PrimaryButton title="Back to Login" onPress={() => router.replace("/login")} style={{ backgroundColor: "#B3E5FC" }} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#E3F2FD", padding: 20 },
  title: { fontSize: 28, marginBottom: 20, color: "#01579B", fontWeight: "800" },
  input: { width: 250, height: 40, borderColor: "#90CAF9", borderWidth: 1, marginBottom: 10, padding: 8, borderRadius: 5 },
  error: { color: "red", marginBottom: 10 }
});
