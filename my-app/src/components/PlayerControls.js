import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Alert, Platform, ToastAndroid, TouchableOpacity, Animated, Easing, AppState } from "react-native";
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import CryptoJS from 'crypto-js';
import * as Application from 'expo-application';
import GlowingPlayButton from "./GlowingPlayButton";
import Slider from "@react-native-community/slider";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Asset } from "expo-asset";
import { impact, selection } from "../utils/haptics";
import { auth, db } from "../../firebase/firebaseConfig";
import { collection, doc, setDoc, getDoc, serverTimestamp, getDocs, query as fsQuery, orderBy, limit } from "firebase/firestore";
import { updateUserStats } from "../badges";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../theme/ThemeProvider";
import { getDefaultBg, getAutoplayLast, getKeepAwake, getAutoPauseOnCall } from '../utils/playerPrefs';
import { notifyDownloadChanged } from '../utils/downloadEvents';
import { activateKeepAwakeAsync, deactivateKeepAwakeAsync } from 'expo-keep-awake';

const BG_SOURCES = {
  none: null,
  // Replace these URLs with your own seamless loop assets if desired
  rain: { uri: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
  ocean: { uri: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
};

export default function PlayerControls({ meditation, backgroundSound, disabled }) {
  const { theme } = useTheme();
  const [prefs, setPrefs] = useState({ defaultBg:'none', autoplayLast:false, keepAwake:false, autoPauseOnCall:true });
  useEffect(()=>{ (async()=>{
    try { setPrefs({
      defaultBg: await getDefaultBg(),
      autoplayLast: await getAutoplayLast(),
      keepAwake: await getKeepAwake(),
      autoPauseOnCall: await getAutoPauseOnCall(),
    }); } catch {}
  })(); },[]);
  // Keep screen awake when preference is enabled using imperative API to avoid conditional hooks
  useEffect(() => {
    let didActivate = false;
    (async () => {
      try {
        if (prefs.keepAwake) {
          await activateKeepAwakeAsync('PlayerControls');
          didActivate = true;
        } else {
          await deactivateKeepAwakeAsync('PlayerControls');
        }
      } catch {}
    })();
    return () => {
      (async () => {
        try {
          if (didActivate) await deactivateKeepAwakeAsync('PlayerControls');
        } catch {}
      })();
    };
  }, [prefs.keepAwake]);
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
  const assetHandlesRef = useRef({ meditation: null });
  const sessionMetaRef = useRef(null);
  const skipLeftScale = useRef(new Animated.Value(1)).current;
  const skipRightScale = useRef(new Animated.Value(1)).current;
  const loopScale = useRef(new Animated.Value(1)).current;
  const [loadError, setLoadError] = useState(null);
  const loadingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const DEBUG_AUDIO = false;
  const persistKey = `@med:playbackState:${uid}`;
  const [isOnline, setIsOnline] = useState(true);
  const isOnlineRef = useRef(true);
  const [downloadedUri, setDownloadedUri] = useState(null);
  const [dlProgress, setDlProgress] = useState(null); // 0..1 or null
  const [queuedPlay, setQueuedPlay] = useState(false);
  const queuedPlayRef = useRef(false);
  useEffect(() => { queuedPlayRef.current = queuedPlay; }, [queuedPlay]);
  const downloadKey = meditation?.id || meditation?.docId || meditation?.url || 'med';
  const isInsecureHttp = (u) => typeof u === 'string' && u.startsWith('http://');

  // Insights state (weekly minutes and streak)
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const lastInsightsFetchRef = useRef(0);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const DAILY_GOAL_MIN = 10;

  const startOfDay = (d) => {
    const dt = new Date(d);
    dt.setHours(0,0,0,0);
    return dt;
  };
  const daysAgo = (n) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - n);
    dt.setHours(0,0,0,0);
    return dt;
  };
  const computeInsights = (sessions) => {
    // Build per-day totals for last 30 days
    const today0 = startOfDay(new Date());
    const buckets = new Map(); // key: yyyy-mm-dd, value: minutes
    for (let i = 0; i < 30; i++) {
      const d = daysAgo(i);
      const key = d.toISOString().slice(0,10);
      buckets.set(key, 0);
    }
    sessions.forEach((s) => {
      const endedAt = s.endedAt;
      const durSec = Math.max(0, Number(s.durationSec || 0));
      if (!endedAt || !durSec) return;
      const dt = endedAt instanceof Date ? endedAt : (endedAt?.toDate ? endedAt.toDate() : null);
      if (!dt) return;
      const dayKey = startOfDay(dt).toISOString().slice(0,10);
      if (buckets.has(dayKey)) {
        const prev = buckets.get(dayKey) || 0;
        buckets.set(dayKey, prev + Math.round(durSec / 60));
      }
    });
    // Weekly minutes (last 7 days including today)
    let weekSum = 0;
    for (let i = 0; i < 7; i++) {
      weekSum += buckets.get(daysAgo(i).toISOString().slice(0,10)) || 0;
    }
    const todayKey = daysAgo(0).toISOString().slice(0,10);
    const todayMin = buckets.get(todayKey) || 0;
    // Current streak: consecutive days back from today with minutes > 0
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const m = buckets.get(daysAgo(i).toISOString().slice(0,10)) || 0;
      if (m > 0) streak += 1; else break;
    }
    setWeeklyMinutes(weekSum);
    setStreakDays(streak);
    setTodayMinutes(todayMin);
  };
  const fetchInsights = async () => {
    if (!auth.currentUser) return;
    const now = Date.now();
    if (now - lastInsightsFetchRef.current < 30000) return; // throttle 30s
    lastInsightsFetchRef.current = now;
    setInsightsLoading(true);
    try {
      const ref = collection(db, "users", auth.currentUser.uid, "sessions");
      // Fetch most recent sessions; filter last 30 days client-side
      const q = fsQuery(ref, orderBy('endedAt', 'desc'), limit(200));
      const snap = await getDocs(q);
      const cutoff = daysAgo(30);
      const rows = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        const endedAt = d?.endedAt?.toDate ? d.endedAt.toDate() : null;
        if (!endedAt || endedAt < cutoff) return;
        rows.push({ durationSec: d?.durationSec || 0, endedAt });
      });
      computeInsights(rows);
    } catch {
      // keep silent, don't block UI
    } finally {
      setInsightsLoading(false);
    }
  };

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
    // Refresh insights shortly after save
    setTimeout(() => { fetchInsights(); }, 300);
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

  // Helper to (re)load the selected meditation audio with local caching and error handling
  const attemptLoad = async (opts = { retries: 3 }) => {
    const url = meditation?.url;
    if (url) {
      // Prefer a previously downloaded local file if available
      if (downloadedUri) {
        try {
          await player.replace({ uri: downloadedUri });
          setLoadError(null);
          return true;
        } catch {}
      }
      if (!isOnlineRef.current) {
        setLoadError("You're offline. We'll retry when you’re back online.");
        return false;
      }
      try {
        if (loadingRef.current) return false;
        loadingRef.current = true;
        setLoadError(null);
        let lastErr = null;
        const retries = Math.max(1, Number(opts?.retries ?? 3));
        for (let i = 0; i < retries; i++) {
          try {
            // Try to pre-download and then use local uri to avoid buffering
            let srcUri = url;
            try {
              const asset = await Asset.fromURI(url);
              await asset.downloadAsync();
              assetHandlesRef.current.meditation = asset;
              srcUri = asset.localUri || asset.uri || url;
            } catch {}
            await player.replace({ uri: srcUri });
            loadingRef.current = false;
            setLoadError(null);
            if (DEBUG_AUDIO) console.log('[Audio] replace success', { srcUri });
            return true;
          } catch (err) {
            lastErr = err;
            // Exponential backoff: 250ms, 750ms, 1750ms ...
            if (i < retries - 1) {
              const delay = 250 * Math.pow(2, i) + 0;
              await new Promise((res) => setTimeout(res, delay));
            }
          }
        }
        const msgStr = String(lastErr?.message || '').toLowerCase();
        const offlineLikely = msgStr.includes('network') || msgStr.includes('failed to connect') || msgStr.includes('offline') || msgStr.includes('timed out');
        setLoadError(offlineLikely ? "You're offline. We'll retry when you’re back online." : 'Unable to load audio. Tap Retry.');
        loadingRef.current = false;
        if (DEBUG_AUDIO) console.log('[Audio] replace failed', { error: String(lastErr) });
        return false;
      } catch (e) {
        const msgStr = String(e?.message || '').toLowerCase();
        const offlineLikely = msgStr.includes('network') || msgStr.includes('failed to connect') || msgStr.includes('offline') || msgStr.includes('timed out');
        setLoadError(offlineLikely ? "You're offline. We'll retry when you’re back online." : 'Unable to load audio. Tap Retry.');
        loadingRef.current = false;
        if (DEBUG_AUDIO) console.log('[Audio] outer load error', { error: String(e) });
        return false;
      }
    } else {
      // If switching to no track while a session is running, close and log it
      if (sessionStartRef.current) {
        const meta = sessionMetaRef.current || { startTs: sessionStartRef.current, title: meditation?.title, meditationId: meditation?.id, bg: backgroundSound, loopAtStart: loop, bgVolumeAtStart: bgVol, meditationUrl: meditation?.url };
        await finalizeSession(meta, Date.now());
        sessionStartRef.current = null;
      }
      try { player.remove(); } catch {}
      assetHandlesRef.current.meditation = null;
      setLoadError(null);
      return true;
    }
  };

  // Offline download helpers
  const getDownloadPath = () => `${FileSystem.documentDirectory || ''}meditations/${String(downloadKey || 'med').replace(/[^a-zA-Z0-9_-]/g, '_')}.mp3`;
  const ensureDir = async (dir) => {
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch {}
  };
  const checkDownloaded = async () => {
    if (!meditation?.url) { setDownloadedUri(null); return; }
    const dir = `${FileSystem.documentDirectory || ''}meditations`;
    await ensureDir(dir);
    const path = getDownloadPath();
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) setDownloadedUri(path);
      else setDownloadedUri(null);
    } catch { setDownloadedUri(null); }
  };
  useEffect(() => { checkDownloaded(); }, [downloadKey, meditation?.url]);

  // Remove downloaded file
  const removeDownload = async () => {
    if (!downloadedUri) return;
    const path = getDownloadPath();
    const confirm = () => new Promise((res)=>{
      if (Platform.OS === 'android') return res(true);
      Alert.alert('Remove download', 'This will free up storage and require internet next time. Continue?', [
        { text:'Cancel', style:'cancel', onPress: ()=> res(false) },
        { text:'Remove', style:'destructive', onPress: ()=> res(true) },
      ]);
    });
    try {
      const ok = await confirm();
      if(!ok) return;
      await FileSystem.deleteAsync(path, { idempotent: true });
      setDownloadedUri(null);
      try { notifyDownloadChanged(); } catch {}
      try {
        if (Platform.OS === 'android') ToastAndroid.show('Removed offline download', ToastAndroid.SHORT);
        else Alert.alert('Removed', 'Offline file deleted');
      } catch {}
      // If currently loaded from local file, reload from network when available
      try { if (meditation?.url) await attemptLoad({ retries: 1 }); } catch {}
    } catch (e) {
      try {
        if (Platform.OS === 'android') ToastAndroid.show('Failed to remove', ToastAndroid.SHORT);
        else Alert.alert('Error', 'Could not delete the file');
      } catch {}
    }
  };

  const startDownload = async () => {
    if (!meditation?.url) return;
    try {
      if (isInsecureHttp(meditation.url)) {
        setLoadError('This audio uses an insecure http:// URL. Android blocks cleartext downloads. Please use https:// hosting.');
        try { if (Platform.OS === 'android') ToastAndroid.show('Insecure URL (http) blocked', ToastAndroid.SHORT); } catch {}
        return;
      }
      if (!isOnlineRef.current) {
        setLoadError('Connect to the internet to download for offline playback.');
        return;
      }
      if (dlProgress !== null) return; // already downloading
      setDlProgress(0);
      const dir = `${FileSystem.documentDirectory || ''}meditations`;
      await ensureDir(dir);
      const path = getDownloadPath();
      // First: if we already cached this via Asset (attemptLoad), just copy it
      try {
        const cached = assetHandlesRef.current.meditation;
        const from = cached?.localUri || cached?.uri;
        if (from) {
          await FileSystem.copyAsync({ from, to: path });
          setDownloadedUri(path);
          setDlProgress(null);
          try {
            if (Platform.OS === 'android') ToastAndroid.show('Downloaded for offline', ToastAndroid.SHORT);
            else Alert.alert('Download complete', 'Available offline');
          } catch {}
          if (queuedPlay) {
            setQueuedPlay(false);
            await attemptLoad({ retries: 1 });
            try { player.play(); } catch {}
          }
          return;
        }
      } catch (errC) {
        if (DEBUG_AUDIO) console.log('[Download] cache copy failed', String(errC));
      }
      // If file already exists, short-circuit
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists && (info.size ?? 0) > 0) {
          setDownloadedUri(path);
          setDlProgress(null);
          return;
        }
      } catch {}

      // Next: fetch via Asset and then copy to persistent storage (works for many hosts)
      try {
        const asset = await Asset.fromURI(meditation.url);
        await asset.downloadAsync();
        const from = asset.localUri || asset.uri;
        if (from) {
          await FileSystem.copyAsync({ from, to: path });
          setDownloadedUri(path);
          setDlProgress(null);
          try {
            if (Platform.OS === 'android') ToastAndroid.show('Downloaded for offline', ToastAndroid.SHORT);
            else Alert.alert('Download complete', 'Available offline');
          } catch {}
          if (queuedPlay) {
            setQueuedPlay(false);
            await attemptLoad({ retries: 1 });
            try { player.play(); } catch {}
          }
          return;
        }
      } catch (errA) {
        if (DEBUG_AUDIO) console.log('[Download] asset copy failed', String(errA));
      }

      // Attempt simple download (some CDNs prefer this)
      try {
        const res = await FileSystem.downloadAsync(meditation.url, path, { headers: { Accept: '*/*' } });
        if (res?.uri) {
          setDownloadedUri(res.uri);
          setDlProgress(null);
          try {
            if (Platform.OS === 'android') ToastAndroid.show('Downloaded for offline', ToastAndroid.SHORT);
            else Alert.alert('Download complete', 'Available offline');
          } catch {}
          if (queuedPlay) {
            setQueuedPlay(false);
            await attemptLoad({ retries: 1 });
            try { player.play(); } catch {}
          }
          return;
        }
      } catch (err0) {
        if (DEBUG_AUDIO) console.log('[Download] downloadAsync failed', String(err0));
      }
      try {
        const downloadResumable = FileSystem.createDownloadResumable(
          meditation.url,
          path,
          {},
          (progress) => {
            const ratio = progress.totalBytesExpectedToWrite
              ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite
              : 0;
            setDlProgress(Math.max(0, Math.min(1, ratio)));
          }
        );
        const result = await downloadResumable.downloadAsync();
        if (result?.uri) {
          setDownloadedUri(result.uri);
          setDlProgress(null);
          try {
            if (Platform.OS === 'android') ToastAndroid.show('Downloaded for offline', ToastAndroid.SHORT);
            else Alert.alert('Download complete', 'Available offline');
          } catch {}
          // If user queued play while offline, play now
          if (queuedPlay) {
            setQueuedPlay(false);
            await attemptLoad({ retries: 1 });
            try { player.play(); } catch {}
          }
          return;
        }
        // If no URI returned, fall through to fallback
      } catch (err1) {
        if (DEBUG_AUDIO) console.log('[Download] primary failed', String(err1));
      }

      // Fallback: use Expo Asset to fetch and then copy to persistent storage
      try {
        const asset = await Asset.fromURI(meditation.url);
        await asset.downloadAsync();
        const from = asset.localUri || asset.uri;
        if (from) {
          await FileSystem.copyAsync({ from, to: path });
          setDownloadedUri(path);
          setDlProgress(null);
          try {
            if (Platform.OS === 'android') ToastAndroid.show('Downloaded for offline', ToastAndroid.SHORT);
            else Alert.alert('Download complete', 'Available offline');
          } catch {}
          if (queuedPlay) {
            setQueuedPlay(false);
            await attemptLoad({ retries: 1 });
            try { player.play(); } catch {}
          }
          return;
        }
      } catch (err2) {
        if (DEBUG_AUDIO) console.log('[Download] fallback failed', String(err2));
      }

      // Final fallback: fetch -> base64 -> write
      try {
        const res = await fetch(meditation.url, { headers: { Accept: 'audio/*,*/*' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        // Convert to Base64 via crypto-js
        const u8 = new Uint8Array(buf);
        const wordArray = CryptoJS.lib.WordArray.create(u8);
        const b64 = CryptoJS.enc.Base64.stringify(wordArray);
        await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
        setDownloadedUri(path);
        setDlProgress(null);
        try {
          if (Platform.OS === 'android') ToastAndroid.show('Downloaded for offline', ToastAndroid.SHORT);
          else Alert.alert('Download complete', 'Available offline');
        } catch {}
        if (queuedPlay) {
          setQueuedPlay(false);
          await attemptLoad({ retries: 1 });
          try { player.play(); } catch {}
        }
        return;
      } catch (err3) {
        if (DEBUG_AUDIO) console.log('[Download] base64 write failed', String(err3));
      }

      // If both methods failed
      setDlProgress(null);
      try {
        const msg = 'Download failed';
        if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
        else Alert.alert('Download failed', 'Please try again');
        setLoadError('Download failed. Please try again.');
      } catch {}
    } catch (e) {
      setDlProgress(null);
      try {
        const msg = `Download failed: ${String(e?.message || '')}`.trim();
        if (Platform.OS === 'android') ToastAndroid.show('Download failed', ToastAndroid.SHORT);
        else Alert.alert('Download failed', e?.message || 'Please try again');
        setLoadError(msg);
      } catch {}
    }
  };

  // Update the audio source whenever the selected meditation changes
  useEffect(() => {
    attemptLoad();
  }, [meditation?.url]);
  // Autoplay last selection on mount if pref enabled and we have a URL
  useEffect(() => {
    (async()=>{
      if(prefs.autoplayLast && meditation?.url){
        try{
          const ok = await attemptLoad({ retries: 2 });
          if(ok) player.play();
        } catch {}
      }
    })();
  }, [prefs.autoplayLast]);

  // Background/interrupt handling: auto-pause on background, resume if we paused due to background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background' || state === 'inactive') {
        try {
          wasPlayingRef.current = !!status?.playing;
          if (status?.playing) {
            player.pause();
          }
          // Persist basic playback state
          try {
            const payload = JSON.stringify({ t: status?.currentTime ?? 0, wasPlaying: wasPlayingRef.current, url: meditation?.url || null });
            await AsyncStorage.setItem(persistKey, payload);
          } catch {}
        } catch {}
      } else if (state === 'active') {
        // If we previously failed to load due to likely offline, try again on foreground
        if (loadError && meditation?.url) {
          await attemptLoad({ retries: 2 });
        }
        try {
          // Restore position if available
          const raw = await AsyncStorage.getItem(persistKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.url === meditation?.url && typeof parsed?.t === 'number' && parsed.t > 0.2) {
              try { await player.seekTo(parsed.t); } catch {}
            }
            await AsyncStorage.removeItem(persistKey);
          }
        } catch {}
        if (wasPlayingRef.current && meditation?.url) {
          try { player.play(); } catch {}
        }
        wasPlayingRef.current = false;
      }
    });
    return () => {
      try { sub?.remove?.(); } catch {}
    };
  }, [status?.playing, loadError, meditation?.url]);

  // NetInfo: initialize connectivity, show banner, and retry when connectivity returns
  useEffect(() => {
    let mounted = true;
    // Initialize once
    NetInfo.fetch().then((state) => {
      if (!mounted) return;
      const online = !!state.isConnected; // prefer simple connectivity for banner
      isOnlineRef.current = online;
      setIsOnline(online);
    }).catch(() => {});

    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const online = !!state.isConnected; // some ROMs leave isInternetReachable null
      isOnlineRef.current = online;
      setIsOnline(online);
      if (!online && meditation?.url) {
        setLoadError("You're offline. We'll retry when you’re back online.");
        return;
      }
      if (online && meditation?.url) {
        // Clear offline error immediately; attempt (re)load regardless of prior error
        if (loadError) setLoadError(null);
          if (queuedPlayRef.current) {
            // If user queued play while offline, honor it now
            try {
              await attemptLoad({ retries: 2 });
              await player.play();
            } catch {}
            setQueuedPlay(false);
            queuedPlayRef.current = false;
          } else if (!loadingRef.current) {
            await attemptLoad({ retries: 2 });
          }
      }
    });
    return () => { mounted = false; try { unsubscribe?.(); } catch {} };
  }, [loadError, meditation?.url]);

  // Periodic persistence of playback position (every ~5s while playing)
  useEffect(() => {
    let timer;
    if (status?.playing) {
      timer = setInterval(async () => {
        try {
          const payload = JSON.stringify({ t: status?.currentTime ?? 0, wasPlaying: true, url: meditation?.url || null });
          await AsyncStorage.setItem(persistKey, payload);
        } catch {}
      }, 5000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [status?.playing, status?.currentTime, meditation?.url]);

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
    fetchInsights();
    return () => {
      (async () => {
        if (sessionStartRef.current && sessionMetaRef.current) {
          await finalizeSession(sessionMetaRef.current, Date.now());
          sessionStartRef.current = null;
        }
        // Proactively release audio resources on unmount
        try { player.remove(); } catch {}
        try { ambient.pause(); ambient.seekTo(0); } catch {}
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
      // If offline and not downloaded, queue play and attempt download
      if (!isOnlineRef.current && !downloadedUri) {
        setQueuedPlay(true);
        await startDownload();
        return;
      }
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
      {!isOnline && (
        <Text style={{ color: theme.textMuted, marginBottom: 6 }} accessibilityLiveRegion="polite">
          You're offline.
        </Text>
      )}
      {!meditation?.url && (
        <Text style={{ color: theme.textMuted, marginBottom: 6 }}>
          Select a meditation from the list to begin.
        </Text>
      )}
      {dlProgress !== null && (
        <Text style={{ color: theme.textMuted, marginBottom: 6 }}>
          Downloading… {Math.round((dlProgress || 0) * 100)}%
        </Text>
      )}
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
      {/* Insights banner */}
      <View style={{ marginTop: 6, alignItems: 'center' }}>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
          {insightsLoading ? 'Loading your weekly stats…' : `This week: ${weeklyMinutes} min • ${streakDays}-day streak`}
        </Text>
        {(todayMinutes < DAILY_GOAL_MIN) && (
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>Today: {todayMinutes}m • {DAILY_GOAL_MIN - todayMinutes}m to goal</Text>
        )}
      </View>
      {!!loadError && (
        <View style={{ alignItems: 'center', marginTop: 6 }}>
          <Text style={{ color: theme.text, textAlign: 'center' }}>{loadError}</Text>
          <TouchableOpacity
            onPress={() => { selection(); attemptLoad(); }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading audio"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ color: theme.primary, fontWeight: '700', marginTop: 4 }}>Retry</Text>
          </TouchableOpacity>
        </View>
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
      {/* Download for offline */}
      {meditation?.url && !downloadedUri && (
        <TouchableOpacity
          onPress={() => { if (dlProgress === null) { selection(); startDownload(); } }}
          accessibilityRole="button"
          accessibilityLabel="Download for offline playback"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.loopBtn, { backgroundColor: theme.card, opacity: dlProgress !== null ? 0.6 : 1 }]}
        >
          <Text style={[styles.loopText, { color: theme.text, fontWeight:'700' }]}>Download for offline</Text>
        </TouchableOpacity>
      )}
      {downloadedUri && (
        <View style={{ alignItems:'center', marginTop: 6 }}>
          <Text style={{ color: theme.textMuted }}>Available offline</Text>
          <TouchableOpacity
            onPress={() => { selection(); removeDownload(); }}
            accessibilityRole="button"
            accessibilityLabel="Remove downloaded file"
            style={[styles.loopBtn, { backgroundColor: theme.card, marginTop: 6 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.loopText, { color: theme.text, fontWeight:'700' }]}>Remove download</Text>
          </TouchableOpacity>
        </View>
      )}
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
