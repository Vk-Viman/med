import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Alert, BackHandler } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from "expo-local-authentication";
import PrimaryButton from "../src/components/PrimaryButton";
import { useRouter } from "expo-router";

export default function BiometricLogin() {
  const [checking, setChecking] = useState(false);
  const router = useRouter();
  useEffect(()=>{
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // If we can go back safely, allow default behavior via returning false
      // but expo-router's navigation may not have stack, so fallback
      try {
        // We purposely route to login instead of leaving app when biometric screen is a lock state
        router.replace('/login');
      } catch {}
      return true; // we've handled it
    });
    return ()=> sub.remove();
  },[]);

  const handleBiometric = async () => {
    setChecking(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) throw new Error("No biometric enrolled");
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Login with biometrics" });
      if (result.success) {
        // Attempt resume
  // Default target to main tabs root
  let target = '/(tabs)';
        try {
          const stored = await AsyncStorage.getItem('last_route_before_lock_v1');
          if(stored && !stored.includes('biometricLogin') && !stored.includes('login')) target = stored;
        } catch {}
  router.replace(target);
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
