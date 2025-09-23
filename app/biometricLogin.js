import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import PrimaryButton from "../src/components/PrimaryButton";
import { useRouter } from "expo-router";

export default function BiometricLogin() {
  const [checking, setChecking] = useState(false);
  const router = useRouter();

  const handleBiometric = async () => {
    setChecking(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) throw new Error("No biometric enrolled");
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Login with biometrics" });
      if (result.success) {
        Alert.alert("Success", "Authenticated!");
        router.replace("/login");
      } else {
        Alert.alert("Failed", "Authentication failed.");
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    }
    setChecking(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Biometric Login</Text>
      <PrimaryButton title="Login with Fingerprint/FaceID" onPress={handleBiometric} disabled={checking} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#E1F5FE" },
  heading: { fontSize: 22, fontWeight: "700", color: "#01579B", marginBottom: 18 },
});
