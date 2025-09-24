import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Calm Space</Text>
      <Text style={styles.subtitle}>Guided Meditation & Stress Relief</Text>
      <Button title="Start Meditation" onPress={() => navigation.navigate("MeditationPlayerScreen")} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#B3E5FC" },
  title: { fontSize: 26, fontWeight: "bold", color: "#01579B", marginBottom: 10 },
  subtitle: { fontSize: 18, color: "#0277BD", marginBottom: 30 }
});
