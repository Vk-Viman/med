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
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, FlatList, Animated, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import GradientBackground from "../src/components/GradientBackground";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { db, auth } from "../firebase/firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import PrimaryButton from "../src/components/PrimaryButton";
import CryptoJS from "crypto-js";
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

export default function MoodTracker() {
  const { width } = useWindowDimensions();
  // Compute size so 5 buttons + margins fit (side padding ~24*2 and horizontal gaps ~4*8 total)
  const usable = width - 48 - (4 * 8);
  const btnSize = Math.min(72, Math.max(56, Math.floor(usable / 5)));
  const fontSize = Math.round(btnSize * 0.6);
  const [mood, setMood] = useState(null); // key OR OTHER_KEY
  const [otherEmoji, setOtherEmoji] = useState("💫");
  const [stress, setStress] = useState(5);
  const [note, setNote] = useState("");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [tooltip, setTooltip] = useState(null); // {key, label, x}

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

  // Persist selection changes
  useEffect(() => {
    (async () => {
      try {
        if (mood) await AsyncStorage.setItem(STORAGE_KEY, mood);
        if (mood === OTHER_KEY) await AsyncStorage.setItem(STORAGE_OTHER_EMOJI, otherEmoji);
      } catch {}
    })();
  }, [mood, otherEmoji]);

  const selectMood = (k) => {
    setMood(k);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const scale = getScale(k);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.15, duration: 110, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true })
    ]).start();
    if (k === OTHER_KEY) setShowPicker(true);
  };

  const onLongPress = (m) => {
    setTooltip({ key: m.key, label: m.label });
    setTimeout(() => setTooltip((t) => (t && t.key === m.key ? null : t)), 1200);
  };

  const chooseOther = (emoji) => {
    setOtherEmoji(emoji);
    setShowPicker(false);
    setMood(OTHER_KEY);
  };

  const saveEntry = async () => {
    if (!mood) return Alert.alert("Select your mood");
    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Not logged in");
  // Derive deterministic key and iv from uid to avoid RNG in Expo Go
  const key = CryptoJS.enc.Hex.parse(CryptoJS.SHA256(uid + "-key").toString()); // 32 bytes
  const iv = CryptoJS.enc.Hex.parse(CryptoJS.SHA256(uid + "-iv").toString().slice(0, 32)); // 16 bytes
  const encryptedNote = CryptoJS.AES.encrypt(note, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString();
      await setDoc(doc(db, `users/${uid}/moods`, `${Date.now()}`), {
        mood,
        stress,
        note: encryptedNote,
        createdAt: serverTimestamp(),
      });
      setMood(null); setStress(5); setNote("");
      Alert.alert("Saved", "Your entry was saved.");
      router.back();
    } catch (e) {
      Alert.alert("Error", e.message);
    }
    setLoading(false);
  };

  return (
    <GradientBackground>
    <View style={styles.container}>
      <Text style={styles.heading}>How are you feeling?</Text>
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
            >
              <Animated.View style={[styles.moodBtn, { width: btnSize, height: btnSize, borderRadius: btnSize/2 }, mood === m.key && styles.selected, { transform: [{ scale }] }]}>            
                <Text style={[styles.mood, { fontSize, lineHeight: fontSize + 4 }]}>{m.emoji}</Text>
              </Animated.View>
              {tooltip && tooltip.key === m.key && (
                <View style={styles.tooltip}><Text style={styles.tooltipText}>{m.label}</Text></View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.label}>Stress Level: {stress}</Text>
      <Slider
        style={{ width: "100%", height: 40 }}
        minimumValue={0}
        maximumValue={10}
        step={1}
        value={stress}
        onValueChange={setStress}
        minimumTrackTintColor="#0288D1"
        maximumTrackTintColor="#B3E5FC"
      />
      <Text style={styles.label}>Journal Note</Text>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder="Write a short note..."
        multiline
      />
      <PrimaryButton title="Save" onPress={saveEntry} disabled={loading} fullWidth />

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
  heading: { fontSize: 22, fontWeight: "700", color: "#01579B", marginBottom: 18 },
  moodRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
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
  mood: { includeFontPadding: false, textAlignVertical: "center" },
  tooltip: { position: 'absolute', top: -30, left: '50%', transform: [{ translateX: -30 }], backgroundColor: '#01579B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tooltipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  label: { fontSize: 16, color: "#0277BD", marginBottom: 8 },
  input: { backgroundColor: "#fff", borderRadius: 8, padding: 12, minHeight: 60, marginBottom: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#01579B' },
  emojiCell: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginVertical: 6 },
  emojiCellText: { fontSize: 30 },
});
