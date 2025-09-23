import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, FlatList } from "react-native";
import GradientBackground from "../src/components/GradientBackground";
import { db, auth } from "../firebase/firebaseConfig";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { LineChart } from "react-native-chart-kit";
import CryptoJS from "crypto-js";
import { Dimensions } from "react-native";
import Card from "../src/components/Card";

export default function WellnessReport() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchEntries = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const q = query(collection(db, `users/${uid}/moods`), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const data = [];
      snap.forEach(doc => {
        const d = doc.data();
        let note = "";
        try {
          const key = CryptoJS.enc.Hex.parse(CryptoJS.SHA256(uid + "-key").toString());
          const iv = CryptoJS.enc.Hex.parse(CryptoJS.SHA256(uid + "-iv").toString().slice(0, 32));
          note = CryptoJS.AES.decrypt(d.note, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString(CryptoJS.enc.Utf8);
        } catch {}
        data.push({ ...d, note, id: doc.id });
      });
      setEntries(data);
      setLoading(false);
    };
    fetchEntries();
  }, []);

  const chartData = {
    labels: entries.slice(0, 7).map(e => new Date(e.createdAt?.seconds * 1000).toLocaleDateString()),
    datasets: [
      { data: entries.slice(0, 7).map(e => e.stress || 0) },
    ],
  };

  const ListHeader = () => (
    <View>
      <Text style={styles.heading}>Wellness Report</Text>
      {entries.length > 0 ? (
        <Card>
          <LineChart
            data={chartData}
            width={Dimensions.get("window").width - 32}
            height={180}
            chartConfig={{
              backgroundColor: "transparent",
              backgroundGradientFrom: "#FFFFFF",
              backgroundGradientTo: "#FFFFFF",
              color: (opacity = 1) => `rgba(2, 136, 209, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(1, 87, 155, ${opacity})`,
              strokeWidth: 2,
              propsForDots: { r: "4", strokeWidth: "2", stroke: "#0288D1" },
            }}
            bezier
            style={{ borderRadius: 12 }}
          />
        </Card>
      ) : <Text style={styles.label}>No data yet.</Text>}
      <Text style={styles.subheading}>Journal Entries</Text>
    </View>
  );

  return (
    <GradientBackground>
    <FlatList
      style={styles.container}
      data={entries}
      keyExtractor={e => e.id}
      ListHeaderComponent={ListHeader}
      renderItem={({ item }) => (
        <View style={styles.entry}>
          <Text style={styles.mood}>{item.mood} | Stress: {item.stress}</Text>
          <Text style={styles.note}>{item.note}</Text>
          <Text style={styles.date}>{new Date(item.createdAt?.seconds * 1000).toLocaleString()}</Text>
        </View>
      )}
      contentContainerStyle={{ paddingBottom: 24 }}
  />
  </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#01579B", marginBottom: 12 },
  subheading: { fontSize: 18, fontWeight: "600", color: "#0277BD", marginBottom: 8 },
  label: { fontSize: 16, color: "#0277BD", marginBottom: 12 },
  entry: { backgroundColor: "#fff", borderRadius: 8, padding: 12, marginBottom: 10 },
  mood: { fontSize: 16, fontWeight: "600" },
  note: { fontSize: 15, color: "#01579B", marginVertical: 4 },
  date: { fontSize: 12, color: "#90A4AE" },
});
