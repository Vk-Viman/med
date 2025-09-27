import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Button, Alert, TouchableOpacity } from "react-native";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";
import { useRouter } from "expo-router";

const choices = {
  stress: ["Low", "Medium", "High"],
  mood: ["Calm", "Neutral", "Anxious"],
  goal: ["Relax", "Focus", "Sleep"],
};

function OptionRow({ label, options, value, onChange }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onChange(opt)}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label} option ${opt}${selected ? ' selected' : ''}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.toUpperCase()}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function PlanScreen() {
  const router = useRouter();
  const [stress, setStress] = useState(null);
  const [mood, setMood] = useState(null);
  const [goal, setGoal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedPlan, setSavedPlan] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadingSaved, setLoadingSaved] = useState(true);

  useEffect(() => {
    const loadSaved = async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setLoadingSaved(false); return; }
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          if (data?.plan) setSavedPlan(data.plan);
          if (data?.updatedAt) setLastUpdated(data.updatedAt);
          // Prefer V2 for summary if present
          if (data?.questionnaireV2) {
            const q = data.questionnaireV2;
            // Keep old state usage but don't override user’s in-progress answers
          }
          if (data?.questionnaire) {
            setStress(data.questionnaire.stress ?? null);
            setMood(data.questionnaire.mood ?? null);
            setGoal(data.questionnaire.goal ?? null);
          }
        }
      } catch (e) {
        console.log("Load saved plan error", e);
      } finally {
        setLoadingSaved(false);
      }
    };
    loadSaved();
  }, []);

  const formatUpdated = (ts) => {
    try {
      if(!ts) return '';
      let d;
      if (typeof ts?.toDate === 'function') d = ts.toDate();
      else if (ts instanceof Date) d = ts;
      else if (typeof ts === 'number') d = new Date(ts);
      else if (typeof ts === 'string') d = new Date(ts);
      else return '';
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString();
    } catch { return ''; }
  };

  const generatePlan = () => {
    if (!stress || !mood || !goal) return null;
    // Simple rules to pick a plan
    if (goal === "Sleep" || mood === "Anxious") return { title: "Sleep Meditation", minutes: 15 };
    if (goal === "Focus" || stress === "High") return { title: "10-min Breath Focus", minutes: 10 };
    return { title: "10-min Relaxation", minutes: 10 };
  };

  const onSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Login required", "Please login to save your plan.");
      return;
    }
    const plan = generatePlan();
    if (!plan) {
      Alert.alert("Incomplete", "Please answer all questions.");
      return;
    }
    setSaving(true);
    try {
      const now = Date.now();
      await setDoc(doc(db, "users", user.uid), {
        plan,
        questionnaire: { stress, mood, goal },
        updatedAt: now,
      }, { merge: true });
      setSavedPlan(plan);
      setLastUpdated(now);
      Alert.alert("Saved", `Your plan: ${plan.title} (${plan.minutes} min)`);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const plan = generatePlan();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Personalized Meditation Plan</Text>
      <TouchableOpacity
        onPress={() => router.push('/plan-setup')}
        accessibilityRole="button"
        accessibilityLabel="Open guided plan setup questionnaire"
        style={styles.guidedBtn}
      >
        <Text style={styles.guidedBtnText}>{savedPlan ? 'Retake questionnaire' : 'Guided setup'}</Text>
      </TouchableOpacity>
      {!loadingSaved && (
        savedPlan ? (
          <View style={styles.savedCard}>
            <Text style={styles.savedTitle}>Your saved plan</Text>
            <Text style={styles.savedText}>{savedPlan.title} \u2022 {savedPlan.minutes} min</Text>
            {formatUpdated(lastUpdated) ? (
              <Text style={styles.updatedText}>Last updated: {formatUpdated(lastUpdated)}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.planPlaceholder}>No saved plan yet. Answer below to create one.</Text>
        )
      )}
      <OptionRow label="Stress" options={choices.stress} value={stress} onChange={setStress} />
      <OptionRow label="Mood" options={choices.mood} value={mood} onChange={setMood} />
      <OptionRow label="Goal" options={choices.goal} value={goal} onChange={setGoal} />

      {(stress || mood || goal) && (
        <View style={styles.summaryPill}>
          <Text style={styles.summaryText}>
            {`Stress: ${stress || '—'} \u2022 Mood: ${mood || '—'} \u2022 Goal: ${goal || '—'}`}
          </Text>
        </View>
      )}

      {plan ? (
  <Text style={styles.plan}>Suggested: {plan.title} \u2022 {plan.minutes} min</Text>
      ) : (
        <Text style={styles.planPlaceholder}>Answer to see your plan</Text>
      )}

      <TouchableOpacity onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && { opacity:0.6 }]} accessibilityRole="button">
        <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Plan'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#E1F5FE" },
  title: { fontSize: 22, fontWeight: "bold", color: "#0288D1", marginBottom: 16 },
  label: { marginBottom: 8, color: "#01579B", fontWeight: "500" },
  row: { flexDirection: "row", gap: 8 },
  chip: { paddingVertical:10, paddingHorizontal:14, borderRadius:10, backgroundColor:'#B3E5FC' },
  chipSelected: { backgroundColor:'#0288D1' },
  chipText: { color:'#01579B', fontWeight:'700', letterSpacing:0.5 },
  chipTextSelected: { color:'#fff' },
  plan: { marginVertical: 16, fontWeight: "600", color: "#01579B" },
  planPlaceholder: { marginVertical: 16, color: "#0277BD" },
  savedCard: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 16 },
  savedTitle: { fontWeight: "700", color: "#01579B", marginBottom: 4 },
  savedText: { color: "#0277BD" },
  updatedText: { color: "#757575", fontSize: 12, marginTop: 2 },
  saveBtn:{ marginTop:12, backgroundColor:'#0288D1', paddingVertical:12, borderRadius:10, alignItems:'center' },
  saveBtnText:{ color:'#fff', fontWeight:'800', letterSpacing:0.3 }
  ,summaryPill:{ backgroundColor:'#E3F2FD', borderRadius:12, paddingVertical:8, paddingHorizontal:12, marginTop:4 },
  summaryText:{ color:'#01579B', fontWeight:'700' }
  ,guidedBtn:{ alignSelf:'flex-start', backgroundColor:'#E3F2FD', paddingVertical:10, paddingHorizontal:14, borderRadius:10, marginBottom:10 }
  ,guidedBtnText:{ color:'#0288D1', fontWeight:'800' }
});
