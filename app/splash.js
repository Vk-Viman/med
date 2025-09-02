import React, { useEffect } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SplashScreen() {
  const router = useRouter();
  useEffect(() => {
    const go = async () => {
      try {
        const flagged = await AsyncStorage.getItem("cs_onboarded");
        setTimeout(() => {
          router.replace(flagged ? "login" : "onboarding");
        }, 1200);
      } catch {
        router.replace("login");
      }
    };
    go();
  }, []);

  return (
    <View style={styles.container}>
      <Image source={require("../assets/splash-icon.png")} style={styles.logo} />
      <Text style={styles.title}>Calm Space</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#B3E5FC" },
  logo: { width: 120, height: 120, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "bold", color: "#01579B" }
});
