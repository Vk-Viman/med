import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Alert, Platform, ToastAndroid, TouchableOpacity, Animated, Easing } from "react-native";
import * as Application from 'expo-application';
import GlowingPlayButton from "./GlowingPlayButton";
import Slider from "@react-native-community/slider";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Asset } from "expo-asset";
import { impact, selection } from "../utils/haptics";
import { auth, db } from "../../firebase/firebaseConfig";
import { collection, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { updateUserStats } from "../badges";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../theme/ThemeProvider";

const BG_SOURCES = {
  none: null,
  // Replace these URLs with your own seamless loop assets if desired
  rain: { uri: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
  ocean: { uri: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
};

export default function PlayerControls({ meditation, backgroundSound, disabled }) {
  const { theme } = useTheme();
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
  const activeKey = `@med:activeSession:${uid}`;
  const ambientCacheRef = useRef({});
  const sessionMetaRef = useRef(null);
  const skipLeftScale = useRef(new Animated.Value(1)).current;
  const skipRightScale = useRef(new Animated.Value(1)).current;
  const loopScale = useRef(new Animated.Value(1)).current;

  // Helper: quick press animation for buttons (scale down then spring back)
  const pressAnim = (animatedValue) => {
    if (!animatedValue) return;
    try {
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 0.92,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(animatedValue, {
          toValue: 1,
          friction: 5,
          tension: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } catch {}
  };

  const fmtTime = (sec) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2,'0')}`;
  };

  const notifySaved = (elapsedSec) => {
    const minutes = Math.round((elapsedSec / 60) * 10) / 10;
    const msg = `Session saved: ${minutes}m`;
    impact('light');
    if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
    else Alert.alert("Saved", msg);
  };

  // Finalize and persist a session safely (idempotent by docId)
  const finalizeSession = async ({ startTs, title, meditationId, bg, loopAtStart, bgVolumeAtStart, meditationUrl }, endTs = Date.now()) => {
    if (!auth.currentUser) return; // only log for signed-in users
    const elapsedSec = Math.max(0, Math.round((endTs - startTs) / 1000));
    if (elapsedSec < 5) { // ignore super short
      try { await AsyncStorage.removeItem(activeKey); } catch {}
      return;
    }
    try {
      const sid = `${auth.currentUser.uid}-${startTs}`;
      const ref = doc(collection(db, "users", auth.currentUser.uid, "sessions"), sid);
      const snap = await getDoc(ref);
      // If already ended, do nothing (prevents duplicates)
      if (snap.exists() && snap.data()?.endedAt) {
        try { await AsyncStorage.removeItem(activeKey); } catch {}
        return;
      }
      await setDoc(ref, {
        durationSec: elapsedSec,
        endedAt: serverTimestamp(),
        title: title || meditation?.title || "session",
        meditationId: meditationId || meditation?.id || meditation?.docId || null,
        backgroundSound: bg ?? backgroundSound ?? null,
        loopAtStart: typeof loopAtStart === 'boolean' ? loopAtStart : loop,
        bgVolumeAtStart: typeof bgVolumeAtStart === 'number' ? bgVolumeAtStart : bgVol,
        meditationUrl: meditationUrl || meditation?.url || null,
        deviceOS: Platform.OS,
        deviceOSVersion: String(Platform.Version ?? ''),
        appVersion: Application?.applicationVersion || Application?.nativeApplicationVersion || null,
      }, { merge: true });
      // Update stats once per session (only when we set it for the first time)
      await updateUserStats(auth.currentUser.uid, { minutesDelta: Math.round(elapsedSec / 60) });
      notifySaved(elapsedSec);
    } catch {}
    try { await AsyncStorage.removeItem(activeKey); } catch {}
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
          const meta = sessionMetaRef.current || { startTs: sessionStartRef.current, title: meditation?.title, meditationId: meditation?.id, bg: backgroundSound, loopAtStart: loop, bgVolumeAtStart: bgVol, meditationUrl: meditation?.url };
          await finalizeSession(meta, Date.now());
          sessionStartRef.current = null;
        }
        try { player.remove(); } catch {}
      }
    };
    run();
  }, [meditation?.url]);

  // Log session on unmount if still running
  // Crash recovery: if an active session key exists from previous run, finalize it now
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(activeKey);
        if (raw && auth.currentUser) {
          const meta = JSON.parse(raw);
          await finalizeSession(meta, Date.now());
        }
      } catch {}
    })();
    return () => {
      (async () => {
        if (sessionStartRef.current && sessionMetaRef.current) {
          await finalizeSession(sessionMetaRef.current, Date.now());
          sessionStartRef.current = null;
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

  // Accessibility: announce buffering politely for screen readers
  const bufferingLabel = isBuffering ? 'Buffering audio' : undefined;

  const handlePlayPause = async () => {
    if (!meditation?.url) return;
    if (playing) {
      player.pause();
      // Log the session on pause
      if (sessionStartRef.current && sessionMetaRef.current) {
        await finalizeSession(sessionMetaRef.current, Date.now());
        sessionStartRef.current = null;
      }
    } else {
      // If we're at or near the end, reset to start for replay
      try {
        if (duration > 0 && progress >= Math.max(0, duration - 0.25)) {
          await player.seekTo(0);
        }
      } catch {}
      player.play();
      if (!sessionStartRef.current) {
        const startTs = Date.now();
        sessionStartRef.current = startTs;
        const meta = {
          startTs,
          title: meditation?.title,
          meditationId: meditation?.id || meditation?.docId,
          bg: backgroundSound || 'none',
          loopAtStart: loop,
          bgVolumeAtStart: bgVol,
          meditationUrl: meditation?.url || null,
        };
        sessionMetaRef.current = meta;
        try { await AsyncStorage.setItem(activeKey, JSON.stringify(meta)); } catch {}
      }
    }
  };

  // Handle reaching end of track
  useEffect(() => {
    if (status?.didJustFinish) {
      // finalize session if running
      (async () => {
        if (sessionStartRef.current && sessionMetaRef.current) {
          await finalizeSession(sessionMetaRef.current, Date.now());
          sessionStartRef.current = null;
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

  // Scrubber haptics state
  const lastStepRef = useRef(null);
  const stepSize = 5; // seconds granularity for step haptics during drag

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
      <GlowingPlayButton
        playing={playing}
        onPress={handlePlayPause}
        disabled={disabled || !meditation?.url || isBuffering}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause meditation' : 'Play meditation'}
        accessibilityHint={playing ? 'Pauses the current meditation' : 'Plays the selected meditation'}
      />
      {isBuffering && (
        <Text
          style={{ color: theme.textMuted, marginTop: 6 }}
          accessibilityLiveRegion="polite"
          accessibilityLabel="Buffering audio"
        >
          Buffering…
        </Text>
      )}
      <View style={{ width:'90%', flexDirection:'row', justifyContent:'space-between' }}>
        <View><Text style={{ color: theme.text, fontWeight:'700' }}>{fmtTime(progress)}</Text></View>
        <View><Text style={{ color: theme.text, fontWeight:'700' }}>{fmtTime(duration)}</Text></View>
      </View>
      <View style={{ width:'90%', flexDirection:'row', justifyContent:'space-between', marginTop: 6 }}>
        <Animated.View style={{ transform: [{ scale: skipLeftScale }] }}>
          <TouchableOpacity
            onPress={() => { pressAnim(skipLeftScale); selection(); skipBy(-15); }}
            accessibilityRole="button"
            accessibilityLabel="Skip back 15 seconds"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.skipBtn, { color: theme.text }]}>{"⟲ 15s"}</Text>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View style={{ transform: [{ scale: skipRightScale }] }}>
          <TouchableOpacity
            onPress={() => { pressAnim(skipRightScale); selection(); skipBy(15); }}
            accessibilityRole="button"
            accessibilityLabel="Skip forward 15 seconds"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.skipBtn, { color: theme.text }]}>{"15s ⟳"}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration}
        value={progress}
        onSlidingStart={() => { lastStepRef.current = null; selection(); }}
        onValueChange={(v) => {
          // fire a subtle selection haptic when crossing discrete step boundaries
          const step = Math.floor(v / stepSize);
          if (lastStepRef.current === null) { lastStepRef.current = step; }
          if (step !== lastStepRef.current) {
            lastStepRef.current = step;
            selection();
          }
        }}
        onSlidingComplete={(v) => { player.seekTo(v); impact('light'); }}
        minimumTrackTintColor={theme.primary}
        maximumTrackTintColor={theme.textMuted}
        thumbTintColor={theme.primary}
        disabled={disabled || !meditation?.url || isBuffering}
        accessibilityRole="adjustable"
        accessibilityLabel="Playback position"
        accessibilityValue={{ min: 0, max: Math.max(1, Math.floor(duration)), now: Math.floor(progress) }}
        accessibilityHint="Swipe up or down to adjust the playback position"
      />
      {/* Background volume control */}
      <View style={{ width: '90%', marginTop: 8 }}>
        <Text style={{ color: theme.text, fontWeight:'700', marginBottom: 4 }}>Background Volume</Text>
        <Slider
          style={{ width: '100%', height: 32 }}
          minimumValue={0}
          maximumValue={1}
          value={bgVol}
          onValueChange={v => setBgVol(v)}
          minimumTrackTintColor={theme.primary}
          maximumTrackTintColor={theme.textMuted}
          thumbTintColor={theme.primary}
          accessibilityRole="adjustable"
          accessibilityLabel="Background sound volume"
          accessibilityValue={{ min: 0, max: 1, now: Number(bgVol.toFixed(2)) }}
          accessibilityHint="Swipe up or down to adjust background volume"
        />
      </View>
      <Animated.View style={{ transform: [{ scale: loopScale }] }}>
        <TouchableOpacity
          onPress={() => { pressAnim(loopScale); selection(); setLoop((x) => !x); }}
          style={[styles.loopBtn, { backgroundColor: theme.card }, loop && { backgroundColor: theme.primary }]}
          accessibilityRole="button"
          accessibilityLabel={loop ? 'Disable loop' : 'Enable loop'}
          accessibilityHint={loop ? 'Stop repeating the track' : 'Repeat the track when it ends'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.loopText, { color: loop ? (theme.primaryContrast || '#fff') : theme.text, fontWeight:'700' }]}>{loop ? 'Loop: On' : 'Loop: Off'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { alignItems: "center", marginBottom: 20 },
  slider: { width: "90%", height: 36, marginTop: 18 },
  skipBtn: { fontWeight: '800' },
  loopBtn: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  loopBtnActive: {},
  loopText: {},
  loopTextActive: {},
});
