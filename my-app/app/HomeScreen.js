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
  useEffect(()=>{
    (async()=>{
      try {
        const user = auth.currentUser; if(!user) return;
        const now = new Date();
        const start = new Date(now); start.setDate(now.getDate()-6); start.setHours(0,0,0,0);
        const q = query(collection(db, 'users', user.uid, 'sessions'), where('endedAt','>=', Timestamp.fromDate(start)));
        const snap = await getDocs(q);
        const arrSec = [0,0,0,0,0,0,0];
        snap.forEach(doc=>{ const d=doc.data(); if(!d.durationSec||!d.endedAt) return; const idx = Math.max(0, Math.min(6, Math.floor((d.endedAt.toDate()-start)/(24*60*60*1000)))); arrSec[idx]+=d.durationSec; });
        const arrMin = arrSec.map(s=> Math.round((s/60)*10)/10);
        setTrend(arrMin);
      } catch {}
    })();
  },[]);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Calm Space</Text>
      <Text style={styles.subtitle}>Guided Meditation & Stress Relief</Text>
      <Button title="Start Meditation" onPress={() => navigation.navigate("MeditationPlayerScreen")} />
      <Sparkline data={trend} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#B3E5FC" },
  title: { fontSize: 26, fontWeight: "bold", color: "#01579B", marginBottom: 10 },
  subtitle: { fontSize: 18, color: "#0277BD", marginBottom: 30 },
  sparkTitle:{ fontSize:14, fontWeight:'600', color:'#01579B', marginBottom:4 },
  sparkWrap:{ width:180, height:60, backgroundColor:'#E1F5FE', borderRadius:8, padding:4 }
});
