import React, { useState } from "react";
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
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from "react-native";
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

const moods = [
  { key: "happy", emoji: "ðŸ˜Š" },
  { key: "sad", emoji: "ðŸ˜¢" },
  { key: "calm", emoji: "ðŸ˜Œ" },
  { key: "stressed", emoji: "ðŸ˜£" },
];

export default function MoodTracker() {
  const [mood, setMood] = useState(null);
  const [stress, setStress] = useState(5);
  const [note, setNote] = useState("");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
        {moods.map(m => (
          <TouchableOpacity key={m.key} style={[styles.moodBtn, mood === m.key && styles.selected]} onPress={() => setMood(m.key)}>
            <Text style={styles.mood}>{m.emoji}</Text>
          </TouchableOpacity>
        ))}
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
    </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  heading: { fontSize: 22, fontWeight: "700", color: "#01579B", marginBottom: 18 },
  moodRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  moodBtn: { padding: 16, borderRadius: 12, backgroundColor: "#B3E5FC" },
  selected: { backgroundColor: "#0288D1" },
  mood: { fontSize: 32 },
  label: { fontSize: 16, color: "#0277BD", marginBottom: 8 },
  input: { backgroundColor: "#fff", borderRadius: 8, padding: 12, minHeight: 60, marginBottom: 18 },
});
