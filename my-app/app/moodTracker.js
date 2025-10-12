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
import { Ionicons } from '@expo/vector-icons';
import { impact as hImpact, success as hSuccess, error as hError } from "../src/utils/haptics";
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
import ConfettiView from "../src/components/ConfettiView";
import AnimatedButton from "../src/components/AnimatedButton";
import PulseButton from "../src/components/PulseButton";
import ShimmerCard from "../src/components/ShimmerCard";
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
  const [showConfetti, setShowConfetti] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const MAX_NOTE = 500;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [tooltip, setTooltip] = useState(null); // {key, label}
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const hideTooltipTimeout = useRef(null);
  const successScale = useRef(new Animated.Value(0)).current;

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
  hImpact('light');
    } else {
  hImpact('medium');
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
      
      // Success celebration!
      hSuccess();
      setShowSuccess(true);
      setShowConfetti(true);
      
      // Animate success badge
      Animated.sequence([
        Animated.spring(successScale, {
          toValue: 1,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.delay(1200),
        Animated.timing(successScale, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setShowSuccess(false));
      
      setTimeout(() => setShowConfetti(false), 2500);
      setMood(null); setStress(5); setNote("");
      setTimeout(() => router.back(), 1200);
    } catch (e) {
      hError();
      Alert.alert('Save Failed', e.message || 'Unknown error');
    }
    setLoading(false);
  };

  return (
    <GradientBackground>
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.iconBadge}>
          <Ionicons name="happy-outline" size={28} color="#0288D1" />
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.heading} accessibilityRole='header'>How are you feeling?</Text>
          <Text style={styles.subheading}>Track your mood and build self-awareness</Text>
        </View>
      </View>
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
                // Map style enum to helper strings
                const map = { [Haptics.ImpactFeedbackStyle.Light]:'light', [Haptics.ImpactFeedbackStyle.Medium]:'medium', [Haptics.ImpactFeedbackStyle.Heavy]:'heavy' };
                hImpact(map[style] || 'light');
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
      <PulseButton 
        onPress={saveEntry} 
        enabled={mood && !loading}
        pulseColor="rgba(2, 136, 209, 0.4)"
        pulseScale={1.12}
        haptic={true}
      >
        <LinearGradient
          colors={mood ? ['#0288D1', '#01579B'] : ['#B0BEC5', '#90A4AE']}
          style={styles.saveButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name={loading ? "hourglass-outline" : "checkmark-circle"} size={22} color="#fff" />
          <Text style={styles.saveButtonText}>
            {mood ? (loading ? 'Saving...' : 'Save Entry') : 'Pick a mood to save'}
          </Text>
        </LinearGradient>
      </PulseButton>
      
      {showSuccess && (
        <Animated.View 
          style={[styles.successBadge, { transform: [{ scale: successScale }] }]} 
          pointerEvents='none'
        >
          <ShimmerCard
            colors={['#66BB6A', '#43A047']}
            shimmerSpeed={2000}
            style={styles.successGradient}
          >
            <Ionicons name="checkmark-circle" size={48} color="#fff" />
            <Text style={styles.successText}>Mood Logged!</Text>
            <Text style={styles.successSubtext}>Keep up the great work ✨</Text>
          </ShimmerCard>
        </Animated.View>
      )}
      
      <ConfettiView visible={showConfetti} onComplete={() => setShowConfetti(false)} />

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
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E1F5FE',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0288D1',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heading: { 
    fontSize: 22, 
    fontWeight: "800", 
    color: "#01579B", 
    letterSpacing: 0.3,
  },
  subheading:{ 
    fontSize: 13, 
    color:'#78909C', 
    fontWeight:'500',
    lineHeight: 18,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#0288D1',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  successBadge: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    marginLeft: -120,
    width: 240,
    zIndex: 1000,
  },
  successGradient: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 20,
    shadowColor: '#43A047',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  successText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
    letterSpacing: 0.3,
  },
  successSubtext: {
    color: '#E8F5E9',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  moodRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    marginBottom: 24,
    paddingVertical: 8,
  },
  selectedMood:{ 
    fontSize:13, 
    fontWeight:'700', 
    color:'#01579B', 
    marginTop:-8, 
    marginBottom:20,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  moodBtn: {
    padding: 6,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#E1F5FE",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginHorizontal: 2,
  },
  selected: { 
    backgroundColor: "#E1F5FE", 
    borderColor: "#0288D1",
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  editBadge:{ 
    position:'absolute', 
    top:6, 
    right:6, 
    backgroundColor:'#0288D1', 
    width:20, 
    height:20, 
    borderRadius:10, 
    alignItems:'center', 
    justifyContent:'center',
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  editBadgeText:{ color:'#fff', fontSize:11, fontWeight:'800' },
  mood: { includeFontPadding: false, textAlignVertical: "center" },
  tooltip: { 
    position: 'absolute', 
    top: -32, 
    left: '50%', 
    transform: [{ translateX: -35 }], 
    backgroundColor: '#01579B', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tooltipText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  label: { 
    fontSize: 17, 
    color: "#0277BD", 
    marginBottom: 10,
    fontWeight: "700",
  },
  sliderBlock:{ marginBottom:20 },
  gradientTrack:{ 
    borderRadius:16, 
    paddingHorizontal:6, 
    justifyContent:'center', 
    height:52,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  slider:{ width:'100%', height:44 },
  ticksRow:{ flexDirection:'row', justifyContent:'space-between', marginTop:6 },
  tickLabel:{ fontSize:11, color:'#0277BD', width:22, textAlign:'center', fontWeight: "600" },
  tickActive:{ fontWeight:'800', color:'#01579B', fontSize: 12 },
  stressHeaderRow:{ 
    flexDirection:'row', 
    alignItems:'center', 
    justifyContent:'space-between', 
    marginBottom:10,
  },
  stressAura:{ 
    width:42, 
    height:42, 
    borderRadius:21, 
    alignItems:'center', 
    justifyContent:'center', 
    shadowColor:'#000', 
    shadowOpacity:0.2, 
    shadowRadius:8, 
    shadowOffset:{width:0,height:3}, 
    elevation:4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  stressAuraText:{ color:'#fff', fontWeight:'800', fontSize: 16 },
  qualitative:{ 
    marginTop:8, 
    textAlign:'center', 
    fontSize:16, 
    fontWeight:'700',
    color: '#01579B',
  },
  coaching:{ 
    marginTop:6, 
    textAlign:'center', 
    fontSize:13, 
    fontWeight:'600', 
    color:'#0277BD', 
    opacity:0.9,
    fontStyle: 'italic',
  },
  input: { 
    backgroundColor: "#fff", 
    borderRadius: 12, 
    padding: 14, 
    minHeight: 80, 
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#E1F5FE",
    fontSize: 15,
    lineHeight: 22,
  },
  noteHelper:{ fontSize:12, color:'#0277BD', marginBottom:10, fontWeight:'600' },
  noteHeaderRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end' },
  noteMetaRow:{ alignItems:'flex-end' },
  counter:{ fontSize:12, color:'#0277BD', textAlign:'right', fontWeight: "600" },
  previewToggle:{ flexDirection:'row', alignItems:'center', marginTop:6 },
  previewLabel:{ fontSize:13, color:'#01579B', marginRight:6, fontWeight: "600" },
  previewBox:{ 
    backgroundColor:'#FFFFFF', 
    padding:14, 
    borderRadius:12, 
    marginBottom:20,
    borderWidth: 1,
    borderColor: "#E1F5FE",
  },
  formatBar:{ flexDirection:'row', marginBottom:10 },
  formatBtn:{ 
    backgroundColor:'#0288D1', 
    paddingHorizontal:14, 
    paddingVertical:8, 
    borderRadius:8, 
    marginRight:10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  formatBtnText:{ color:'#fff', fontWeight:'800', fontSize:15 },
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    padding: 24,
  },
  modalCard: { 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    padding: 20, 
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    marginBottom: 16, 
    color: '#01579B',
    textAlign: 'center',
  },
  emojiCell: { 
    width: 52, 
    height: 52, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginVertical: 6,
    backgroundColor: '#F5F5F5',
  },
  emojiCellText: { fontSize: 32 },
  toastSuccess:{ 
    position:'absolute', 
    bottom:40, 
    alignSelf:'center', 
    backgroundColor:'#FFFFFF', 
    paddingHorizontal:24, 
    paddingVertical:14, 
    borderRadius:28, 
    shadowColor:'#000', 
    shadowOpacity:0.2, 
    shadowRadius:12, 
    shadowOffset:{width:0,height:4}, 
    elevation:5,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  toastSuccessText:{ 
    fontSize:16, 
    fontWeight:'800', 
    color:'#4CAF50',
    letterSpacing: 0.5,
  }
});
