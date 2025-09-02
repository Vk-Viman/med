import React, { useEffect, useState } from "react";
import { View, Text, Button, Platform, StyleSheet, Alert } from "react-native";
import * as Notifications from "expo-notifications";
import { auth, db } from "../firebase/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export default function NotificationsScreen() {
  const [permission, setPermission] = useState(null);
  const [pref, setPref] = useState("morning");
  const [scheduled, setScheduled] = useState(false);

  useEffect(() => {
    (async () => {
      const settings = await Notifications.getPermissionsAsync();
      setPermission(settings.granted);
    })();
  }, []);

  const schedule = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert("Login required");
    const res = await Notifications.requestPermissionsAsync();
    if (!res.granted) return setPermission(false);
    setPermission(true);

    // cancel previous
    await Notifications.cancelAllScheduledNotificationsAsync();

    // schedule next 7 days as a simple stand-in (Expo Go limitation)
    const hour = pref === "morning" ? 8 : 20;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const when = new Date(now);
      when.setDate(now.getDate() + i);
      when.setHours(hour, 0, 0, 0);
      if (when > now) {
        await Notifications.scheduleNotificationAsync({
          content: { title: "Time to meditate", body: "Take a few minutes today." },
          trigger: when,
        });
      }
    }
    await setDoc(doc(db, "users", user.uid), { notificationPreference: pref }, { merge: true });
    setScheduled(true);
    Alert.alert("Scheduled", `Daily reminders set for ${pref}.`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily Reminders</Text>
      <Text style={styles.subtitle}>This uses local notifications in Expo Go. For FCM push, build a dev client.</Text>
      <View style={styles.row}>
        <Button title="Morning" onPress={() => setPref("morning")} color={pref === "morning" ? "#0288D1" : "#B3E5FC"} />
        <Button title="Evening" onPress={() => setPref("evening")} color={pref === "evening" ? "#0288D1" : "#B3E5FC"} />
      </View>
      <Button title="Enable Reminders" onPress={schedule} />
      {scheduled ? <Text style={styles.note}>Reminders scheduled for the next 7 days.</Text> : null}
      {permission === false ? <Text style={styles.error}>Notifications permission denied.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#E1F5FE" },
  title: { fontSize: 22, fontWeight: "bold", color: "#0288D1", marginBottom: 8 },
  subtitle: { color: "#0277BD", marginBottom: 16 },
  row: { flexDirection: "row", gap: 8, marginBottom: 12 },
  note: { marginTop: 8, color: "#01579B" },
  error: { marginTop: 8, color: "red" },
});
