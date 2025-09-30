import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, useWindowDimensions, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { auth, db } from "../firebase/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { generateAndSavePlan } from "../src/services/planService";

// Questionnaire schema v1
// {
//   goals: string[] (1-2)
//   experience: 'Beginner'|'Intermediate'|'Advanced'
//   duration: number (minutes)
//   times: string[] (0-3)
//   focusAreas: string[] (0-4)
// }

const GOALS = ["Relax", "Focus", "Sleep", "Manage anxiety", "Mindfulness"];
const EXPERIENCE = ["Beginner", "Intermediate", "Advanced"];
const DURATIONS = [5, 10, 15, 20, 30];
const TIMES = ["Morning", "Afternoon", "Evening", "Before bed"];
const FOCUS = ["Breathwork", "Sleep", "Stress relief", "Focus", "Gratitude", "Body scan"];

function Chip({ label, selected, onPress, testID }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}${selected ? " selected" : ""}`}
      testID={testID}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StepHeader({ title, subtitle }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.stepTitle}>{title}</Text>
      {subtitle ? <Text style={styles.stepSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export default function PlanSetup() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);

  const [goals, setGoals] = useState([]);
  const [experience, setExperience] = useState(null);
  const [duration, setDuration] = useState(null);
  const [times, setTimes] = useState([]);
  const [focusAreas, setFocusAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setLoading(false); return; }
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : null;
        const qv2 = data?.questionnaireV2 || null;
        if (qv2) {
          setGoals(Array.isArray(qv2.goals) ? qv2.goals.slice(0,2) : []);
          setExperience(qv2.experience ?? null);
          setDuration(qv2.duration ?? null);
          setTimes(Array.isArray(qv2.times) ? qv2.times : []);
          setFocusAreas(Array.isArray(qv2.focusAreas) ? qv2.focusAreas : []);
        }
      } catch (e) {
        console.log("Questionnaire load error", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const steps = useMemo(() => ([
    {
      key: "goals",
      render: () => (
        <View style={styles.stepWrap}>
          <StepHeader title="Your primary goals" subtitle="Pick up to 2" />
          <View style={styles.rowWrap}>
            {GOALS.map(g => (
              <Chip key={g} label={g} selected={goals.includes(g)} onPress={() => toggleInArray(setGoals, goals, g, 2)} testID={`goal-${g}`} />
            ))}
          </View>
          {goals.length === 0 && <Text style={styles.validation}>Select at least one goal.</Text>}
        </View>
      ),
      isValid: () => goals.length >= 1 && goals.length <= 2,
    },
    {
      key: "experience",
      render: () => (
        <View style={styles.stepWrap}>
          <StepHeader title="Experience level" />
          <View style={styles.rowWrap}>
            {EXPERIENCE.map(e => (
              <Chip key={e} label={e} selected={experience === e} onPress={() => setExperience(e)} testID={`exp-${e}`} />
            ))}
          </View>
          {!experience && <Text style={styles.validation}>Choose your level.</Text>}
        </View>
      ),
      isValid: () => !!experience,
    },
    {
      key: "duration",
      render: () => (
        <View style={styles.stepWrap}>
          <StepHeader title="Preferred session length" />
          <View style={styles.rowWrap}>
            {DURATIONS.map(d => (
              <Chip key={d} label={`${d} min`} selected={duration === d} onPress={() => setDuration(d)} testID={`dur-${d}`} />
            ))}
          </View>
          {!duration && <Text style={styles.validation}>Pick a duration.</Text>}
        </View>
      ),
      isValid: () => !!duration,
    },
    {
      key: "times",
      render: () => (
        <View style={styles.stepWrap}>
          <StepHeader title="Preferred times" subtitle="Optional" />
          <View style={styles.rowWrap}>
            {TIMES.map(t => (
              <Chip key={t} label={t} selected={times.includes(t)} onPress={() => toggleInArray(setTimes, times, t)} testID={`time-${t}`} />
            ))}
          </View>
        </View>
      ),
      isValid: () => true,
    },
    {
      key: "focus",
      render: () => (
        <View style={styles.stepWrap}>
          <StepHeader title="Focus areas" subtitle="Optional" />
          <View style={styles.rowWrap}>
            {FOCUS.map(f => (
              <Chip key={f} label={f} selected={focusAreas.includes(f)} onPress={() => toggleInArray(setFocusAreas, focusAreas, f)} testID={`focus-${f}`} />
            ))}
          </View>
        </View>
      ),
      isValid: () => true,
    },
  ]), [goals, experience, duration, times, focusAreas]);

  const next = () => {
    const step = steps[index];
    if (!step.isValid()) return; // Keep user until valid
    if (index < steps.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1 });
      setIndex(i => i + 1);
    } else {
      onSave();
    }
  };

  const back = () => {
    if (index > 0) {
      listRef.current?.scrollToIndex({ index: index - 1 });
      setIndex(i => i - 1);
    } else {
      router.back();
    }
  };

  const skip = () => {
    Alert.alert("Skip questionnaire?", "You can fill this later in Plan.", [
      { text: "Cancel", style: "cancel" },
      { text: "Skip", style: "destructive", onPress: () => router.replace("/plan") },
    ]);
  };

  const onSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Login required", "Please login to save your preferences.");
      return;
    }
    const payload = {
      goals,
      experience,
      duration,
      times,
      focusAreas,
      version: "v1",
    };
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        questionnaireV2: payload,
        questionnaireUpdatedAt: Date.now(),
      }, { merge: true });
      // Generate AI plan and schedule reminders based on preferred times
      try {
        await generateAndSavePlan({ forceRefresh: true, schedule: true });
      } catch {}
      // Offer to set reminders if user selected preferred times
      if ((times || []).length > 0) {
        const suggestion = `You picked: ${times.join(', ')}. Do you want to set reminders now?`;
        Alert.alert(
          'Set reminders?',
          suggestion,
          [
            { text: 'Later', style: 'cancel', onPress: () => router.replace('/plan') },
            { text: 'Set reminders', onPress: () => router.replace('/notifications') },
          ]
        );
      } else {
        router.replace('/plan');
      }
    } catch (e) {
      Alert.alert("Error", e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.slide, { width }]}> 
      <ScrollContent>
        {item.render()}
      </ScrollContent>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}> 
        <Text style={{ color: "#0277BD" }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={steps}
        keyExtractor={(i) => i.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(i);
        }}
      />

      <View style={styles.footer}> 
        <TouchableOpacity onPress={back} style={[styles.navBtn, { backgroundColor: "#B3E5FC" }]} accessibilityRole="button">
          <Text style={[styles.navBtnText, { color: "#01579B" }]}>{index === 0 ? "Back" : "Back"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={skip} style={[styles.navBtn, { backgroundColor: "#E3F2FD" }]} accessibilityRole="button">
          <Text style={[styles.navBtnText, { color: "#0277BD" }]}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={next} disabled={saving || !steps[index].isValid()} style={[styles.navBtn, steps[index].isValid() ? styles.cta : { opacity: 0.6 }]} accessibilityRole="button">
          <Text style={[styles.navBtnText, { color: "#fff" }]}>{index === steps.length - 1 ? (saving ? "Saving…" : "Save") : "Next"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function toggleInArray(setter, arr, value, max) {
  setter(prev => {
    const has = (arr ?? prev ?? []).includes(value);
    const base = (arr ?? prev ?? []).slice();
    if (has) return base.filter(v => v !== value);
    const next = [...base, value];
    if (typeof max === "number" && next.length > max) next.shift();
    return next;
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E1F5FE" },
  slide: { flex: 1, padding: 20, paddingBottom: 120 },
  stepWrap: { flex: 1 },
  stepTitle: { fontSize: 22, fontWeight: "800", color: "#01579B", marginBottom: 4 },
  stepSubtitle: { color: "#0277BD", marginBottom: 8 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical:10, paddingHorizontal:14, borderRadius:10, backgroundColor:'#B3E5FC', marginBottom: 8 },
  chipSelected: { backgroundColor:'#0288D1' },
  chipText: { color:'#01579B', fontWeight:'700', letterSpacing:0.3 },
  chipTextSelected: { color:'#fff' },
  validation: { color: '#D32F2F', marginTop: 8 },
  footer: { position: "absolute", bottom: 16, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  navBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  navBtnText: { fontWeight: '800', letterSpacing: 0.4 },
  cta: { backgroundColor: '#0288D1' },
});

function ScrollContent({ children }){
  return (
    <View style={{ flex:1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}
 
