import React, { useEffect, useRef, useState } from "react";
// Polyfill global.crypto for crypto-js in Expo Go using expo-crypto
import * as ExpoCrypto from "expo-crypto";
// ensure getRandomValues exists (react-native-get-random-values also patches)
if (typeof global === "object" && (typeof global.crypto === "undefined" || typeof global.crypto.getRandomValues !== "function")) {
  global.crypto = global.crypto || {};
  global.crypto.getRandomValues = (arr) => {
    const bytes = ExpoCrypto.getRandomBytes(arr.length);
    for (let i = 0; i < arr.length; i++) arr[i] = bytes[i];
    return arr;
  };
}
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, FlatList, Animated, useWindowDimensions, Switch } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import GradientBackground from "../src/components/GradientBackground";
import MarkdownPreview from "../src/components/MarkdownPreview";
import Slider from "@react-native-community/slider";
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from "expo-router";
import { db, auth } from "../firebase/firebaseConfig";
import { serverTimestamp } from "firebase/firestore"; // kept if still needed elsewhere
import PrimaryButton from "../src/components/PrimaryButton";
import CryptoJS from "crypto-js"; // legacy encryption retained for now
import { createMoodEntry, flushQueue } from "../src/services/moodEntries";
// Ensure CryptoJS uses secure RNG from crypto.getRandomValues
try {
  const originalRandom = CryptoJS.lib.WordArray.random;
  CryptoJS.lib.WordArray.random = function (nBytes) {
    const bytes = new Uint8Array(nBytes);
    if (!global.crypto || typeof global.crypto.getRandomValues !== "function") {
      if (__DEV__) {
        // Dev-only fallback to avoid crashes during Remote JS Debugging
        for (let i = 0; i < nBytes; i++) bytes[i] = Math.floor(Math.random() * 256);
      } else {
        throw new Error("Secure RNG unavailable");
      }
    } else {
      global.crypto.getRandomValues(bytes);
    }
    return CryptoJS.lib.WordArray.create(bytes);
  };
} catch {}

// Properly encoded emoji characters (previous values were mojibake)
const baseMoods = [
  { key: "happy", emoji: "😊", label: "Happy" },
  { key: "sad", emoji: "😢", label: "Sad" },
  { key: "calm", emoji: "😌", label: "Calm" },
  { key: "stressed", emoji: "😣", label: "Stressed" },
];

const OTHER_KEY = "other";
const STORAGE_KEY = "lastSelectedMood";
const STORAGE_OTHER_EMOJI = "lastOtherEmoji";

// Minimal emoji set for picker (could be expanded)
const extraEmojis = [
  "😀","😁","😃","😄","😅","😉","🙂","🥲","😍","🤩","🥳","😎","🤔","😴","😕","😟","😡","😤","😭","😇","🤗","😪","😬","🤯","😱","😰","😓","😵","😶","😷"
];

// MarkdownPreview now imported from shared component

export default function MoodTracker() {
  const { width } = useWindowDimensions();
  // Compute size so 5 buttons + margins fit (side padding ~24*2 and horizontal gaps ~4*8 total)
  const usable = width - 48 - (4 * 8);
  const btnSize = Math.min(72, Math.max(56, Math.floor(usable / 5)));
  const fontSize = Math.round(btnSize * 0.6);
  const [mood, setMood] = useState(null); // key OR OTHER_KEY
  const [otherEmoji, setOtherEmoji] = useState("💫");
  const [stress, setStress] = useState(5);
  const lastHapticStress = useRef(stress);
  const stressAnim = useRef(new Animated.Value(5)).current;

  // Animate aura when stress changes
  useEffect(()=>{
    Animated.timing(stressAnim, { toValue: stress, duration: 220, useNativeDriver:false }).start();
  }, [stress]);

  const stressColor = stressAnim.interpolate({
    inputRange:[0,2,4,6,8,10],
    // Removed deep navy (#01579B); inserted light orange (#FFA726) transition
    outputRange:["#4FC3F7","#29B6F6","#0288D1","#FFA726","#EF6C00","#D32F2F"]
  });

  const qualitative = (() => {
    if (stress <= 1) return 'Calm';
    if (stress <= 3) return 'Centered';
    if (stress <= 5) return 'Manageable';
    if (stress <= 7) return 'Elevated';
    if (stress <= 8) return 'High';
    return 'Overwhelmed';
  })();
  const [note, setNote] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const MAX_NOTE = 500;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [tooltip, setTooltip] = useState(null); // {key, label}
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const hideTooltipTimeout = useRef(null);

  // Animated scale map per mood key
  const scalesRef = useRef({});
  const getScale = (k) => {
    if (!scalesRef.current[k]) {
      scalesRef.current[k] = new Animated.Value(1);
    }
    return scalesRef.current[k];
  };

  const moods = [...baseMoods, { key: OTHER_KEY, emoji: otherEmoji, label: "Other" }];

  // Load last selection
  useEffect(() => {
    (async () => {
      try {
        const [savedMood, savedOther] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(STORAGE_OTHER_EMOJI),
        ]);
        if (savedOther) setOtherEmoji(savedOther);
        if (savedMood) setMood(savedMood);
      } catch {}
    })();
  }, []);

  // Debounced persistence of mood & custom emoji
  const debounceTimer = useRef(null);
  const DEBOUNCE_MS = 500;
  useEffect(() => {
    if (!mood) return; // nothing to persist
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, mood);
        if (mood === OTHER_KEY) await AsyncStorage.setItem(STORAGE_OTHER_EMOJI, otherEmoji);
      } catch {}
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [mood, otherEmoji]);

  const flushPersistence = async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!mood) return;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mood);
      if (mood === OTHER_KEY) await AsyncStorage.setItem(STORAGE_OTHER_EMOJI, otherEmoji);
    } catch {}
  };

  const selectMood = (k) => {
    setMood(k);
    // Haptic variation: medium impact for standard moods, lighter for opening the picker
    if (k === OTHER_KEY) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const scale = getScale(k);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.15, duration: 110, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true })
    ]).start();
    if (k === OTHER_KEY) setShowPicker(true);
  };

  const hideTooltip = () => {
    Animated.timing(tooltipOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setTooltip((t) => (t ? null : t));
    });
  };

  const onLongPress = (m) => {
    if (hideTooltipTimeout.current) clearTimeout(hideTooltipTimeout.current);
    setTooltip({ key: m.key, label: m.label });
    Animated.timing(tooltipOpacity, { toValue: 1, duration: 140, useNativeDriver: true }).start();
    hideTooltipTimeout.current = setTimeout(() => hideTooltip(), 1200);
  };

  const chooseOther = (emoji) => {
    setOtherEmoji(emoji);
    setShowPicker(false);
    setMood(OTHER_KEY);
  };

  const selectedMoodLabel = () => {
    if(!mood) return 'No mood selected';
    if(mood === OTHER_KEY) return 'Custom mood';
    const found = baseMoods.find(m=> m.key===mood);
    return found? found.label : 'Mood';
  };

  const stressCoaching = (() => {
    const v = Number(stress) || 0;
    if (v <= 1) return 'Great baseline. Keep it up.';
    if (v <= 3) return 'Breathing steady. Stay present.';
    if (v <= 5) return 'Manageable. A short stretch helps.';
    if (v <= 7) return 'Try a 2-min breathing break.';
    if (v <= 8) return 'High load. Pause and reset soon.';
    return 'Very high. Do a calming exercise.';
  })();

  const saveEntry = async () => {
    if (!mood) return; // disabled state prevents
    setLoading(true);
    try {
      await flushPersistence();
      await createMoodEntry({ mood, stress, note });
      await flushQueue();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSuccess(true);
      setTimeout(()=> setShowSuccess(false), 1600);
      setMood(null); setStress(5); setNote("");
      setTimeout(()=> router.back(), 900);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Save Failed', e.message || 'Unknown error');
    }
    setLoading(false);
  };

  return (
    <GradientBackground>
    <View style={styles.container}>
      <Text style={styles.heading} accessibilityRole='header'>How are you feeling?</Text>
      <Text style={styles.subheading}>Tap a mood, adjust stress, optionally journal.</Text>
      <View style={styles.moodRow}>
        {moods.map(m => {
          const scale = getScale(m.key);
          return (
            <TouchableOpacity
              key={m.key}
              onPress={() => selectMood(m.key)}
              onLongPress={() => onLongPress(m)}
              delayLongPress={300}
              activeOpacity={0.85}
              accessibilityRole='button'
              accessibilityLabel={`${m.label || 'Other'} mood option`}
              {...(mood === m.key ? { accessibilityState:{ selected:true } } : {})}
            >
              <Animated.View style={[styles.moodBtn, { width: btnSize, height: btnSize, borderRadius: btnSize/2 }, mood === m.key && styles.selected, { transform: [{ scale }] }]}>            
                <Text style={[styles.mood, { fontSize, lineHeight: fontSize + 4 }]}>{m.emoji}</Text>
                {m.key === OTHER_KEY && mood === OTHER_KEY && (
                  <View style={styles.editBadge}><Text style={styles.editBadgeText}>✎</Text></View>
                )}
              </Animated.View>
              {tooltip && tooltip.key === m.key && (
                <Animated.View style={[styles.tooltip, {
                  opacity: tooltipOpacity,
                  transform: [{ translateY: tooltipOpacity.interpolate({ inputRange: [0,1], outputRange: [4,0] }) }]
                }]} pointerEvents="none">
                  <Text style={styles.tooltipText}>{m.label}</Text>
                </Animated.View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.selectedMood} accessibilityLiveRegion='polite'>Selected: {selectedMoodLabel()}</Text>
      <View style={styles.stressHeaderRow}>
        <Text style={styles.label}>Stress Level: {Number(stress)}</Text>
        <Animated.View style={[styles.stressAura,{ backgroundColor: stressColor }]}> 
          <Text style={styles.stressAuraText}>{Number(stress)}</Text>
        </Animated.View>
      </View>
      <View style={styles.sliderBlock}>
        <LinearGradient
          colors={["#4FC3F7","#29B6F6","#0288D1","#FFA726","#EF6C00","#D32F2F"]}
          start={{ x:0, y:0 }} end={{ x:1, y:0 }}
          style={styles.gradientTrack}
        >
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={10}
            step={1}
            value={stress}
            onValueChange={(v)=>{
              setStress(v);
              // Haptic tiers only when value changes and skip rapid repeats
              if (lastHapticStress.current !== v) {
                let style = Haptics.ImpactFeedbackStyle.Light;
                if (v >= 7) style = Haptics.ImpactFeedbackStyle.Heavy; else if (v >=4) style = Haptics.ImpactFeedbackStyle.Medium;
                Haptics.impactAsync(style);
                lastHapticStress.current = v;
              }
            }}
            minimumTrackTintColor="transparent"
            maximumTrackTintColor="transparent"
            thumbTintColor="#FFFFFF"
            accessibilityLabel='Stress level slider'
            accessibilityHint='Adjust to record current stress from 0 to 10'
          />
        </LinearGradient>
        <View style={styles.ticksRow}>
          {[0,2,4,6,8,10].map(n => (
            <Text key={n} style={[styles.tickLabel, n===stress && styles.tickActive]}>{n}</Text>
          ))}
        </View>
        <Animated.Text style={[styles.qualitative,{ color: stressColor }]}>{qualitative}</Animated.Text>
        <Animated.Text style={styles.coaching} accessibilityLiveRegion='polite'>{stressCoaching}</Animated.Text>
      </View>
      <View style={styles.noteHeaderRow}>
        <Text style={styles.label}>Journal Note</Text>
        <View style={styles.noteMetaRow}>
          <Text style={styles.counter}>{note.length}/{MAX_NOTE}</Text>
          <View style={styles.previewToggle}>
            <Text style={styles.previewLabel}>Preview</Text>
            <Switch value={showPreview} onValueChange={setShowPreview} accessibilityLabel='Toggle markdown preview' />
          </View>
        </View>
      </View>
      {!note.length && !showPreview && (
        <Text style={styles.noteHelper}>Optional: capture context, triggers, or wins. Use buttons above for *italic* and **bold**.</Text>
      )}
      {!showPreview && (
        <>
          <View style={styles.formatBar}>
            <TouchableOpacity style={styles.formatBtn} onPress={()=>{
              // Bold formatting toggle **text**
              const { start, end } = selection;
              if(end <= start){
                // No selection – insert bold markers and place cursor between
                const insert = '**bold**';
                const newText = note.slice(0,start) + insert + note.slice(end);
                setNote(newText);
                const cursor = start + 2; // between **|bold**
                setTimeout(()=>setSelection({ start: cursor, end: cursor+4 }),0);
                return;
              }
              const selText = note.slice(start,end);
              const isWrapped = /^\*\*.*\*\*$/.test(selText);
              let replacement;
              if(isWrapped){
                replacement = selText.slice(2,-2);
              } else {
                replacement = `**${selText}**`;
              }
              const newText = note.slice(0,start) + replacement + note.slice(end);
              const delta = replacement.length - selText.length;
              setNote(newText);
              const newEnd = end + delta;
              setTimeout(()=>setSelection({ start, end: newEnd }),0);
            }}>
              <Text style={styles.formatBtnText}>B</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.formatBtn} onPress={()=>{
              // Italic formatting toggle *text*
              const { start, end } = selection;
              if(end <= start){
                const insert = '*italic*';
                const newText = note.slice(0,start) + insert + note.slice(end);
                setNote(newText);
                const cursor = start + 1; // between *|italic*
                setTimeout(()=>setSelection({ start: cursor, end: cursor+6 }),0);
                return;
              }
              const selText = note.slice(start,end);
              const isWrapped = /^\*[^*].*\*$/.test(selText) && !/^\*\*.*\*\*$/.test(selText);
              let replacement;
              if(isWrapped){
                replacement = selText.slice(1,-1);
              } else {
                replacement = `*${selText}*`;
              }
              const newText = note.slice(0,start) + replacement + note.slice(end);
              const delta = replacement.length - selText.length;
              setNote(newText);
              const newEnd = end + delta;
              setTimeout(()=>setSelection({ start, end: newEnd }),0);
            }}>
              <Text style={styles.formatBtnText}>I</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={(t)=>{ if(t.length <= MAX_NOTE) setNote(t); }}
            placeholder="Write a short note... (Markdown *italic* **bold**)"
            multiline
            selection={selection}
            onSelectionChange={(e)=> setSelection(e.nativeEvent.selection)}
          />
        </>
      )}
      {showPreview && (
        <View style={styles.previewBox}>
          <MarkdownPreview text={note} />
        </View>
      )}
      <PrimaryButton title={mood? (loading? 'Saving...' : 'Save') : 'Pick a mood to save'} onPress={saveEntry} disabled={!mood || loading} fullWidth />
      {showSuccess && (
        <View style={styles.toastSuccess} pointerEvents='none'>
          <Text style={styles.toastSuccessText}>Entry Saved ✓</Text>
        </View>
      )}

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose an emoji</Text>
            <FlatList
              data={extraEmojis}
              keyExtractor={(item) => item}
              numColumns={6}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.emojiCell} onPress={() => chooseOther(item)}>
                  <Text style={styles.emojiCellText}>{item}</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingVertical: 8 }}
            />
            <PrimaryButton title="Close" onPress={() => setShowPicker(false)} fullWidth />
          </View>
        </View>
      </Modal>
    </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  heading: { fontSize: 22, fontWeight: "800", color: "#01579B", marginBottom: 4 },
  subheading:{ fontSize:13, color:'#0277BD', marginBottom:16, fontWeight:'600' },
  moodRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  selectedMood:{ fontSize:12, fontWeight:'600', color:'#01579B', marginTop:-10, marginBottom:16 },
  moodBtn: {
    padding: 4,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#B3E5FC",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginHorizontal: 4,
  },
  selected: { backgroundColor: "#B3E5FC", borderColor: "#0288D1" },
  editBadge:{ position:'absolute', top:4, right:4, backgroundColor:'#0288D1', width:18, height:18, borderRadius:9, alignItems:'center', justifyContent:'center' },
  editBadgeText:{ color:'#fff', fontSize:10, fontWeight:'700' },
  mood: { includeFontPadding: false, textAlignVertical: "center" },
  tooltip: { position: 'absolute', top: -30, left: '50%', transform: [{ translateX: -30 }], backgroundColor: '#01579B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tooltipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  label: { fontSize: 16, color: "#0277BD", marginBottom: 8 },
  sliderBlock:{ marginBottom:18 },
  gradientTrack:{ borderRadius:12, paddingHorizontal:4, justifyContent:'center', height:48 },
  slider:{ width:'100%', height:40 },
  ticksRow:{ flexDirection:'row', justifyContent:'space-between', marginTop:4 },
  tickLabel:{ fontSize:12, color:'#0277BD', width:20, textAlign:'center' },
  tickActive:{ fontWeight:'700', color:'#01579B' },
  stressHeaderRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  stressAura:{ width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOpacity:0.15, shadowRadius:6, shadowOffset:{width:0,height:2}, elevation:3 },
  stressAuraText:{ color:'#fff', fontWeight:'700' },
  qualitative:{ marginTop:6, textAlign:'center', fontSize:14, fontWeight:'600' },
  coaching:{ marginTop:4, textAlign:'center', fontSize:11, fontWeight:'600', color:'#01579B', opacity:0.85 },
  input: { backgroundColor: "#fff", borderRadius: 8, padding: 12, minHeight: 60, marginBottom: 18 },
  noteHelper:{ fontSize:11, color:'#0277BD', marginBottom:8, fontWeight:'500' },
  noteHeaderRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end' },
  noteMetaRow:{ alignItems:'flex-end' },
  counter:{ fontSize:12, color:'#0277BD', textAlign:'right' },
  previewToggle:{ flexDirection:'row', alignItems:'center', marginTop:4 },
  previewLabel:{ fontSize:12, color:'#01579B', marginRight:4 },
  previewBox:{ backgroundColor:'#FFFFFFAA', padding:12, borderRadius:8, marginBottom:18 },
  formatBar:{ flexDirection:'row', marginBottom:8 },
  formatBtn:{ backgroundColor:'#0288D1', paddingHorizontal:12, paddingVertical:6, borderRadius:6, marginRight:8 },
  formatBtnText:{ color:'#fff', fontWeight:'700', fontSize:14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#01579B' },
  emojiCell: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginVertical: 6 },
  emojiCellText: { fontSize: 30 },
  toastSuccess:{ position:'absolute', bottom:30, alignSelf:'center', backgroundColor:'#FFFFFFEE', paddingHorizontal:20, paddingVertical:12, borderRadius:24, shadowColor:'#000', shadowOpacity:0.15, shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:4 },
  toastSuccessText:{ fontSize:14, fontWeight:'700', color:'#01579B' }
});
