import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { auth, db } from "../firebase/firebaseConfig";
import { collection, query, where, Timestamp, getDocs } from 'firebase/firestore';

function Sparkline({ data = [] }){
  if(!data.length) return null;
  const max = Math.max(...data, 1);
  const points = data.map((v,i)=>{
    const x = (i/(data.length-1))*100;
    const y = 100 - (v/max)*100;
    return `${x},${y}`;
  }).join(' ');
  return (
    <View style={{ marginTop:16 }} accessible accessibilityLabel={`Last 7 days minutes trend. Max ${max} minutes.`}>
      <Text style={styles.sparkTitle}>Last 7 Days</Text>
      <View style={styles.sparkWrap}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width:'100%', height:'100%' }}>
          <polyline fill="none" stroke="#0288D1" strokeWidth="2" points={points} />
        </svg>
      </View>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const [trend, setTrend] = useState([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  useEffect(()=>{
    (async()=>{
      try {
        const user = auth.currentUser; if(!user) return;
        const now = new Date();
        const start = new Date(now); start.setDate(now.getDate()-6); start.setHours(0,0,0,0);
        const q = query(collection(db, 'users', user.uid, 'sessions'), where('endedAt','>=', Timestamp.fromDate(start)));
        const snap = await getDocs(q);
        const arrSec = [0,0,0,0,0,0,0];
        let total = 0;
        snap.forEach(doc=>{ 
          const d=doc.data(); 
          if(!d.durationSec||!d.endedAt) return; 
          const idx = Math.max(0, Math.min(6, Math.floor((d.endedAt.toDate()-start)/(24*60*60*1000)))); 
          arrSec[idx]+=d.durationSec;
          total += d.durationSec;
        });
        const arrMin = arrSec.map(s=> Math.round((s/60)*10)/10);
        setTrend(arrMin);
        setTotalMinutes(Math.round(total/60));
      } catch {}
    })();
  },[]);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.emoji}>🌅</Text>
        <Text style={styles.title}>Welcome to Calm Space</Text>
        <Text style={styles.subtitle}>Guided Meditation & Stress Relief</Text>
      </View>
      <View style={styles.statsCard}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalMinutes}</Text>
          <Text style={styles.statLabel}>Minutes This Week</Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.startButton} 
        onPress={() => navigation.navigate("MeditationPlayerScreen")}
        activeOpacity={0.85}
      >
        <Text style={styles.startButtonIcon}>▶️</Text>
        <Text style={styles.startButtonText}>Start Meditation</Text>
      </TouchableOpacity>
      <Sparkline data={trend} />
      <View style={styles.motivationCard}>
        <Text style={styles.motivationText}>
          "Peace comes from within. Do not seek it without."
        </Text>
        <Text style={styles.motivationAuthor}>— Buddha</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#B3E5FC",
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: { 
    fontSize: 32, 
    fontWeight: "bold", 
    color: "#01579B", 
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: { 
    fontSize: 18, 
    color: "#0277BD",
    textAlign: "center",
    opacity: 0.85,
  },
  statsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    alignItems: "center",
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 48,
    fontWeight: "800",
    color: "#0288D1",
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#607D8B",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0288D1",
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  startButtonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  sparkTitle:{ 
    fontSize:16, 
    fontWeight:'700', 
    color:'#01579B', 
    marginBottom:8,
    textAlign: "center",
  },
  sparkWrap:{ 
    width:"100%", 
    height:80, 
    backgroundColor:'#FFFFFF', 
    borderRadius:16, 
    padding:8,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  motivationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  motivationText: {
    fontSize: 16,
    fontStyle: "italic",
    color: "#455A64",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 8,
  },
  motivationAuthor: {
    fontSize: 14,
    color: "#0277BD",
    textAlign: "center",
    fontWeight: "600",
  },
});
