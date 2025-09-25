import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Alert, Platform, ScrollView, AccessibilityInfo, InteractionManager, findNodeHandle } from "react-native";
import GradientBackground from "../src/components/GradientBackground";
import Card from "../src/components/Card";
import { auth } from "../firebase/firebaseConfig";
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { LineChart } from "react-native-chart-kit";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const BIOMETRIC_PREF_KEY = 'pref_biometric_enabled_v1';

export default function WeeklyReportScreen() {
  const [minutesByDay, setMinutesByDay] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [unlocked, setUnlocked] = useState(false);
  const router = useRouter();
  const titleRef = useRef(null);

  // Biometric gate on enter (if user enabled it)
  useEffect(() => {
    (async () => {
      try {
        const pref = await AsyncStorage.getItem(BIOMETRIC_PREF_KEY);
        const enabled = pref === '1';
        if (!enabled) { setUnlocked(true); return; }
        // Skip on web
        if (Platform.OS === 'web') { setUnlocked(true); return; }
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !enrolled) { setUnlocked(true); return; }
        const res = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock report" });
        if (res.success) { setUnlocked(true); } else { Alert.alert('Locked', 'Biometric authentication canceled.'); try { router.back(); } catch {} }
      } catch {
        setUnlocked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    const user = auth.currentUser;
    if (!user) return;
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    try {
      const q = query(
        collection(db, "users", user.uid, "sessions"),
        where("endedAt", ">=", Timestamp.fromDate(start))
      );
      const unsub = onSnapshot(q, (snap) => {
        const arrSec = [0, 0, 0, 0, 0, 0, 0];
        snap.forEach((doc) => {
          const d = doc.data();
          if (!d.durationSec || !d.endedAt) return;
          const dayIdx = Math.max(0, Math.min(6, Math.floor((d.endedAt.toDate() - start) / (24 * 60 * 60 * 1000))));
          arrSec[dayIdx] += d.durationSec;
        });
        // Convert to minutes with one decimal so short sessions show up
        const arrMin = arrSec.map((s) => Math.round((s / 60) * 10) / 10);
        setMinutesByDay(arrMin);
      });
      return () => unsub();
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  }, [unlocked]);

  // Announce screen and focus heading after interactions
  useEffect(() => {
    if (!unlocked) return;
    const t = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
          if (!enabled) return;
          try {
            const tag = findNodeHandle(titleRef.current);
            if (tag) AccessibilityInfo.setAccessibilityFocus?.(tag);
          } catch {}
          AccessibilityInfo.announceForAccessibility('Weekly Report. Meditation minutes for the past week.');
        }).catch(()=>{});
      });
    }, 400);
    return () => clearTimeout(t);
  }, [unlocked]);

  const screenWidth = Dimensions.get("window").width - 24;
  // Build labels as dates (e.g., 17, 18, 19, ..., Today)
  const dateLabels = (() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const arr = [];
    for (let i = 6; i >= 1; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      arr.push(d.toLocaleDateString(undefined, { day: "2-digit" }));
    }
    arr.push("Today");
    return arr;
  })();

  const noData = minutesByDay.every((v) => v === 0);

  return (
    <GradientBackground>
      <ScrollView style={{ flex:1 }} contentContainerStyle={styles.container}>
  <Text ref={titleRef} style={styles.title} accessibilityRole='header' accessibilityLabel='Weekly Report'>Weekly Report</Text>
        <Card>
          <LineChart
            data={{ labels: dateLabels, datasets: [{ data: minutesByDay }] }}
            width={screenWidth}
            height={220}
            yAxisSuffix="m"
            chartConfig={{
              backgroundColor: "transparent",
              backgroundGradientFrom: "#FFFFFF",
              backgroundGradientTo: "#FFFFFF",
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(2, 136, 209, ${opacity})`,
              labelColor: () => "#01579B",
            }}
            bezier
            style={{ borderRadius: 12 }}
          />
        </Card>
        <Text style={styles.total}>Total minutes: {minutesByDay.reduce((a, b) => a + b, 0).toFixed(1)}</Text>
        {noData && (
          <Text style={styles.hint}>Tip: press Play for a short session, then Pause to log it.</Text>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: "bold", color: "#0288D1", marginBottom: 8 },
  total: { marginTop: 12, fontWeight: "600", color: "#01579B" },
  hint: { marginTop: 8, color: "#607D8B" },
});
