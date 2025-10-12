import React, { useEffect } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import * as Animatable from "react-native-animatable";
import GradientBackground from "../src/components/GradientBackground";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ShimmerCard from "../src/components/ShimmerCard";

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
    <GradientBackground>
      <View style={styles.container}>
        <ShimmerCard colors={['#E1F5FE', '#B3E5FC', '#81D4FA']} shimmerSpeed={3500}>
          <Animatable.Image
            animation="fadeIn"
            duration={800}
            delay={200}
            source={require("../assets/splash-icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Animatable.Text animation="fadeInUp" duration={800} delay={300} style={styles.title}>
            Calm Space
          </Animatable.Text>
        </ShimmerCard>
      </View>
    </GradientBackground>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  logo: { width: 120, height: 120, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "bold", color: "#01579B" }
});
