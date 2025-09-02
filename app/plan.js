import React, { useState } from "react";
import { View, Text, StyleSheet, Button, Alert } from "react-native";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";

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
        {options.map((opt) => (
          <Button
            key={opt}
            title={opt}
            onPress={() => onChange(opt)}
            color={value === opt ? "#0288D1" : "#B3E5FC"}
          />
        ))}
      </View>
    </View>
  );
}

export default function PlanScreen() {
  const [stress, setStress] = useState(null);
  const [mood, setMood] = useState(null);
  const [goal, setGoal] = useState(null);
  const [saving, setSaving] = useState(false);

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
      await setDoc(doc(db, "users", user.uid), {
        plan,
        questionnaire: { stress, mood, goal },
        updatedAt: Date.now(),
      }, { merge: true });
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
      <OptionRow label="Stress" options={choices.stress} value={stress} onChange={setStress} />
      <OptionRow label="Mood" options={choices.mood} value={mood} onChange={setMood} />
      <OptionRow label="Goal" options={choices.goal} value={goal} onChange={setGoal} />

      {plan ? (
        <Text style={styles.plan}>Suggested: {plan.title} • {plan.minutes} min</Text>
      ) : (
        <Text style={styles.planPlaceholder}>Answer to see your plan</Text>
      )}

      <Button title={saving ? "Saving..." : "Save Plan"} onPress={onSave} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#E1F5FE" },
  title: { fontSize: 22, fontWeight: "bold", color: "#0288D1", marginBottom: 16 },
  label: { marginBottom: 8, color: "#01579B", fontWeight: "500" },
  row: { flexDirection: "row", gap: 8 },
  plan: { marginVertical: 16, fontWeight: "600", color: "#01579B" },
  planPlaceholder: { marginVertical: 16, color: "#0277BD" },
});
