import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Alert, Platform, ToastAndroid } from "react-native";
import GlowingPlayButton from "./GlowingPlayButton";
import Slider from "@react-native-community/slider";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { auth, db } from "../../firebase/firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { updateUserStats } from "../badges";

export default function PlayerControls({ meditation, backgroundSound, disabled }) {
  // Create a single player instance for this component
  const player = useAudioPlayer();
  const sessionStartRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(1);

  const fmtTime = (sec) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2,'0')}`;
  };

  const notifySaved = (elapsedSec) => {
    const minutes = Math.round((elapsedSec / 60) * 10) / 10;
    const msg = `Session saved: ${minutes}m`;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
    else Alert.alert("Saved", msg);
  };

  // Update the audio source whenever the selected meditation changes
  useEffect(() => {
    const run = async () => {
      const url = meditation?.url;
      if (url) {
        try {
          player.replace({ uri: url });
        } catch {}
      } else {
        // If switching to no track while a session is running, close and log it
        if (sessionStartRef.current) {
          const end = Date.now();
          const elapsedSec = Math.max(0, Math.round((end - sessionStartRef.current) / 1000));
          sessionStartRef.current = null;
          if (elapsedSec >= 5 && auth.currentUser) {
            try {
              await addDoc(collection(db, "users", auth.currentUser.uid, "sessions"), {
                durationSec: elapsedSec,
                endedAt: serverTimestamp(),
                title: meditation?.title || "session",
              });
              await updateUserStats(auth.currentUser.uid, { minutesDelta: Math.round(elapsedSec / 60) });
              notifySaved(elapsedSec);
            } catch {}
          }
        }
        try { player.remove(); } catch {}
        setIsPlaying(false);
        setProgress(0);
        setDuration(1);
      }
    };
    run();
  }, [meditation?.url]);

  // Log session on unmount if still running
  useEffect(() => {
    return () => {
      (async () => {
        if (sessionStartRef.current && auth.currentUser) {
          const end = Date.now();
          const elapsedSec = Math.max(0, Math.round((end - sessionStartRef.current) / 1000));
          sessionStartRef.current = null;
          if (elapsedSec >= 5) {
            try {
              await addDoc(collection(db, "users", auth.currentUser.uid, "sessions"), {
                durationSec: elapsedSec,
                endedAt: serverTimestamp(),
                title: meditation?.title || "session",
              });
              await updateUserStats(auth.currentUser.uid, { minutesDelta: Math.round(elapsedSec / 60) });
            } catch {}
          }
        }
      })();
    };
  }, []);

  // Remove broken onUpdate usage; fallback to local state only

  const handlePlayPause = async () => {
    if (!meditation?.url) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      // Log the session on pause
      if (sessionStartRef.current && auth.currentUser) {
        const end = Date.now();
        const elapsedSec = Math.max(0, Math.round((end - sessionStartRef.current) / 1000));
        sessionStartRef.current = null;
        if (elapsedSec >= 5) {
          try {
            await addDoc(collection(db, "users", auth.currentUser.uid, "sessions"), {
              durationSec: elapsedSec,
              endedAt: serverTimestamp(),
              title: meditation?.title || "session",
            });
            await updateUserStats(auth.currentUser.uid, { minutesDelta: Math.round(elapsedSec / 60) });
            notifySaved(elapsedSec);
          } catch {}
        }
      }
    } else {
      player.play();
      setIsPlaying(true);
      if (!sessionStartRef.current) sessionStartRef.current = Date.now();
    }
  };

  // Stop logic can be added to a long-press or extra button if needed

  return (
    <View style={styles.controls}>
      <GlowingPlayButton playing={isPlaying} onPress={handlePlayPause} disabled={disabled || !meditation?.url} />
      <View style={{ width:'90%', flexDirection:'row', justifyContent:'space-between' }}>
        <View><Text style={{ color:'#01579B', fontWeight:'700' }}>{fmtTime(progress)}</Text></View>
        <View><Text style={{ color:'#01579B', fontWeight:'700' }}>{fmtTime(duration)}</Text></View>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration}
        value={progress}
        onValueChange={v => player.seekTo(v)}
        minimumTrackTintColor="#7C4DFF"
        maximumTrackTintColor="#B3E5FC"
        thumbTintColor="#7C4DFF"
        disabled={disabled || !meditation?.url}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { alignItems: "center", marginBottom: 20 },
  slider: { width: "90%", height: 36, marginTop: 18 },
});
