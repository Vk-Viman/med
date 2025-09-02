import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Alert } from "react-native";
import { auth } from "../firebase/firebaseConfig";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { LineChart } from "react-native-chart-kit";

export default function WeeklyReportScreen() {
  const [minutesByDay, setMinutesByDay] = useState([0, 0, 0, 0, 0, 0, 0]);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);

        const q = query(
          collection(db, "users", user.uid, "sessions"),
          where("endedAt", ">=", Timestamp.fromDate(start))
        );
        const snap = await getDocs(q);
        const arr = [0, 0, 0, 0, 0, 0, 0];
        snap.forEach((doc) => {
          const d = doc.data();
          if (!d.durationSec || !d.endedAt) return;
          const dayIdx = Math.max(0, Math.min(6, Math.floor((d.endedAt.toDate() - start) / (24 * 60 * 60 * 1000))));
          arr[dayIdx] += Math.round(d.durationSec / 60);
        });
        setMinutesByDay(arr);
      } catch (e) {
        Alert.alert("Error", e.message);
      }
    };
    load();
  }, []);

  const screenWidth = Dimensions.get("window").width - 24;
  const labels = ["-6", "-5", "-4", "-3", "-2", "-1", "Today"];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekly Report</Text>
      <LineChart
        data={{ labels, datasets: [{ data: minutesByDay }] }}
        width={screenWidth}
        height={220}
        yAxisSuffix="m"
        chartConfig={{
          backgroundColor: "#E1F5FE",
          backgroundGradientFrom: "#E1F5FE",
          backgroundGradientTo: "#B3E5FC",
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(2, 136, 209, ${opacity})`,
          labelColor: () => "#01579B",
        }}
        bezier
        style={{ borderRadius: 8 }}
      />
      <Text style={styles.total}>Total minutes: {minutesByDay.reduce((a, b) => a + b, 0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#E1F5FE" },
  title: { fontSize: 22, fontWeight: "bold", color: "#0288D1", marginBottom: 8 },
  total: { marginTop: 12, fontWeight: "600", color: "#01579B" },
});
