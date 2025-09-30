import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Button, StyleSheet, TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import { scheduleLocalNotification, cancelAllLocalNotifications } from "../src/notifications";
import { getAdaptiveSettings, setAdaptiveSettings, runAdaptiveScheduler, registerNotificationActions } from "../src/services/adaptiveNotifications";
import { auth, db } from "../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

export default function ReminderScreen() {
  const [suggestedTimes, setSuggestedTimes] = useState([]);
  const [adaptive, setAdaptive] = useState({ enabled: true, baseHour: 8, baseMinute: 0, quietStart: '22:00', quietEnd: '07:00', cooldownMin: 120, backupEnabled: true, backupHour: 15, backupMinute: 0 });
  const TIMES = [
    { key: 'Morning', hour: 8, minute: 0 },
    { key: 'Afternoon', hour: 13, minute: 0 },
    { key: 'Evening', hour: 18, minute: 0 },
    { key: 'Before bed', hour: 22, minute: 0 },
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : null;
        const qv2 = data?.questionnaireV2;
        if (Array.isArray(qv2?.times)) setSuggestedTimes(qv2.times);
        const s = await getAdaptiveSettings();
        setAdaptive(s);
        await registerNotificationActions();
      } catch (e) {
        // noop
      }
    };
    load();
  }, []);

  const schedule = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await scheduleLocalNotification({ hour: 8, minute: 0 });
  };

  const cancelAll = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await cancelAllLocalNotifications();
  };

  const saveAdaptive = async (patch) => {
    const next = { ...adaptive, ...patch };
    setAdaptive(next);
    await setAdaptiveSettings(patch);
  };

  const runAdaptive = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const r = await runAdaptiveScheduler();
    if(__DEV__) console.log('[adaptive]', r);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Reminder Settings</Text>
      <Text style={styles.subtitle}>Schedule a daily local reminder (Expo Go compatible)</Text>
      {suggestedTimes.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>From your preferences</Text>
          <View style={styles.row}>
            {TIMES.filter(t => suggestedTimes.includes(t.key)).map(t => (
              <TouchableOpacity key={t.key} style={styles.chip} onPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); await scheduleLocalNotification({ hour: t.hour, minute: t.minute }); }}>
                <Text style={styles.chipText}>{t.key}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.cardNote}>Tap a time to schedule a daily reminder.</Text>
        </View>
      )}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Adaptive reminders</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.chip, adaptive.enabled && styles.chipActive]} onPress={() => saveAdaptive({ enabled: !adaptive.enabled })}>
            <Text style={[styles.chipText, adaptive.enabled && styles.chipTextActive]}>{adaptive.enabled ? 'Enabled' : 'Disabled'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => saveAdaptive({ baseHour: (adaptive.baseHour+1)%24 })}>
            <Text style={styles.chipText}>Base {String(adaptive.baseHour).padStart(2,'0')}:{String(adaptive.baseMinute).padStart(2,'0')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => saveAdaptive({ quietStart: adaptive.quietStart==='22:00'?'21:00':'22:00' })}>
            <Text style={styles.chipText}>Quiet {adaptive.quietStart}-{adaptive.quietEnd}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => saveAdaptive({ quietEnd: adaptive.quietEnd==='07:00'?'06:30':'07:00' })}>
            <Text style={styles.chipText}>Quiet End {adaptive.quietEnd}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => saveAdaptive({ cooldownMin: Math.max(30, (adaptive.cooldownMin+30)%300) })}>
            <Text style={styles.chipText}>Cooldown {adaptive.cooldownMin}m</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, adaptive.backupEnabled && styles.chipActive]} onPress={() => saveAdaptive({ backupEnabled: !adaptive.backupEnabled })}>
            <Text style={[styles.chipText, adaptive.backupEnabled && styles.chipTextActive]}>{adaptive.backupEnabled ? 'Backup ON' : 'Backup OFF'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => saveAdaptive({ backupHour: (adaptive.backupHour + 1) % 24 })}>
            <Text style={styles.chipText}>Backup {String(adaptive.backupHour).padStart(2,'0')}:{String(adaptive.backupMinute).padStart(2,'0')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <Button title="Run adaptive now" onPress={runAdaptive} />
        </View>
        <Text style={styles.cardNote}>Adaptive: shifts time based on engagement, suppresses during quiet hours, and respects recent completion cooldown.</Text>
      </View>
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
  row: { marginVertical: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { marginTop: 12, color: "#889" },
  card: { marginTop: 8, padding: 12, backgroundColor: '#E3F2FD', borderRadius: 12 },
  cardTitle: { fontWeight: '800', color: '#01579B', marginBottom: 8 },
  cardNote: { color: '#0277BD', marginTop: 6, fontSize: 12 },
  chip: { backgroundColor: '#B3E5FC', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  chipActive: { backgroundColor: '#0288D1' },
  chipText: { color: '#01579B', fontWeight: '700' },
  chipTextActive: { color: 'white' }
});
