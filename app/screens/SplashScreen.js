import React, { useEffect } from "react";
import { View, Text, StyleSheet, Image } from "react-native";

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    setTimeout(() => {
      navigation.replace("LoginScreen");
    }, 2000);
  }, []);

  return (
    <View style={styles.container}>
      <Image source={require("../../assets/splash.png")} style={styles.logo} />
      <Text style={styles.title}>Calm Space</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#B3E5FC" },
  logo: { width: 120, height: 120, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "bold", color: "#01579B" }
});
