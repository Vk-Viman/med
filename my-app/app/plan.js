import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Button, Alert, TouchableOpacity, ScrollView, ToastAndroid, Platform } from "react-native";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";
import { generateAndSavePlan } from "../src/services/planService";
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
  const [qv2, setQv2] = useState(null);
  const [planFreshAt, setPlanFreshAt] = useState(null);

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
          if (data?.planAiUpdatedAt) setPlanFreshAt(data.planAiUpdatedAt);
          // Prefer V2 for summary if present
          if (data?.questionnaireV2) setQv2(data.questionnaireV2);
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
      const diffMs = Date.now() - d.getTime();
      const mins = Math.round(diffMs/60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.round(mins/60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.round(hrs/24);
      return `${days}d ago`;
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

  const onRecalculatePlan = async () => {
    try {
      setSaving(true);
      const { plan, schedule } = await generateAndSavePlan({ forceRefresh: true, schedule: true });
      setSavedPlan(plan);
      const fresh = Date.now();
      setPlanFreshAt(fresh);
      // Toast/snackbar with next reminder window (always show feedback)
      const pad = (n) => String(n).padStart(2,'0');
      const showMsg = (msg) => {
        if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT); else Alert.alert('Scheduling', msg);
      };
      if (schedule && schedule.scheduled) {
        const when = `${pad(schedule.hour)}:${pad(schedule.minute)}`;
        const msg = schedule.backup ? `Next reminder ~${when} (backup ${pad(schedule.backup.hour)}:${pad(schedule.backup.minute)})` : `Next reminder ~${when}`;
        showMsg(msg);
      } else {
        try {
          const { getAdaptiveSettings } = await import('../src/services/adaptiveNotifications');
          const s = await getAdaptiveSettings();
          const base = `${pad(Number(s.baseHour||8))}:${pad(Number(s.baseMinute||0))}`;
          const reason = schedule?.reason || 'not-scheduled';
          let msg = `Reminders not scheduled (${reason}). Baseline: ~${base}`;
          if (reason === 'quiet-hours') msg = `Quiet hours now. Baseline reminder ~${base}`;
          if (reason === 'recent-completion' || reason === 'recent-nudge') msg = `Cooldown active. Baseline reminder ~${base}`;
          showMsg(msg);
        } catch {
          showMsg('Reminders updated.');
        }
      }
    } catch (e) {
      Alert.alert('Error', e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const plan = generatePlan();

  const renderQv2Summary = () => {
    if (!qv2) return null;
    const parts = [];
    if (Array.isArray(qv2.goals) && qv2.goals.length) parts.push(`Goals: ${qv2.goals.join(', ')}`);
    if (qv2.experience) parts.push(`Level: ${qv2.experience}`);
    if (qv2.duration) parts.push(`Duration: ${qv2.duration} min`);
    if (Array.isArray(qv2.times) && qv2.times.length) parts.push(`Times: ${qv2.times.join(', ')}`);
    if (Array.isArray(qv2.focusAreas) && qv2.focusAreas.length) parts.push(`Focus: ${qv2.focusAreas.join(', ')}`);
    return (
      <View style={styles.qv2Card} accessibilityRole="summary">
        <Text style={styles.qv2Title}>Your preferences</Text>
        <Text style={styles.qv2Text}>{parts.join(' \u2022 ') || 'No preferences yet.'}</Text>
        <TouchableOpacity onPress={() => router.push('/plan-setup')} style={styles.qv2EditBtn} accessibilityRole="button" accessibilityLabel="Retake questionnaire">
          <Text style={styles.qv2EditText}>Edit preferences</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Personalized Meditation Plan</Text>
        <TouchableOpacity
          onPress={() => router.push('/your-plan')}
          accessibilityRole="button"
          accessibilityLabel="Open AI-powered weekly plan"
          style={[styles.guidedBtn, { backgroundColor:'#D1ECF9' }]}
        >
          <Text style={[styles.guidedBtnText,{ color:'#01579B' }]}>View Your Plan (AI)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRecalculatePlan}
          accessibilityRole="button"
          accessibilityLabel="Recalculate AI plan and reschedule reminders"
          style={[styles.guidedBtn, { backgroundColor:'#C8F7C5' }]}
        >
          <Text style={[styles.guidedBtnText,{ color:'#0A7A0A' }]}>Recalculate plan</Text>
        </TouchableOpacity>
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
        {!!planFreshAt && (
          <View style={[styles.savedCard,{ marginTop:8 }]}> 
            <Text style={styles.savedTitle}>AI plan freshness</Text>
            <Text style={styles.savedText}>Updated {formatUpdated(planFreshAt)}</Text>
          </View>
        )}
        {renderQv2Summary()}
        <OptionRow label="Stress" options={choices.stress} value={stress} onChange={setStress} />
        <OptionRow label="Mood" options={choices.mood} value={mood} onChange={setMood} />
        <OptionRow label="Goal" options={choices.goal} value={goal} onChange={setGoal} />

        {(stress || mood || goal) && (
          <View style={styles.summaryPill}>
            <Text style={styles.summaryText}>
              {`Stress: ${stress || '\u2014'} \u2022 Mood: ${mood || '\u2014'} \u2022 Goal: ${goal || '\u2014'}`}
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
      </ScrollView>
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
