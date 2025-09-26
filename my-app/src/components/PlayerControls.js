import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Alert, Platform, ToastAndroid, TouchableOpacity } from "react-native";
import GlowingPlayButton from "./GlowingPlayButton";
import Slider from "@react-native-community/slider";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Asset } from "expo-asset";
import * as Haptics from "expo-haptics";
import { auth, db } from "../../firebase/firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { updateUserStats } from "../badges";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BG_SOURCES = {
  none: null,
  // Replace these URLs with your own seamless loop assets if desired
  rain: { uri: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
  ocean: { uri: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
};

export default function PlayerControls({ meditation, backgroundSound, disabled }) {
  // Create a single player instance for this component
  const player = useAudioPlayer(null, { updateInterval: 250, downloadFirst: true });
  const status = useAudioPlayerStatus(player);
  // Background ambient player (separate)
  const ambient = useAudioPlayer(null, { updateInterval: 500, downloadFirst: true });
  const sessionStartRef = useRef(null);
  const [loop, setLoop] = useState(false);
  const [bgVol, setBgVol] = useState(0.35);
  const uid = auth.currentUser?.uid || "local";
  const volKey = `@med:bgVol:${uid}`;
  const ambientCacheRef = useRef({});

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

  // Prefetch ambient sources once to reduce switch/buffer time
  useEffect(() => {
    (async () => {
      try {
        for (const key of Object.keys(BG_SOURCES)) {
          if (key === 'none') continue;
          const src = BG_SOURCES[key];
          if (src?.uri) {
            const asset = await Asset.fromURI(src.uri);
            await asset.downloadAsync();
            ambientCacheRef.current[key] = asset.localUri || asset.uri;
          }
        }
      } catch {}
    })();
  }, []);

  // Update the audio source whenever the selected meditation changes
  useEffect(() => {
    const run = async () => {
      const url = meditation?.url;
      if (url) {
        try {
          // Try to pre-download and then use local uri to avoid buffering
          let srcUri = url;
          try {
            const asset = await Asset.fromURI(url);
            await asset.downloadAsync();
            srcUri = asset.localUri || asset.uri || url;
          } catch {}
          player.replace({ uri: srcUri });
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

  // Sync loop setting into player
  useEffect(() => {
    try { player.loop = loop; } catch {}
  }, [loop]);

  // Derive playback values from status
  const playing = !!status?.playing;
  const progress = status?.currentTime ?? 0;
  const duration = status?.duration && status.duration > 0 ? status.duration : 1;
  const isBuffering = !!status?.isBuffering || !status?.isLoaded;

  const handlePlayPause = async () => {
    if (!meditation?.url) return;
    if (playing) {
      player.pause();
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
      // If we're at or near the end, reset to start for replay
      try {
        if (duration > 0 && progress >= Math.max(0, duration - 0.25)) {
          await player.seekTo(0);
        }
      } catch {}
      player.play();
      if (!sessionStartRef.current) sessionStartRef.current = Date.now();
    }
  };

  // Handle reaching end of track
  useEffect(() => {
    if (status?.didJustFinish) {
      // finalize session if running
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
              notifySaved(elapsedSec);
            } catch {}
          }
        }
        // If not looping, stay paused at end; else native loop should handle
      })();
    }
  }, [status?.didJustFinish]);

  const skipBy = (delta) => {
    const cur = status?.currentTime ?? 0;
    const dur = status?.duration ?? 0;
    const next = Math.max(0, Math.min(cur + delta, dur));
    try { player.seekTo(next); } catch {}
  };

  // Persist and restore BG volume
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(volKey);
        if (raw !== null) setBgVol(parseFloat(raw));
      } catch {}
    })();
  }, [volKey]);

  useEffect(() => {
    AsyncStorage.setItem(volKey, String(bgVol)).catch(() => {});
    try { ambient.volume = Math.max(0, Math.min(1, bgVol)); } catch {}
  }, [bgVol]);

  // Helper: fade volume for crossfades
  const fadeVolume = async (p, from, to, ms = 500, steps = 10) => {
    try {
      const stepTime = ms / steps;
      const delta = (to - from) / steps;
      for (let i = 0; i < steps; i++) {
        p.volume = from + delta * (i + 1);
        await new Promise((res) => setTimeout(res, stepTime));
      }
      p.volume = to;
    } catch {}
  };

  // Manage ambient background sound based on selection
  useEffect(() => {
    const applyBg = async () => {
      const sel = backgroundSound || 'none';
      if (!ambient) return;
      if (sel === 'none') {
        // Fade out and stop
        try { await fadeVolume(ambient, ambient.volume ?? bgVol, 0, 400); } catch {}
        try { ambient.pause(); ambient.seekTo(0); } catch {}
        return;
      }
      const source = BG_SOURCES[sel];
      if (!source) return;
      try {
        // If something is already playing, fade out first, then replace
        const currentVol = ambient.volume ?? bgVol;
        if (currentVol > 0.01) {
          await fadeVolume(ambient, currentVol, 0, 200);
        }
        const cachedUri = ambientCacheRef.current[sel];
        if (cachedUri) {
          await ambient.replace({ uri: cachedUri });
        } else {
          await ambient.replace(source);
        }
        ambient.loop = true;
        ambient.seekTo(0);
        ambient.volume = 0;
        ambient.play();
        // slight delay before fade-in to ensure audio starts smoothly
        await new Promise(res => setTimeout(res, 100));
        await fadeVolume(ambient, 0, bgVol, 500);
      } catch {}
    };
    applyBg();
    // Cleanup on unmount: stop ambient
    return () => {
      try { ambient.pause(); } catch {}
    };
  }, [backgroundSound]);

  // Stop logic can be added to a long-press or extra button if needed

  return (
    <View style={styles.controls}>
      <GlowingPlayButton playing={playing} onPress={handlePlayPause} disabled={disabled || !meditation?.url || isBuffering} />
      {isBuffering && (
        <Text style={{ color:'#607D8B', marginTop: 6 }}>Buffering…</Text>
      )}
      <View style={{ width:'90%', flexDirection:'row', justifyContent:'space-between' }}>
        <View><Text style={{ color:'#01579B', fontWeight:'700' }}>{fmtTime(progress)}</Text></View>
        <View><Text style={{ color:'#01579B', fontWeight:'700' }}>{fmtTime(duration)}</Text></View>
      </View>
      <View style={{ width:'90%', flexDirection:'row', justifyContent:'space-between', marginTop: 6 }}>
        <TouchableOpacity onPress={() => skipBy(-15)} accessibilityRole="button" accessibilityLabel="Skip back 15 seconds">
          <Text style={styles.skipBtn}>{"⟲ 15s"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => skipBy(15)} accessibilityRole="button" accessibilityLabel="Skip forward 15 seconds">
          <Text style={styles.skipBtn}>{"15s ⟳"}</Text>
        </TouchableOpacity>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration}
        value={progress}
        onSlidingComplete={v => player.seekTo(v)}
        minimumTrackTintColor="#7C4DFF"
        maximumTrackTintColor="#B3E5FC"
        thumbTintColor="#7C4DFF"
        disabled={disabled || !meditation?.url || isBuffering}
      />
      {/* Background volume control */}
      <View style={{ width: '90%', marginTop: 8 }}>
        <Text style={{ color:'#006064', fontWeight:'700', marginBottom: 4 }}>Background Volume</Text>
        <Slider
          style={{ width: '100%', height: 32 }}
          minimumValue={0}
          maximumValue={1}
          value={bgVol}
          onValueChange={v => setBgVol(v)}
          minimumTrackTintColor="#26A69A"
          maximumTrackTintColor="#B2DFDB"
          thumbTintColor="#26A69A"
        />
      </View>
      <TouchableOpacity
        onPress={() => setLoop((x) => !x)}
        style={[styles.loopBtn, loop && styles.loopBtnActive]}
        accessibilityRole="button"
        accessibilityLabel={loop ? 'Disable loop' : 'Enable loop'}
      >
        <Text style={[styles.loopText, loop && styles.loopTextActive]}>{loop ? 'Loop: On' : 'Loop: Off'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { alignItems: "center", marginBottom: 20 },
  slider: { width: "90%", height: 36, marginTop: 18 },
  skipBtn: { color: '#006064', fontWeight: '800' },
  loopBtn: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: '#E0F2F1' },
  loopBtnActive: { backgroundColor: '#80DEEA' },
  loopText: { color: '#006064', fontWeight: '700' },
  loopTextActive: { color: '#004D40' },
});
