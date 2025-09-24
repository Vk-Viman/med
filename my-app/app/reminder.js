import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Button, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { scheduleLocalNotification, cancelAllLocalNotifications } from "../src/notifications";

export default function ReminderScreen() {
  const schedule = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await scheduleLocalNotification({ hour: 8, minute: 0 });
  };

  const cancelAll = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await cancelAllLocalNotifications();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Reminder Settings</Text>
      <Text style={styles.subtitle}>Schedule a daily local reminder (Expo Go compatible)</Text>
      <View style={styles.row}><Button title="Schedule 8:00 AM" onPress={schedule} /></View>
      <View style={styles.row}><Button title="Cancel All" color="#d9534f" onPress={cancelAll} /></View>
      <Text style={styles.note}>You can change the time later or add a time picker.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 8 },
  subtitle: { color: "#667", marginBottom: 16 },
  row: { marginVertical: 6 },
  note: { marginTop: 12, color: "#889" },
});
