import { Stack, useRouter, usePathname, useNavigation } from "expo-router";
import React, { useEffect, useRef, useState } from 'react';
import { AppState, TouchableWithoutFeedback, View, Text, StyleSheet, DeviceEventEmitter, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import AppLogo from "../src/components/AppLogo";
import { getUserProfile, updateUserProfile } from '../src/services/userProfile';
import { deleteAllMoodEntries, getRetentionDays, getRetentionLastRunTs, setRetentionLastRunTs, purgeMoodEntriesOlderThan } from '../src/services/moodEntries';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { runAdaptiveScheduler, registerNotificationActions, handleNotificationResponse, getAdaptiveSettings } from "../src/services/adaptiveNotifications";
import { registerPushTokens } from "../src/services/pushTokens";
import { openFromNotificationData, wireForegroundHandler } from "../src/services/pushNavigation";
import { DeviceEventEmitter as RNEmitter } from 'react-native';
import { auth } from "../firebase/firebaseConfig";
import { clearUserSubscriptions } from '../src/utils/safeSnapshot';
import { onAuthStateChanged } from 'firebase/auth';
import ErrorBoundary from "../src/components/ErrorBoundary";
import OfflineIndicator from "../src/components/OfflineIndicator";

const AUTO_LOCK_KEY = 'privacy_auto_lock_seconds_v1';
const LAST_ROUTE_BEFORE_LOCK_KEY = 'last_route_before_lock_v1';
let lastActive = Date.now();

function ActivityWrapper({ children }){
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef('');
  const lockTimerRef = useRef(null);
  const intervalRef = useRef(0);
  const [localOnly, setLocalOnly] = React.useState(false);
  const [toast, setToast] = React.useState(null); // { message, type, ts }

  const loadInterval = async () => {
    try { const v = await AsyncStorage.getItem(AUTO_LOCK_KEY); intervalRef.current = v? Number(v):0; }catch{ intervalRef.current = 0; }
  };

  const resetTimer = () => { lastActive = Date.now(); };

  const biometricPrefRef = useRef(true);
  useEffect(()=>{ (async()=>{ try{ const b = await AsyncStorage.getItem('pref_biometric_enabled_v1'); if(b!==null) biometricPrefRef.current = b==='1'; }catch{} })(); },[]);
  const checkLock = () => {
    if(intervalRef.current && intervalRef.current > 0){
      const diff = (Date.now() - lastActive)/1000;
      if(diff >= intervalRef.current && intervalRef.current>0){
        const currentPath = pathnameRef.current || '';
        if(!currentPath.includes('biometricLogin') && !currentPath.includes('login')){
          AsyncStorage.setItem(LAST_ROUTE_BEFORE_LOCK_KEY, currentPath).catch(()=>{});
          // Debug toast to help verify when auto-lock triggers in the wild
          try { DeviceEventEmitter.emit('app-toast', { message: `Auto-locked after ${Math.round(diff)}s`, type:'info', duration: 1500 }); } catch {}
          if(biometricPrefRef.current){
            router.replace('/biometricLogin');
          } else {
            // If biometrics disabled, just send user to login screen for full auth
            router.replace('/login');
          }
        }
      }
    }
  };

  useEffect(()=>{ loadInterval(); },[]);
  // Apply interval changes instantly
  useEffect(()=>{
    const sub = DeviceEventEmitter.addListener('auto-lock-changed', ({ seconds })=>{ intervalRef.current = seconds; lastActive = Date.now(); });
    const subLockNow = DeviceEventEmitter.addListener('lock-now', ()=>{
      // Force immediate lock regardless of timer; saves current route and navigates
      const currentPath = pathnameRef.current || '/(tabs)';
      AsyncStorage.setItem(LAST_ROUTE_BEFORE_LOCK_KEY, currentPath).catch(()=>{});
      try { DeviceEventEmitter.emit('app-toast', { message: 'Locking now…', type:'info', duration: 900 }); } catch {}
      if(biometricPrefRef.current){ router.replace('/biometricLogin'); } else { router.replace('/login'); }
    });
    return ()=> { try{ sub.remove(); }catch{} try{ subLockNow.remove(); }catch{} };
  },[]);
  // Reset inactivity timer on route change & keep latest pathname in a ref for interval callback
  useEffect(()=>{ pathnameRef.current = pathname || ''; lastActive = Date.now(); }, [pathname]);
  useEffect(()=>{
    const sub = DeviceEventEmitter.addListener('local-only-changed', ({ enabled })=> setLocalOnly(enabled));
    // initial load of flag (reuse async key directly)
    (async()=>{ try { const v = await AsyncStorage.getItem('privacy_local_only_v1'); setLocalOnly(v==='1'); } catch{} })();
    return ()=> sub.remove();
  },[]);
  // Global toast listener
  useEffect(()=>{
    const sub = DeviceEventEmitter.addListener('app-toast', ({ message, type, duration })=>{
      setToast({ message: String(message||''), type: type || 'info', ts: Date.now() });
      const ms = Math.min(Math.max(Number(duration||2000), 800), 6000);
      setTimeout(()=>{ setToast(null); }, ms);
    });
    return ()=> sub.remove();
  },[]);
  useEffect(()=>{
    const onAppStateChange = (state) => {
      if(state === 'active'){
        // Refresh interval and immediately evaluate background elapsed time BEFORE resetting timer
        loadInterval();
        const elapsed = (Date.now() - lastActive) / 1000;
        if (intervalRef.current && intervalRef.current > 0 && elapsed >= intervalRef.current) {
          // Trigger lock right away if we exceeded the threshold while in background
          checkLock();
          // Do not reset timer here; navigation will occur if locking
        } else {
          // No lock required; start a fresh inactivity window
          resetTimer();
        }
      } else {
        // When app goes inactive/background, mark the timestamp to measure background duration
        resetTimer();
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    lockTimerRef.current = setInterval(checkLock, 1000);
    return ()=>{ sub.remove(); if(lockTimerRef.current) clearInterval(lockTimerRef.current); };
  },[]);

  // Register notification actions and handle responses globally; run adaptive scheduler when the app becomes active
  useEffect(()=>{
    let respSub;
    (async()=>{
      try {
        const { Platform } = await import('react-native');
        const Constants = (await import('expo-constants')).default;
        const isExpoGoAndroid = Platform.OS === 'android' && Constants?.appOwnership === 'expo';
        if (isExpoGoAndroid) return; // Skip expo-notifications wiring in Expo Go Android
        const Notifications = await import('expo-notifications');
        wireForegroundHandler();
        await registerNotificationActions();
        if (Notifications?.addNotificationResponseReceivedListener) {
          respSub = Notifications.addNotificationResponseReceivedListener((resp)=>{
            try { handleNotificationResponse(resp); } catch {}
            try { openFromNotificationData(resp?.notification?.request?.content?.data); } catch {}
          });
        }
      } catch {}
    })();
    const onAppState = async (s) => {
      if (s === 'active') {
        try {
          // Attempt to register push tokens on app foreground (skip in Expo Go Android)
          try {
            const { Platform } = await import('react-native');
            const Constants = (await import('expo-constants')).default;
            const isExpoGoAndroid = Platform.OS === 'android' && Constants?.appOwnership === 'expo';
            if (!isExpoGoAndroid) {
              await registerPushTokens();
            }
          } catch {}
          const s = await getAdaptiveSettings();
          if (s?.enabled) await runAdaptiveScheduler();
        } catch {}
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    // Also run once on mount
    (async()=>{ try { const s = await getAdaptiveSettings(); if (s?.enabled) await runAdaptiveScheduler(); } catch {} })();
    return ()=>{ try { sub.remove(); } catch {}; try { respSub && respSub.remove && respSub.remove(); } catch {} };
  },[]);

  // Retention auto-purge check once per day when app becomes active
  useEffect(()=>{
    const maybeRunRetention = async ()=>{
      try {
        const days = await getRetentionDays();
        if(!days || days<=0) return;
        const last = await getRetentionLastRunTs();
        const now = Date.now();
        const ONE_DAY = 24*60*60*1000;
        if(!last || (now - last) > ONE_DAY){
          try { await purgeMoodEntriesOlderThan({ days }); } catch {}
          try { await setRetentionLastRunTs(now); } catch {}
        }
      } catch {}
    };
    const sub = AppState.addEventListener('change', (s)=>{ if(s==='active') maybeRunRetention(); });
    // run once on mount as well
    maybeRunRetention();
    return ()=> sub.remove();
  }, []);

  // Remote wipe polling (lightweight): on focus + every 30s
  useEffect(()=>{
    let wipeInterval;
    const PENDING_FLAG = 'pending_remote_wipe_v1';
    const attemptLocalWipe = async ()=>{
      try {
        await deleteAllMoodEntries();
        try { await AsyncStorage.removeItem('offlineMoodQueue'); } catch {}
        try { await AsyncStorage.removeItem('secure_mood_key_cache_b64'); } catch {}
        // Also clear from SecureStore
        try { await SecureStore.deleteItemAsync('secure_mood_key_v1', { keychainService: 'secure_mood_key_v1' }); } catch {}
        try { await SecureStore.deleteItemAsync('e2e_passphrase_blob_v1', { keychainService: 'e2e_passphrase_blob_v1' }); } catch {}
        // Clear passphrase wrapped blobs and flags
        try { await AsyncStorage.removeItem('e2e_passphrase_blob_cache_v1'); } catch {}
        try { await AsyncStorage.removeItem('e2e_passphrase_enabled_v1'); } catch {}
        try { await AsyncStorage.removeItem(PENDING_FLAG); } catch {}
        return true;
      } catch { return false; }
    };
    const checkPending = async ()=>{
      try { const p = await AsyncStorage.getItem(PENDING_FLAG); if(p==='1'){ const ok = await attemptLocalWipe(); if(ok){ const ts = Date.now(); try { await AsyncStorage.setItem('last_remote_wipe_ts', String(ts)); } catch {}; DeviceEventEmitter.emit('remote-wipe-done', { ts }); Alert.alert('Data Wiped','Pending remote wipe completed.'); } } } catch {}
    };
    const checkWipe = async () => {
      await checkPending();
      try {
        const prof = await getUserProfile();
        if(prof?.wipeRequested){
          const ok = await attemptLocalWipe();
          if(ok){
            try { await updateUserProfile({ wipeRequested:false }); } catch {}
            const ts = Date.now();
            try { await AsyncStorage.setItem('last_remote_wipe_ts', String(ts)); } catch {}
            DeviceEventEmitter.emit('remote-wipe-done', { ts });
            Alert.alert('Data Wiped', 'A remote wipe request was applied. All local mood data and encryption keys were cleared.');
          } else {
            try { await AsyncStorage.setItem(PENDING_FLAG,'1'); } catch {}
          }
        }
      } catch {}
    };
    checkWipe();
    wipeInterval = setInterval(checkWipe, 30000);
    return ()=>{ if(wipeInterval) clearInterval(wipeInterval); };
  }, []);

  // Listen for theme sync events emitted from settings
  const { setThemeMode } = useTheme?.() || {};
  React.useEffect(()=>{
    const sub = RNEmitter.addListener('theme-mode-sync', ({ mode })=>{ if(setThemeMode) setThemeMode(mode); });
    return ()=> sub.remove();
  }, [setThemeMode]);

  return (
    <TouchableWithoutFeedback onPress={resetTimer} onLongPress={resetTimer}>
      <View
        style={{ flex:1 }}
        onStartShouldSetResponderCapture={() => { resetTimer(); return false; }}
        onResponderStart={resetTimer}
      >
        {children}
        {localOnly && !pathname.includes('login') && !pathname.includes('biometricLogin') && (
          <View style={stylesLocalOnly.badge} pointerEvents="none">
            <Text style={stylesLocalOnly.badgeText}>LOCAL ONLY</Text>
          </View>
        )}
        {toast && (
          <View style={[toastStyles.wrap, toast.type==='error'? toastStyles.error : toast.type==='success'? toastStyles.success : toastStyles.info]}>
            <Text style={toastStyles.text} numberOfLines={2}>{toast.message}</Text>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

function Layout() {
  const router = useRouter();
  const pathname = usePathname();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  // Global auth observer to clear user-scoped subscriptions on sign-out/delete
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, (u)=>{
      if(!u){
        // Tear down any tracked listeners immediately when no user
        try { clearUserSubscriptions(); } catch {}
      }
    });
    return ()=> { try { unsub(); } catch {} };
  },[]);

  // Tiny loading gate to prevent initial flicker while resolving auth + profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = auth.currentUser;
        const path = pathname || '';
        const publicPaths = new Set([
          '/splash',
          '/onboarding',
          '/login',
          '/signup',
          '/forgotPassword',
          '/biometricLogin',
        ]);

        if (!user) {
          if (!publicPaths.has(path)) {
            const flagged = await AsyncStorage.getItem('cs_onboarded');
            if (cancelled) return;
            router.replace(flagged ? '/login' : '/onboarding');
          }
        } else {
          // Warm user profile (role) cache to reduce flicker on first guarded nav later
          try { await getUserProfile(); } catch {}
          if (path === '/splash' || path === '/login' || path === '/onboarding') {
            router.replace('/(tabs)');
          }
        }
      } catch {}
      if (!cancelled) setIsBootstrapping(false);
    })();
    return () => { cancelled = true; };
    // Run once on mount; avoid re-running on pathname changes for the loading gate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route guard: ensure unauthenticated users can't land on tabs/home directly
  useEffect(() => {
    if (isBootstrapping) return; // Skip guard during initial bootstrap to avoid double redirects/flicker
    let cancelled = false;
    (async () => {
      try {
        const user = auth.currentUser;
        const path = pathname || '';
        const publicPaths = new Set([
          '/splash',
          '/onboarding',
          '/login',
          '/signup',
          '/forgotPassword',
          '/biometricLogin',
        ]);

        if (!user) {
          // If we're on a protected route without auth, send to onboarding/login
          if (!publicPaths.has(path)) {
            const flagged = await AsyncStorage.getItem('cs_onboarded');
            if (cancelled) return;
            router.replace(flagged ? '/login' : '/onboarding');
          }
        } else {
          // If authenticated and somehow on splash/login/onboarding, send to main tabs
          if (path === '/splash' || path === '/login' || path === '/onboarding') {
            router.replace('/(tabs)');
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [pathname, isBootstrapping]);

  const BackBtn = (props) => {
    const router = useRouter();
    const nav = useNavigation();
    const pathname = usePathname();
    const handleBack = () => {
      try {
        // Prefer navigation stack back if possible
        if (nav?.canGoBack && nav.canGoBack()) {
          nav.goBack();
          return;
        }
        // If on biometric screen with no history, send to login (user intent might be to cancel unlock)
        if (pathname?.includes('biometricLogin')) {
          router.replace('/login');
          return;
        }
        // Fallback to home/index without triggering warning
  router.replace('/(tabs)');
      } catch (e) {
  try { router.replace('/(tabs)'); } catch {}
      }
    };
    return (
      <TouchableOpacity style={stylesLocalOnly.backBtn} onPress={handleBack}>
        <Text style={stylesLocalOnly.backTxt}>{'<'} Back</Text>
      </TouchableOpacity>
    );
  };
  return (
    <ThemeProvider>
      <ActivityWrapper>
      {isBootstrapping ? (
        <View style={stylesLocalOnly.loadingWrap}>
          <AppLogo size={64} style={{ marginBottom: 12 }} />
          <ActivityIndicator size="small" color="#0288D1" />
          <Text style={stylesLocalOnly.loadingTxt}>Loading…</Text>
        </View>
      ) : (
      <Stack initialRouteName="splash">
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="splash" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Login" }} />
        <Stack.Screen name="signup" options={{ title: "Sign Up" }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="index" options={{ title: "Home", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
    <Stack.Screen name="meditation" options={{ title: "Meditation", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
        <Stack.Screen name="plan" options={{ title: "Meditation Plan", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
        <Stack.Screen name="report" options={{ title: "Weekly Report", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
        <Stack.Screen name="notifications" options={{ title: "Reminder Settings", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
        <Stack.Screen name="settings" options={{ title: "Settings", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
  <Stack.Screen name="achievements" options={{ title: "Achievements", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
    <Stack.Screen name="sessions" options={{ title: "Sessions", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
    <Stack.Screen name="session/[id]" options={{ title: "Session Details", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
    <Stack.Screen name="moodTracker" options={{ title: "Mood & Stress Tracker", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
    <Stack.Screen name="wellnessReport" options={{ title: "Wellness Report", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
  <Stack.Screen name="biometricLogin" options={{ title: "Biometric Login", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
        <Stack.Screen name="plan-setup" options={{ title: "Plan Setup", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
        <Stack.Screen name="your-plan" options={{ title: "Your Plan", headerLeft: () => <BackBtn />, headerRight: () => <AppLogo size={28} style={{ marginRight: 8 }} /> }} />
      </Stack>
      )}
      </ActivityWrapper>
      <OfflineIndicator />
    </ThemeProvider>
  );
}

// Wrap root in ErrorBoundary and export as default
export default function RootLayoutWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <Layout />
    </ErrorBoundary>
  );
}

const stylesLocalOnly = StyleSheet.create({
  badge:{ position:'absolute', bottom:16, right:16, backgroundColor:'#FF6F00', paddingHorizontal:12, paddingVertical:6, borderRadius:20, shadowColor:'#000', shadowOpacity:0.25, shadowRadius:4, elevation:4 },
  badgeText:{ color:'#fff', fontWeight:'800', fontSize:12, letterSpacing:0.5 }
  ,backBtn:{ paddingHorizontal:12, paddingVertical:6 },
  backTxt:{ color:'#0288D1', fontSize:14, fontWeight:'700' },
  loadingWrap:{ flex:1, alignItems:'center', justifyContent:'center', padding:24, gap:8 },
  loadingTxt:{ marginTop:8, color:'#607D8B', fontSize:12 }
});

const toastStyles = StyleSheet.create({
  wrap:{ position:'absolute', left:16, right:16, bottom:72, paddingVertical:10, paddingHorizontal:14, borderRadius:12, shadowColor:'#000', shadowOpacity:0.25, shadowRadius:6, elevation:6 },
  text:{ color:'#fff', fontWeight:'700' },
  info:{ backgroundColor:'#37474F' },
  success:{ backgroundColor:'#2e7d32' },
  error:{ backgroundColor:'#c62828' }
});
