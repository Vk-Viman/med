import { Stack, useRouter, usePathname, useNavigation } from "expo-router";
import React, { useEffect, useRef } from 'react';
import { AppState, TouchableWithoutFeedback, View, Text, StyleSheet, DeviceEventEmitter, TouchableOpacity, Alert } from 'react-native';
import { getUserProfile, updateUserProfile } from '../src/services/userProfile';
import { deleteAllMoodEntries, getRetentionDays, getRetentionLastRunTs, setRetentionLastRunTs, purgeMoodEntriesOlderThan } from '../src/services/moodEntries';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { DeviceEventEmitter as RNEmitter } from 'react-native';

const AUTO_LOCK_KEY = 'privacy_auto_lock_seconds_v1';
const LAST_ROUTE_BEFORE_LOCK_KEY = 'last_route_before_lock_v1';
let lastActive = Date.now();

function ActivityWrapper({ children }){
  const router = useRouter();
  const pathname = usePathname();
  const lockTimerRef = useRef(null);
  const intervalRef = useRef(0);
  const [localOnly, setLocalOnly] = React.useState(false);

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
        if(!pathname.includes('biometricLogin') && !pathname.includes('login')){
          AsyncStorage.setItem(LAST_ROUTE_BEFORE_LOCK_KEY, pathname).catch(()=>{});
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
    return ()=> sub.remove();
  },[]);
  // Reset inactivity timer on route change
  useEffect(()=>{ lastActive = Date.now(); }, [pathname]);
  useEffect(()=>{
    const sub = DeviceEventEmitter.addListener('local-only-changed', ({ enabled })=> setLocalOnly(enabled));
    // initial load of flag (reuse async key directly)
    (async()=>{ try { const v = await AsyncStorage.getItem('privacy_local_only_v1'); setLocalOnly(v==='1'); } catch{} })();
    return ()=> sub.remove();
  },[]);
  useEffect(()=>{
    const sub = AppState.addEventListener('change', state => { if(state==='active'){ loadInterval(); resetTimer(); } else { resetTimer(); } });
    lockTimerRef.current = setInterval(checkLock, 1000);
    return ()=>{ sub.remove(); if(lockTimerRef.current) clearInterval(lockTimerRef.current); };
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
      <View style={{ flex:1 }}>
        {children}
        {localOnly && !pathname.includes('login') && !pathname.includes('biometricLogin') && (
          <View style={stylesLocalOnly.badge} pointerEvents="none">
            <Text style={stylesLocalOnly.badgeText}>LOCAL ONLY</Text>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

export default function Layout() {
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
      <Stack initialRouteName="splash">
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="splash" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Login" }} />
        <Stack.Screen name="signup" options={{ title: "Sign Up" }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="index" options={{ title: "Home", headerLeft: () => <BackBtn /> }} />
    <Stack.Screen name="meditation" options={{ title: "Meditation", headerLeft: () => <BackBtn /> }} />
        <Stack.Screen name="plan" options={{ title: "Meditation Plan", headerLeft: () => <BackBtn /> }} />
        <Stack.Screen name="report" options={{ title: "Weekly Report", headerLeft: () => <BackBtn /> }} />
        <Stack.Screen name="notifications" options={{ title: "Reminder Settings", headerLeft: () => <BackBtn /> }} />
        <Stack.Screen name="settings" options={{ title: "Settings", headerLeft: () => <BackBtn /> }} />
  <Stack.Screen name="achievements" options={{ title: "Achievements", headerLeft: () => <BackBtn /> }} />
    <Stack.Screen name="moodTracker" options={{ title: "Mood & Stress Tracker", headerLeft: () => <BackBtn /> }} />
    <Stack.Screen name="wellnessReport" options={{ title: "Wellness Report", headerLeft: () => <BackBtn /> }} />
  <Stack.Screen name="biometricLogin" options={{ title: "Biometric Login", headerLeft: () => <BackBtn /> }} />
      </Stack>
      </ActivityWrapper>
    </ThemeProvider>
  );
}

const stylesLocalOnly = StyleSheet.create({
  badge:{ position:'absolute', bottom:16, right:16, backgroundColor:'#FF6F00', paddingHorizontal:12, paddingVertical:6, borderRadius:20, shadowColor:'#000', shadowOpacity:0.25, shadowRadius:4, elevation:4 },
  badgeText:{ color:'#fff', fontWeight:'800', fontSize:12, letterSpacing:0.5 }
  ,backBtn:{ paddingHorizontal:12, paddingVertical:6 },
  backTxt:{ color:'#0288D1', fontSize:14, fontWeight:'700' }
});
