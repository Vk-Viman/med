import React, { useEffect, useMemo, useState, useRef } from "react";
import { View, Text, StyleSheet, Alert, Switch, TouchableOpacity, Share, DeviceEventEmitter, SectionList, Image, AccessibilityInfo, InteractionManager, findNodeHandle, Platform, ToastAndroid } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import PrimaryButton from "../src/components/PrimaryButton";
import { auth } from "../firebase/firebaseConfig";
import { signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser, sendEmailVerification } from "firebase/auth";
import { spacing, radius, shadow } from "../src/theme";
import { useTheme } from "../src/theme/ThemeProvider";
import { exportAllMoodEntries, exportMoodEntriesBetween, buildMoodCSV, buildMoodMarkdown, getLocalOnlyMode, setLocalOnlyMode, deleteAllMoodEntries, escrowEncryptDeviceKey, escrowDecryptDeviceKey, getEncryptionStatus, enablePassphraseProtection, disablePassphraseProtection, unlockWithPassphrase, lockEncryptionKey, migrateLegacyToV2, backfillMoodScores, getRetentionDays, setRetentionDays, purgeMoodEntriesOlderThan } from "../src/services/moodEntries";
import { getUserProfile, updateUserProfile, ensureUserProfile, deleteUserProfile } from '../src/services/userProfile';
import { bumpSessionEpoch } from '../src/services/userProfile';
import { getHapticsEnabled, setHapticsEnabled, initHapticsPref } from '../src/utils/haptics';
import { getDefaultBg, setDefaultBg, getAutoplayLast, setAutoplayLast, getKeepAwake, setKeepAwake, getAutoPauseOnCall, setAutoPauseOnCall, getDailyReminderTime, setDailyReminderTime, getQuietHours, setQuietHours } from '../src/utils/playerPrefs';
import { requestLocalNotificationPermissions, scheduleLocalNotification, cancelAllLocalNotifications } from '../src/notifications';
import * as ImagePicker from 'expo-image-picker';
import { DeviceEventEmitter as RNEmitter } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as FSLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getAdminConfig, subscribeAdminConfig } from '../src/services/config';
import { registerPushTokens } from '../src/services/pushTokens';
import { db } from '../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
// Removed Recent Achievements from Settings – no longer needed here

const BIOMETRIC_PREF_KEY = 'pref_biometric_enabled_v1';

const AUTO_LOCK_KEY = 'privacy_auto_lock_seconds_v1';
const DEFAULT_INTERVAL = 0; // 0 = disabled
const INTERVAL_OPTIONS = [0, 30, 60, 300, 600]; // seconds

export default function SettingsScreen() {
  const { theme, mode, setThemeMode } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const titleRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const [autoLock, setAutoLock] = useState(DEFAULT_INTERVAL);
  const [biometricPref, setBiometricPref] = useState(true);
  const [showChangePass, setShowChangePass] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changingPass, setChangingPass] = useState(false);
  const [showDeleteAcct, setShowDeleteAcct] = useState(false);
  const [delPass, setDelPass] = useState('');
  const [deletingAcct, setDeletingAcct] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarB64, setAvatarB64] = useState(null);
  const [pwScore, setPwScore] = useState(-1); // -1 not evaluated
  const [pwFeedback, setPwFeedback] = useState('');
  const [themeMode, setThemeModeLocal] = useState('light');
  const [lastRemoteWipe, setLastRemoteWipe] = useState(null);
  const [emailVerified, setEmailVerified] = useState(true);
  const [sendingVerify, setSendingVerify] = useState(false);
  const [refreshingVerify, setRefreshingVerify] = useState(false);
  const [analyticsOptOut, setAnalyticsOptOut] = useState(false);
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const [termsAcceptedVersion, setTermsAcceptedVersion] = useState(null);
  const [privacyAcceptedAt, setPrivacyAcceptedAt] = useState(null);
  const [showKeyEscrow, setShowKeyEscrow] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [escrowing, setEscrowing] = useState(false);
  const [importPassphrase, setImportPassphrase] = useState('');
  const [importData, setImportData] = useState(''); // JSON blob pasted
  const [importing, setImporting] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showConfirmPassphrase, setShowConfirmPassphrase] = useState(false);
  const [showImportPassphrase, setShowImportPassphrase] = useState(false);
  // Export enhancements
  const [rangeExporting, setRangeExporting] = useState(false);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [rangePicking, setRangePicking] = useState(null); // 'start' | 'end'
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [androidDirUri, setAndroidDirUri] = useState(null);
  // Encryption management
  const [encStatus, setEncStatus] = useState({ passphraseProtected:false, algorithm:'', encVer:2 });
  const [encExpanded, setEncExpanded] = useState(false);
  const [encPass, setEncPass] = useState('');
  const [encPass2, setEncPass2] = useState('');
  const [unlockPass, setUnlockPass] = useState('');
  const [showEncPass, setShowEncPass] = useState(false);
  const [showEncPass2, setShowEncPass2] = useState(false);
  const [showUnlockPass, setShowUnlockPass] = useState(false);
  const [busyEnc, setBusyEnc] = useState(false);
  const [migrateExpanded, setMigrateExpanded] = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);
  // Retention
  const [retentionDays, setRetentionDaysState] = useState(0); // 0 = disabled
  const [purging, setPurging] = useState(false);
  const [cfg, setCfg] = useState({ allowExports:true, allowRetention:true, allowBackfillTools:false });
  // Player preferences
  const [prefDefaultBg, setPrefDefaultBg] = useState('none');
  const [prefAutoplayLast, setPrefAutoplayLast] = useState(false);
  const [prefKeepAwake, setPrefKeepAwake] = useState(false);
  const [prefAutoPauseOnCall, setPrefAutoPauseOnCall] = useState(true);
  // Reminders
  const [dailyTime, setDailyTime] = useState(''); // 'HH:MM' or '' = off
  const [quiet, setQuiet] = useState({ start:'', end:'' });
  // Weekly digest preference (local + profile flag)
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(true);
  const [weeklyDigestLoading, setWeeklyDigestLoading] = useState(false);
  // Notification preferences (default all enabled)
  const [notifPrefs, setNotifPrefs] = useState({ notifyMentions:true, notifyReplies:true, notifyMilestones:true, notifyBadges:true });

  // ===== Key Escrow Handlers =====
  const handleCreateEscrow = async () => {
    if(escrowing) return; if(!passphrase || !confirmPassphrase){ Alert.alert('Escrow','Enter and confirm a passphrase.'); return; }
    if(passphrase !== confirmPassphrase){ Alert.alert('Escrow','Passphrases do not match.'); return; }
    if(passphrase.length < 6){ Alert.alert('Escrow','Use a passphrase at least 6 characters.'); return; }
    try {
      setEscrowing(true);
      const wrapped = await escrowEncryptDeviceKey(passphrase);
      // Store wrapped escrow blob in profile
      try { await updateUserProfile({ keyEscrow: wrapped }); } catch{}
      setPassphrase(''); setConfirmPassphrase('');
      Alert.alert('Escrow','Escrow stored in profile. Keep your passphrase safe.');
    } catch(e){ Alert.alert('Escrow Failed', e.message); }
    finally { setEscrowing(false); }
  };

  const handleExportEscrow = async () => {
    try {
      const prof = await getUserProfile();
      if(!prof?.keyEscrow){ Alert.alert('Escrow','No escrow stored yet.'); return; }
      const jsonStr = JSON.stringify({ type:'keyEscrow.v1', data: prof.keyEscrow }, null, 2);
      await Share.share({ message: jsonStr });
    } catch(e){ Alert.alert('Export Failed', e.message); }
  };

  const handleImportEscrow = async () => {
    if(importing) return; if(!importData || !importPassphrase){ Alert.alert('Escrow','Paste escrow JSON and passphrase.'); return; }
    try {
      setImporting(true);
      let parsed;
      try { parsed = JSON.parse(importData); } catch { throw new Error('Invalid JSON'); }
  if(parsed?.type !== 'keyEscrow.v1' || !parsed.data) throw new Error('Unsupported escrow blob');
  const ok = await escrowDecryptDeviceKey(importPassphrase, parsed.data);
      if(ok){
        Alert.alert('Escrow','Escrow import successful. Encryption key restored for this device.');
        setImportData(''); setImportPassphrase('');
      } else {
        Alert.alert('Escrow','Incorrect passphrase or corrupt escrow.');
      }
    } catch(e){ Alert.alert('Import Failed', e.message); }
    finally { setImporting(false); }
  };

  useEffect(()=>{ (async()=>{
    setLocalOnly(await getLocalOnlyMode());
    try{ await initHapticsPref(); setHapticsEnabledState(await getHapticsEnabled()); }catch{}
    try{ const v = await AsyncStorage.getItem(AUTO_LOCK_KEY); if(v) setAutoLock(Number(v)); }catch{}
    try{ const b = await AsyncStorage.getItem(BIOMETRIC_PREF_KEY); if(b!==null) setBiometricPref(b==='1'); }catch{}
    // Load profile
  try { await ensureUserProfile(); const prof = await getUserProfile(); if(prof){
    setDisplayName(prof.displayName || '');
    if(typeof prof.biometricEnabled === 'boolean') setBiometricPref(prof.biometricEnabled);
    if(prof.avatarB64) setAvatarB64(prof.avatarB64);
    if(prof.themeMode==='dark'||prof.themeMode==='light'){ setThemeModeLocal(prof.themeMode); }
    if(typeof prof.analyticsOptOut === 'boolean') setAnalyticsOptOut(prof.analyticsOptOut);
    if('termsAcceptedVersion' in prof) setTermsAcceptedVersion(prof.termsAcceptedVersion);
    if('privacyAcceptedAt' in prof) setPrivacyAcceptedAt(prof.privacyAcceptedAt);
    if(typeof prof.weeklyDigestEnabled === 'boolean') {
      setWeeklyDigestEnabled(prof.weeklyDigestEnabled);
    } else {
      // Persist default true only once to profile
      try { await updateUserProfile({ weeklyDigestEnabled: true }); } catch {}
      setWeeklyDigestEnabled(true);
    }
    // Load notification prefs if present (fallback true)
    setNotifPrefs(p=>({
      notifyMentions: prof.notifyMentions !== false,
      notifyReplies: prof.notifyReplies !== false,
      notifyMilestones: prof.notifyMilestones !== false,
      notifyBadges: prof.notifyBadges !== false
    }));
  } } catch {}
  try { const ts = await AsyncStorage.getItem('last_remote_wipe_ts'); if(ts) setLastRemoteWipe(Number(ts)); } catch {}
  try { const r = await getRetentionDays(); setRetentionDaysState(r||0); } catch {}
  // Load player prefs & reminders
  try { setPrefDefaultBg(await getDefaultBg()); } catch {}
  try { setPrefAutoplayLast(await getAutoplayLast()); } catch {}
  try { setPrefKeepAwake(await getKeepAwake()); } catch {}
  try { setPrefAutoPauseOnCall(await getAutoPauseOnCall()); } catch {}
  try { setDailyTime(await getDailyReminderTime()); } catch {}
  try { setQuiet(await getQuietHours()); } catch {}
  })(); },[]);
  // Subscribe to admin config
  useEffect(()=>{
    let unsub;
    (async()=>{ try { setCfg(await getAdminConfig()); } catch {} ; try { unsub = subscribeAdminConfig(setCfg); } catch {} })();
    return ()=>{ try{ unsub && unsub(); }catch{} };
  },[]);

  // Load encryption status
  useEffect(()=>{ (async()=>{ try { const st = await getEncryptionStatus(); setEncStatus(st); } catch {} })(); },[]);

  // Listen for remote wipe events to refresh timestamp
  useEffect(()=>{
    const sub = DeviceEventEmitter.addListener('remote-wipe-done', ({ ts })=> setLastRemoteWipe(ts));
    return ()=> sub.remove();
  },[]);

  const resetOnboarding = async () => {
    await AsyncStorage.removeItem("cs_onboarded");
    Alert.alert("Reset", "Onboarding will show next launch.");
  };

  const logout = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  // ===== Notifications / Reminders =====
  async function ensureNotifPerms(){
    return requestLocalNotificationPermissions();
  }
  async function scheduleDailyReminder(hhmm){
    // Clear previous to avoid duplicates; simple global cancel to keep patch small
    try { await cancelAllLocalNotifications(); } catch {}
    if(!hhmm) return; // off
    if(!await ensureNotifPerms()) { Alert.alert('Notifications','Permission not granted'); return; }
    const [h,m] = hhmm.split(':').map(n=> parseInt(n,10));
    try {
      await scheduleLocalNotification({ title: 'Time to unwind', body: 'Take a few minutes to meditate today.', hour: h, minute: m });
    } catch(e){ Alert.alert('Reminder Failed', e.message); }
  }
  const saveDailyTime = async (hhmm) => { setDailyTime(hhmm); await setDailyReminderTime(hhmm); await scheduleDailyReminder(hhmm); };
  const saveQuiet = async (start,end) => { const s=start||''; const e=end||''; setQuiet({ start:s, end:e }); await setQuietHours(s,e); };

  // ===== Player Prefs Handlers =====
  const saveDefaultBg = async (val) => { setPrefDefaultBg(val); await setDefaultBg(val); };
  const saveAutoplayLast = async (val) => { setPrefAutoplayLast(val); await setAutoplayLast(val); };
  const saveKeepAwake = async (val) => { setPrefKeepAwake(val); await setKeepAwake(val); };
  const saveAutoPauseOnCall = async (val) => { setPrefAutoPauseOnCall(val); await setAutoPauseOnCall(val); };

  // ===== Helper / Capability Checks =====
  const canEmailPassword = () => {
    const user = auth.currentUser; if(!user) return false; return user.providerData.some(p=> p.providerId === 'password');
  };

  // ===== Export =====
  const saveToFileAndShare = async (filename, mimeType, content) => {
    try {
      let fileUri = '';
      let savedAnyFile = false;
      let folderLabel = '';
      const labelForBase = (base) => {
        if(!base) return '';
        if(base === FileSystem.documentDirectory) return 'App Documents';
        if(base === FileSystem.cacheDirectory) return 'App Cache';
        return 'App Storage';
      };
      const getFolderLabelFromUri = (uri) => {
        try{
          if(!uri) return '';
          if(uri.startsWith('content://')){
            const dec = decodeURIComponent(uri);
            const treeIdx = dec.indexOf('tree/');
            let part = dec;
            if(treeIdx !== -1){ part = dec.slice(treeIdx + 5); }
            if(part.includes(':')){ part = part.split(':').pop(); }
            if(part.includes('/')){ const segs = part.split('/'); part = segs[segs.length - 1]; }
            return part || 'Selected folder';
          }
          if(uri.startsWith('file://')){
            const path = uri.replace('file://','');
            const dirPath = path.substring(0, path.lastIndexOf('/'));
            const segs = dirPath.split('/');
            return segs[segs.length - 1] || 'App Storage';
          }
          return 'App Storage';
        }catch{ return 'App Storage'; }
      };
      const showSuccessToast = (msg) => {
        if(!msg) return;
        if(Platform.OS === 'android'){
          try{ ToastAndroid.show(msg, ToastAndroid.SHORT); }catch{}
        } else {
          try{ Alert.alert('', msg); }catch{}
        }
      };
      if(Platform.OS === 'android'){
        const SAF = FileSystem.StorageAccessFramework;
        if(SAF){
          try{
            let dirUri = androidDirUri;
            if(!dirUri){
              const perm = await SAF.requestDirectoryPermissionsAsync();
              if(perm.granted){ dirUri = perm.directoryUri; try{ await AsyncStorage.setItem('android_export_dir_uri_v1', dirUri); }catch{} setAndroidDirUri(dirUri); }
            }
            if(!dirUri){
              // User did not grant; share content only and return
              await Share.share({ message: content });
              showSuccessToast('Shared export (no file saved)');
              return;
            }
            const uri = await SAF.createFileAsync(dirUri, filename, mimeType);
            await FSLegacy.writeAsStringAsync(uri, content, { encoding: 'utf8' });
            fileUri = uri;
            savedAnyFile = true;
            folderLabel = getFolderLabelFromUri(dirUri);
          }catch(e){
            // SAF path failed; attempt app cache write as fallback
            try{ await AsyncStorage.removeItem('android_export_dir_uri_v1'); }catch{}
            setAndroidDirUri(null);
            const base = (FileSystem.documentDirectory || FileSystem.cacheDirectory || '');
            if(!base){ throw new Error('No writable directory available'); }
            fileUri = `${base}${filename}`;
            await FSLegacy.writeAsStringAsync(fileUri, content, { encoding: 'utf8' });
            savedAnyFile = true;
            folderLabel = labelForBase(base);
          }
        } else {
          // No SAF available; use app storage or share content only
          const base = (FileSystem.documentDirectory || FileSystem.cacheDirectory || '');
          if(!base){ await Share.share({ message: content }); showSuccessToast('Shared export (no file saved)'); return; }
          fileUri = `${base}${filename}`;
          await FSLegacy.writeAsStringAsync(fileUri, content, { encoding: 'utf8' });
          savedAnyFile = true;
          folderLabel = labelForBase(base);
        }
      } else {
        // iOS / others: write to app directory
        const base = (FileSystem.documentDirectory || FileSystem.cacheDirectory || '');
        if(!base){ await Share.share({ message: content }); showSuccessToast('Shared export (no file saved)'); return; }
        fileUri = `${base}${filename}`;
        await FSLegacy.writeAsStringAsync(fileUri, content, { encoding: 'utf8' });
        savedAnyFile = true;
        folderLabel = labelForBase(base);
      }
      // Normalize for sharing where needed
      if(!fileUri.startsWith('file://') && !fileUri.startsWith('content://')){
        fileUri = `file://${fileUri}`;
      }
      try{
        if(await Sharing.isAvailableAsync()){
          await Sharing.shareAsync(fileUri, { UTI: mimeType, mimeType, dialogTitle: `Share ${filename}` });
        } else {
          await Share.share({ url: fileUri, message: `Export file: ${filename}` });
        }
        if(savedAnyFile){
          showSuccessToast(`Saved to ${folderLabel} • Shared`);
        } else {
          showSuccessToast('Shared export (no file saved)');
        }
      } catch(shareErr){
        if(savedAnyFile){ showSuccessToast(`Saved to ${folderLabel}`); }
        Alert.alert('Share Failed', shareErr.message);
      }
    } catch(e){ Alert.alert('Export Failed', e.message); }
  };

  const doExport = async (format) => {
    if(exporting) return; setExporting(true);
    try {
      const rows = await exportAllMoodEntries();
      if(!rows.length){ Alert.alert('Export','No entries to export.'); return; }
      const ts = new Date();
      const pad = (n)=> String(n).padStart(2,'0');
      const stamp = `${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
      if(format==='json'){
        const jsonStr = JSON.stringify({ exportedAt:new Date().toISOString(), count:rows.length, entries:rows }, null, 2);
        await saveToFileAndShare(`moods_${stamp}.json`, 'application/json', jsonStr);
      } else if(format==='md') {
        const md = buildMoodMarkdown(rows);
        await saveToFileAndShare(`moods_${stamp}.md`, 'text/markdown', md);
      } else {
        const csv = buildMoodCSV(rows);
        await saveToFileAndShare(`moods_${stamp}.csv`, 'text/csv', csv);
      }
    } catch(e){ Alert.alert('Export Failed', e.message); }
    finally { setExporting(false); }
  };

  useEffect(()=>{ (async()=>{ try { const uri = await AsyncStorage.getItem('android_export_dir_uri_v1'); if(uri) setAndroidDirUri(uri); } catch {} })(); },[]);

  // Prefill date range to last 7 days for convenience
  useEffect(()=>{
    if(!rangeStart || !rangeEnd){
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()-6);
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if(!rangeStart) setRangeStart(start);
      if(!rangeEnd) setRangeEnd(end);
    }
  },[]);

  const beginPickDate = (which) => { setRangePicking(which); setShowDatePicker(true); };

  const onDatePicked = (event) => {
    if(event?.type === 'dismissed'){ setShowDatePicker(false); return; }
    const ts = event.nativeEvent?.timestamp ?? (event?.timestamp);
    const date = ts ? new Date(ts) : new Date();
    if(rangePicking === 'start'){ setRangeStart(new Date(date.getFullYear(), date.getMonth(), date.getDate())); }
    if(rangePicking === 'end'){ setRangeEnd(new Date(date.getFullYear(), date.getMonth(), date.getDate())); }
    setShowDatePicker(false); setRangePicking(null);
  };

  const doRangeExport = async (format) => {
    if(rangeExporting) return; setRangeExporting(true);
    try{
      if(!rangeStart || !rangeEnd){ Alert.alert('Export','Pick both start and end dates.'); return; }
      if(rangeEnd < rangeStart){ Alert.alert('Export','End date must be after start date.'); return; }
      const rows = await exportMoodEntriesBetween({ startDate: rangeStart, endDate: rangeEnd });
      if(!rows.length){ Alert.alert('Export','No entries in the selected range.'); return; }
      const ts = new Date();
      const pad = (n)=> String(n).padStart(2,'0');
      const stamp = `${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
      const rangeTag = `${rangeStart.toISOString().slice(0,10)}_${rangeEnd.toISOString().slice(0,10)}`;
      if(format==='json'){
        const jsonStr = JSON.stringify({ exportedAt:new Date().toISOString(), range:{ start: rangeStart.toISOString(), end: rangeEnd.toISOString() }, count:rows.length, entries:rows }, null, 2);
        await saveToFileAndShare(`moods_${rangeTag}_${stamp}.json`, 'application/json', jsonStr);
      } else if(format==='md'){
        const md = buildMoodMarkdown(rows);
        await saveToFileAndShare(`moods_${rangeTag}_${stamp}.md`, 'text/markdown', md);
      } else {
        const csv = buildMoodCSV(rows);
        await saveToFileAndShare(`moods_${rangeTag}_${stamp}.csv`, 'text/csv', csv);
      }
    }catch(e){ Alert.alert('Export Failed', e.message); }
    finally{ setRangeExporting(false); }
  };

  const rePickAndroidFolder = async () => {
    if(!(Platform.OS === 'android' && FileSystem.StorageAccessFramework)){
      Alert.alert('Export Folder', 'Folder selection is only needed on Android.');
      return;
    }
    try{
      const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if(perm.granted){
        const dirUri = perm.directoryUri;
        setAndroidDirUri(dirUri);
        try{ await AsyncStorage.setItem('android_export_dir_uri_v1', dirUri); }catch{}
        Alert.alert('Export Folder', 'Export folder updated.');
      }
    }catch(e){ Alert.alert('Export Folder', e.message); }
  };

  // ===== Local Only Toggle =====
  const toggleLocalOnly = async (val) => {
    setLocalOnly(val);
    try { await setLocalOnlyMode(val); } catch {}
    Alert.alert('Mode Updated', val? 'Local-only enabled: new entries will not sync.' : 'Cloud sync re-enabled.');
  };

  // ===== Biometric Toggle =====
  const toggleBiometric = async (val) => {
    setBiometricPref(val);
    try { await AsyncStorage.setItem(BIOMETRIC_PREF_KEY, val? '1':'0'); } catch {}
    try { await updateUserProfile({ biometricEnabled: val }); } catch {}
    Alert.alert('Biometrics', val? 'Biometric quick unlock enabled.' : 'Biometric quick unlock disabled.');
  };

  // ===== Haptics Toggle =====
  const toggleHaptics = async (val) => {
    setHapticsEnabledState(val);
    try { await setHapticsEnabled(val); } catch {}
  };

  // Weekly digest toggle
  let weeklyDigestToggleTimer = null;
  const toggleWeeklyDigest = async () => {
    if(weeklyDigestLoading) return; // debounce rapid taps
    const next = !weeklyDigestEnabled;
    setWeeklyDigestEnabled(next);
    setWeeklyDigestLoading(true);
    try {
      await updateUserProfile({ weeklyDigestEnabled: next });
      if(next){
        try { const { scheduleWeeklyDigestReminder } = await import('../src/notifications'); await scheduleWeeklyDigestReminder(); } catch {}
      } else {
        try { const { cancelWeeklyDigestReminder } = await import('../src/notifications'); await cancelWeeklyDigestReminder(); } catch {}
      }
    } finally {
      // slight delay to avoid flicker / double-fire
      weeklyDigestToggleTimer && clearTimeout(weeklyDigestToggleTimer);
      weeklyDigestToggleTimer = setTimeout(()=> setWeeklyDigestLoading(false), 400);
    }
  };

  // ===== Notification Prefs Update =====
  const updateNotifPref = async (key, val) => {
    setNotifPrefs(prev => ({ ...prev, [key]: val }));
    try { await updateUserProfile({ [key]: val }); } catch {}
  };

  // ===== Auto-lock Interval =====
  const changeAutoLock = async (val) => {
    setAutoLock(val);
    try { await AsyncStorage.setItem(AUTO_LOCK_KEY, String(val)); } catch {}
    DeviceEventEmitter.emit('auto-lock-changed', { seconds: val });
  };

  const formatInterval = (s) => s===0? 'Off' : s<60? `${s}s` : `${Math.round(s/60)}m`;

  // ===== Delete All Mood Entries =====
  const confirmDeleteAll = () => {
    Alert.alert('Delete All Entries','This will permanently remove all synced mood data. Continue?',[
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async ()=>{
          try { await deleteAllMoodEntries(); Alert.alert('Deleted','All mood entries removed.'); } catch(e){ Alert.alert('Error', e.message); }
        } }
    ]);
  };

  const confirmManualPurge = () => {
    if(!retentionDays || retentionDays<=0){ Alert.alert('Auto-Purge','Set a retention period first (e.g., 30 days).'); return; }
    Alert.alert('Purge Old Entries', `Delete entries older than ${retentionDays} days? This cannot be undone.`, [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async ()=>{
          if(purging) return; setPurging(true);
          try{ const n = await purgeMoodEntriesOlderThan({ days: retentionDays }); Alert.alert('Auto-Purge', n? `Deleted ${n} old entries.` : 'No entries older than the selected period.'); }
          catch(e){ Alert.alert('Purge Failed', e.message); }
          finally{ setPurging(false); }
        } }
    ]);
  };

  const updateRetention = async (days) => {
    setRetentionDaysState(days);
    try{ await setRetentionDays(days); }catch{}
  };

  // ===== Password Strength Evaluation =====
  const evaluatePassword = (pwd) => {
    if(!pwd) return { score:-1, feedback:'' };
    let score = 0;
    const len = pwd.length;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasDigit = /\d/.test(pwd);
    const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
    const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
    if(len >= 8) score++;
    if(len >= 12) score++;
    if(variety >= 2) score++;
    if(variety >= 3) score++;
    if(variety === 4) score++;
    if(score > 4) score = 4;
    const feedbackMap = [
      'Too weak: use at least 8 chars.',
      'Weak: add length & more variety.',
      'Fair: could be stronger (longer or more symbols).',
      'Strong password.',
      'Excellent password.'
    ];
    return { score, feedback: feedbackMap[score] };
  };

  useEffect(()=>{ const { score, feedback } = evaluatePassword(newPass); setPwScore(score); setPwFeedback(feedback); }, [newPass]);

  // ===== Password Change =====
  const RATE_WINDOW_MS = 5000; let lastSensitive = 0;
  function rateGate(){ const now = Date.now(); if(now - lastSensitive < RATE_WINDOW_MS){ Alert.alert('Please Wait','Try again in a few seconds.'); return false; } lastSensitive = now; return true; }

  const handleChangePassword = async () => {
    if(!rateGate()) return;
    if(changingPass) return;
    if(!currentPass || !newPass){ Alert.alert('Password','Fill all fields.'); return; }
    if(newPass !== confirmPass){ Alert.alert('Password','New passwords do not match.'); return; }
    if(newPass.length < 6){ Alert.alert('Password','New password must be at least 6 chars.'); return; }
    if(pwScore > -1 && pwScore < 2){ Alert.alert('Password','Choose a stronger password (aim for at least Fair).'); return; }
    const user = auth.currentUser; if(!user){ Alert.alert('Auth','Not signed in.'); return; }
    try {
      setChangingPass(true);
      const cred = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPass);
      setCurrentPass(''); setNewPass(''); setConfirmPass(''); setShowChangePass(false);
      setPwScore(-1); setPwFeedback('');
      Alert.alert('Success','Password updated.');
    } catch (e) { Alert.alert('Change Failed', e.message); }
    finally { setChangingPass(false); }
  };

  // ===== Delete Account =====
  const handleDeleteAccount = async () => {
    if(deletingAcct) return;
    const user = auth.currentUser; if(!user){ Alert.alert('Auth','Not signed in.'); return; }
    Alert.alert('Confirm Delete','This will permanently delete your account and profile. Continue?',[
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async ()=>{
          try {
            setDeletingAcct(true);
            if(canEmailPassword()){
              if(!delPass){ Alert.alert('Delete','Enter password to confirm.'); setDeletingAcct(false); return; }
              const cred = EmailAuthProvider.credential(user.email, delPass);
              await reauthenticateWithCredential(user, cred);
            }
            try { await deleteUserProfile(); } catch {}
            await deleteUser(user);
            setDelPass('');
            router.replace('/signup');
          } catch(e){ Alert.alert('Delete Failed', e.message); }
          finally { setDeletingAcct(false); }
        } }
    ]);
  };

  // ===== Consent Handling =====
  const acceptTermsNow = async () => { try { const version = 1; const ts = new Date().toISOString(); await updateUserProfile({ termsAcceptedVersion: version, privacyAcceptedAt: ts }); setTermsAcceptedVersion(version); setPrivacyAcceptedAt(ts); Alert.alert('Consent','Terms accepted.'); } catch(e){ Alert.alert('Error', e.message); } };

  const consentItems = termsAcceptedVersion ? [ { key:'termsInfo', type:'note', text:`Terms v${termsAcceptedVersion} accepted ${new Date(privacyAcceptedAt||'').toLocaleString()}` } ] : [ { key:'acceptTerms', type:'action', label:'Accept Terms & Privacy', onPress: acceptTermsNow, variant:'secondary' } ];

  // ===== SectionList Data =====
  const escrowSection = { title:'Key Escrow', data: [ { key:'escrowInfo', type:'note', text:'Create a passphrase-protected backup of your local encryption key for multi-device use.' }, { key:'escrowExpand', type:'expand', label: showKeyEscrow? 'Hide Key Escrow':'Manage Key Escrow', onToggle: ()=> setShowKeyEscrow(p=>!p), expanded: showKeyEscrow, content:'escrow' } ] };

  const sections = [
    !emailVerified ? {
      title: 'Email Verification Required',
      data: [
        { key:'verifyNote', type:'note', text:'Your email is not yet verified. Some security actions may be limited until verification.' },
        { key:'resendVerify', type:'action', label: sendingVerify? 'Sending...' : 'Resend Verification Email', disabled: sendingVerify, onPress: resendVerification },
        { key:'refreshVerify', type:'action', label: refreshingVerify? 'Checking...' : 'I Have Verified – Refresh', disabled: refreshingVerify, onPress: refreshVerificationStatus }
      ]
    } : null,
    {
      title: 'Account',
      data: [
        { key:'pushDebug', type:'action', label:'Debug: Register Push Tokens', variant:'secondary', onPress: async()=>{
            try {
              const user = auth.currentUser;
              if(!user){ Alert.alert('Push Tokens','Not signed in.'); return; }
              const res = await registerPushTokens({ force:true });
              let saved = null;
              try {
                const ref = doc(db, 'users', user.uid, 'private', 'push');
                const snap = await getDoc(ref);
                saved = snap.exists() ? snap.data() : null;
              } catch {}
              const fcm = res?.fcmToken || saved?.fcmToken || 'none';
              const expo = res?.expoToken || saved?.expoPushToken || 'none';
              const savedStr = saved ? 'yes' : 'no';
              Alert.alert('Push Tokens', `FCM: ${fcm}\nExpo: ${expo}\nSaved in Firestore: ${savedStr}`);
            } catch(e){ Alert.alert('Push Tokens', e?.message || String(e)); }
        } },
        { key:'signout', type:'action', label:'Sign Out', onPress: logout, variant:'secondary' },
        { key:'signoutAll', type:'action', label:'Sign Out All Devices', onPress: async()=>{ try { await bumpSessionEpoch(); Alert.alert('Sessions','All devices will be signed out shortly.'); } catch(e){ Alert.alert('Error', e.message); } }, variant:'secondary' },
        { key:'resetOnboard', type:'action', label:'Reset Onboarding', onPress: resetOnboarding }
      ]
    },
    {
      title: 'Profile',
      data: [
        { key:'displayName', type:'input', label:'Display Name', value: displayName, setter: setDisplayName },
        { key:'avatar', type:'avatar' },
        { key:'saveProfile', type:'action', label: savingProfile? 'Saving...' : 'Save Profile', disabled: savingProfile, onPress: async()=>{
            if(savingProfile) return; setSavingProfile(true);
            try { await updateUserProfile({ displayName, avatarB64 }); Alert.alert('Profile','Saved'); }
            catch(e){ Alert.alert('Profile','Save failed: '+e.message); }
            finally{ setSavingProfile(false); }
        }, variant:'secondary' }
      ]
    },
    {
      title: 'Security',
      data: canEmailPassword() ? [
        { key:'changePass', type:'expand', label: showChangePass? 'Cancel Change Password':'Change Password', onToggle: ()=> setShowChangePass(p=>!p), expanded: showChangePass, content:'changePass' },
        { key:'deleteAcct', type:'expand', label: showDeleteAcct? 'Cancel Delete Account':'Delete Account', danger:true, onToggle: ()=> setShowDeleteAcct(p=>!p), expanded: showDeleteAcct, content:'deleteAcct' }
      ] : [ { key:'noPass', type:'note', text:'Password & account management unavailable for this sign-in method.' } ]
    },
    {
      title: 'Player Preferences',
      data: [ { key:'playerPrefs', type:'playerPrefs' } ]
    },
    {
      title: 'Reminders',
      data: [ { key:'reminders', type:'reminders' } ]
    },
    {
      title: 'Notification Preferences',
      data: [
        { key:'notifyMentions', type:'toggle', label:'Mentions', value: notifPrefs.notifyMentions, onValueChange: v=> updateNotifPref('notifyMentions', v) },
        { key:'notifyReplies', type:'toggle', label:'Replies', value: notifPrefs.notifyReplies, onValueChange: v=> updateNotifPref('notifyReplies', v) },
        { key:'notifyMilestones', type:'toggle', label:'Challenge Milestones', value: notifPrefs.notifyMilestones, onValueChange: v=> updateNotifPref('notifyMilestones', v) },
        { key:'notifyBadges', type:'toggle', label:'Badges Earned', value: notifPrefs.notifyBadges, onValueChange: v=> updateNotifPref('notifyBadges', v) }
      ]
    },
    {
      title: 'Privacy & Data',
      data: [
        { key:'localOnly', type:'toggle', label:'Local-Only Mode', value: localOnly, onValueChange: toggleLocalOnly },
        { key:'biometric', type:'toggle', label:'Biometric Unlock', value: biometricPref, onValueChange: toggleBiometric },
        { key:'haptics', type:'toggle', label:'Haptics', value: hapticsEnabled, onValueChange: toggleHaptics },
  { key:'darkMode', type:'toggle', label:'Dark Mode', value: mode==='dark', onValueChange: async(val)=>{ const next = val? 'dark':'light'; setThemeModeLocal(next); try { await setThemeMode(next); } catch {} try { await updateUserProfile({ themeMode: next }); } catch {} } },
        { key:'analyticsOptOut', type:'toggle', label:'Analytics Opt-Out', value: analyticsOptOut, onValueChange: async(val)=>{ setAnalyticsOptOut(val); try { await updateUserProfile({ analyticsOptOut: val }); } catch {} } },
        { key:'autoLock', type:'choices', label:'Auto-Lock', value:autoLock }
      ].concat(lastRemoteWipe ? [{ key:'lastWipe', type:'note', text:`Last Remote Wipe: ${new Date(lastRemoteWipe).toLocaleString()}` }] : [])
    },
    {
      title: 'Encryption',
      data: [
        { key:'encStatus', type:'note', text:`${encStatus.passphraseProtected? 'Passphrase-protected key' : 'Device key stored in secure storage'} • ${encStatus.algorithm}` },
        { key:'encManage', type:'expand', label: encExpanded? 'Hide Encryption':'Manage Encryption', onToggle: ()=> setEncExpanded(p=>!p), expanded: encExpanded, content:'encryption' }
      ]
    },
    cfg.allowExports ? {
      title: 'Data Management',
      data: [
        { key:'export', type:'action', label: exporting? 'Exporting...' : 'Export Data', disabled: exporting, onPress: ()=>{ if(exporting) return; Alert.alert('Export Format','Choose a format to export your mood entries.',[ { text:'JSON', onPress:()=>doExport('json') }, { text:'CSV', onPress:()=>doExport('csv') }, { text:'Markdown', onPress:()=>doExport('md') }, { text:'Cancel', style:'cancel' } ]);} },
        { key:'exportRange', type:'expand', label: rangeExporting? 'Exporting...' : 'Export Date Range', onToggle: ()=>{}, expanded: true, content:'exportRange' },
        ...(cfg.allowBackfillTools ? [{ key:'backfillMood', type:'action', label:'Backfill Mood Scores (90d)', onPress: async()=>{
            try { const res = await backfillMoodScores({ days: 90 });
              Alert.alert('Backfill Complete', `Updated ${res.updated} of ${res.scanned} entries in last ${res.days} days.`);
            } catch(e){ Alert.alert('Backfill Error', e.message); }
          }, variant:'secondary' }]:[]),
        { key:'delAll', type:'action', label:'Delete All Data', danger:true, onPress: confirmDeleteAll }
      ]
    } : null,
    cfg.allowRetention ? {
      title: 'Retention & Deletion',
      data: [
        { key:'retDesc', type:'note', text:'Auto-delete entries older than N days. Set to 0 to disable.' },
        { key:'retention', type:'retention' },
        { key:'manualPurge', type:'action', label: purging? 'Purging...' : 'Purge Old Entries Now', onPress: confirmManualPurge, danger:true }
      ]
    } : null,
    escrowSection,
    { title:'Consent', data: consentItems }
  ].filter(Boolean);

  const renderItem = ({ item }) => {
    if(item.type === 'playerPrefs'){
      return (
        <View style={styles.itemRow}>
          <View style={styles.rowBetweenMul}>
            <Text style={styles.label}>Default background</Text>
            <View style={styles.inlineOptions}>
              {['none','rain','ocean'].map(opt => (
                <TouchableOpacity key={opt} onPress={()=> saveDefaultBg(opt)} style={[styles.intervalChip, prefDefaultBg===opt && styles.intervalChipActive]} accessibilityRole='button' accessibilityState={{ selected: prefDefaultBg===opt }} accessibilityLabel={`Default background ${opt}`}>
                  <Text style={[styles.intervalChipText, prefDefaultBg===opt && styles.intervalChipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Autoplay last selection</Text>
            <Switch value={!!prefAutoplayLast} onValueChange={saveAutoplayLast} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Keep screen awake</Text>
            <Switch value={!!prefKeepAwake} onValueChange={saveKeepAwake} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Auto-pause on call</Text>
            <Switch value={!!prefAutoPauseOnCall} onValueChange={saveAutoPauseOnCall} />
          </View>
        </View>
      );
    }
    if(item.type === 'reminders'){
      const currentQuiet = quiet.start ? `${quiet.start}-${quiet.end}` : 'Off';
      return (
        <View style={styles.itemRow}>
          <View style={styles.rowBetweenMul}>
            <Text style={styles.label}>Daily reminder</Text>
            <View style={styles.inlineOptions}>
              {['07:00','12:00','20:00',''].map(t => (
                <TouchableOpacity key={t||'Off'} onPress={()=> saveDailyTime(t)} style={[styles.intervalChip, (dailyTime===t) && styles.intervalChipActive]} accessibilityRole='button' accessibilityState={{ selected: dailyTime===t }} accessibilityLabel={`Daily reminder ${t||'Off'}`}>
                  <Text style={[styles.intervalChipText, (dailyTime===t) && styles.intervalChipTextActive]}>{t||'Off'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={[styles.rowBetweenMul, { marginTop:8 }]}>
            <Text style={styles.label}>Quiet hours</Text>
            <View style={styles.inlineOptions}>
              {['22:00-07:00','21:00-06:00','Off'].map(opt => (
                <TouchableOpacity key={opt} onPress={()=> { if(opt==='Off') saveQuiet('',''); else { const [s,e]=opt.split('-'); saveQuiet(s,e); } }} style={[styles.intervalChip, (currentQuiet===opt) && styles.intervalChipActive]} accessibilityRole='button' accessibilityState={{ selected: currentQuiet===opt }} accessibilityLabel={`Quiet hours ${opt}`}>
                  <Text style={[styles.intervalChipText, (currentQuiet===opt) && styles.intervalChipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={[styles.rowBetweenMul, { marginTop:8 }]}>
            <Text style={styles.label}>Weekly digest</Text>
            <View style={styles.inlineOptions}>
              {['On','Off'].map(opt => {
                const selected = (weeklyDigestEnabled && opt==='On') || (!weeklyDigestEnabled && opt==='Off');
                return (
                  <TouchableOpacity key={opt} disabled={weeklyDigestLoading} onPress={async ()=> {
                    if(weeklyDigestLoading) return;
                    if(opt==='On' && !weeklyDigestEnabled){
                      await toggleWeeklyDigest();
                      try { const { inboxAdd } = await import('../src/services/inbox'); await inboxAdd({ type:'digest', title:'Weekly digest enabled', body:'You will receive a summary every Sunday at 6pm.' }); } catch {}
                    } else if(opt==='Off' && weeklyDigestEnabled) {
                      await toggleWeeklyDigest();
                    }
                  }} style={[styles.intervalChip, selected && styles.intervalChipActive, weeklyDigestLoading && { opacity:0.6 }]} accessibilityRole='button' accessibilityState={{ selected, disabled: weeklyDigestLoading }} accessibilityLabel={`Weekly digest ${opt}`}>
                    <Text style={[styles.intervalChipText, selected && styles.intervalChipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <Text style={styles.noteText}>Reminders respect your device focus settings. Quiet hours are stored for future goal nudges.</Text>
        </View>
      );
    }
    if(item.type === 'retention'){
      return (
        <View style={styles.itemRow}>
          <View style={styles.rowBetweenMul}>
            <Text style={styles.label}>Retention (days)</Text>
            <View style={styles.inlineOptions}>
              {[0, 7, 14, 30, 60, 90].map(d => (
                <TouchableOpacity key={d} onPress={()=> updateRetention(d)} style={[styles.intervalChip, retentionDays===d && styles.intervalChipActive]} accessibilityLabel={`Retention ${d} days`} accessibilityState={{ selected: retentionDays===d }} accessibilityRole='button'>
                  <Text style={[styles.intervalChipText, retentionDays===d && styles.intervalChipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={styles.noteText}>{retentionDays>0? `Entries older than ${retentionDays} days will be auto‑deleted.` : 'Auto‑purge is disabled.'}</Text>
        </View>
      );
    }
    if(item.type === 'action'){
      return (
        <View style={styles.itemRow}>
          <PrimaryButton accessibilityLabel={`Action: ${item.label}`} title={item.label} onPress={item.onPress} disabled={item.disabled} fullWidth variant={item.danger? 'danger': (item.variant||'primary')} />
        </View>
      );
    }
    if(item.type === 'input'){
      return (
        <View style={styles.itemRow}>
          <Text style={styles.subLabel}>{item.label}</Text>
          <Input value={item.value} onChangeText={item.setter} placeholder="Your name" />
        </View>
      );
    }
    if(item.type === 'avatar'){
      return (
        <View style={[styles.itemRow, { flexDirection:'row', alignItems:'center' }] }>
          <TouchableOpacity onPress={async()=>{
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if(perm.status !== 'granted'){ Alert.alert('Permission','Media library permission needed.'); return; }
            const pickerOpts = { quality:0.6, base64:true, aspect:[1,1] };
            try {
              const mt = (ImagePicker && ImagePicker.MediaType && ImagePicker.MediaType.Images) || (ImagePicker && ImagePicker.MediaTypeOptions && ImagePicker.MediaTypeOptions.Images);
              if (mt) pickerOpts.mediaTypes = mt;
            } catch {}
            const res = await ImagePicker.launchImageLibraryAsync(pickerOpts);
            if(!res.canceled && res.assets?.length){
              const asset = res.assets[0];
              if(asset.base64){
                const b64 = `data:${asset.mimeType||'image/jpeg'};base64,${asset.base64}`;
                setAvatarB64(b64);
                try { await updateUserProfile({ avatarB64:b64 }); } catch {}
              }
            }
          }}>
            {avatarB64 ? (
              <Image source={{ uri: avatarB64 }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}><Text style={styles.avatarPlaceholderTxt}>{(displayName||'U').slice(0,1).toUpperCase()}</Text></View>
            )}
          </TouchableOpacity>
          <Text style={[styles.subLabel, { marginLeft:12, marginBottom:0 }]}>Tap avatar to change</Text>
        </View>
      );
    }
    if(item.type === 'toggle'){
      return (
        <View style={[styles.itemRow, styles.rowBetween]}>
          <Text style={styles.label}>{item.label}</Text>
          <Switch accessibilityLabel={`Toggle ${item.label}`} accessibilityHint={item.value? 'On. Double tap to turn off.' : 'Off. Double tap to turn on.'} value={item.value} onValueChange={item.onValueChange} />
        </View>
      );
    }
    if(item.type === 'choices'){
      return (
        <View style={[styles.itemRow]}>
          <View style={styles.rowBetweenMul}>
            <Text style={styles.label}>{item.label}</Text>
            <View style={styles.inlineOptions}>
              {INTERVAL_OPTIONS.map(opt => (
                <TouchableOpacity key={opt} style={[styles.intervalChip, autoLock===opt && styles.intervalChipActive]} onPress={()=>changeAutoLock(opt)} accessibilityLabel={`Auto lock ${formatInterval(opt)}`} accessibilityState={{ selected: autoLock===opt }} accessibilityRole='button'>
                  <Text style={[styles.intervalChipText, autoLock===opt && styles.intervalChipTextActive]}>{formatInterval(opt)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
    }
    if(item.type === 'note'){
      return <View style={styles.itemRow}><Text style={styles.noteText}>{item.text}</Text></View>;
    }
    if(item.type === 'expand'){
      return (
        <View style={styles.itemRow}>
          <PrimaryButton title={item.label} onPress={item.onToggle} fullWidth variant={item.danger? 'danger':'secondary'} />
          {item.expanded && item.content === 'changePass' && (
            <View style={styles.boxInner}>
              <Text style={styles.subLabel}>Current Password</Text>
              <Input value={currentPass} onChangeText={setCurrentPass} secureTextEntry />
              <Text style={styles.subLabel}>New Password</Text>
              <Input value={newPass} onChangeText={setNewPass} secureTextEntry />
              {pwScore > -1 && (
                <View style={styles.pwMeterWrapper}>
                  <View style={styles.pwBarRow}>
                    {[0,1,2,3,4].map(i => (
                      <View key={i} style={[styles.pwSeg, i <= pwScore && { backgroundColor: styles._pwColors[i] }]} />
                    ))}
                  </View>
                  <Text style={[styles.pwFeedback, pwScore < 2 && { color:'#D32F2F' }]}>{pwFeedback}</Text>
                </View>
              )}
              <Text style={styles.subLabel}>Confirm New Password</Text>
              <Input value={confirmPass} onChangeText={setConfirmPass} secureTextEntry />
              <PrimaryButton title={changingPass? 'Updating...' : 'Update Password'} disabled={changingPass} onPress={handleChangePassword} fullWidth />
            </View>
          )}
          {item.expanded && item.content === 'exportRange' && (
            <View style={styles.boxInner}>
              {Platform.OS === 'android' && (
                <>
                  <Text style={styles.noteText}>{FileSystem.StorageAccessFramework ? (androidDirUri ? 'Saving to your chosen folder.' : 'Tip: On first save, pick your Downloads folder to remember it.') : 'Folder picker not available in this environment. Files will be saved to cache and shared.'}</Text>
                  {FileSystem.StorageAccessFramework && (
                    <>
                      <View style={{ height:6 }} />
                      <PrimaryButton title='Change Export Folder' onPress={rePickAndroidFolder} variant='secondary' fullWidth />
                    </>
                  )}
                </>
              )}
              <View style={[styles.rowBetween, { marginTop:8 }]}>
                <View style={{ flex:1, marginRight:8 }}>
                  <Text style={styles.subLabel}>Start Date</Text>
                  {Platform.OS === 'ios' ? (
                    <DateTimePicker mode='date' display='inline' value={rangeStart || new Date()} onChange={(e, d)=>{ if(d){ setRangeStart(new Date(d.getFullYear(), d.getMonth(), d.getDate())); } }} />
                  ) : (
                    <PrimaryButton title={rangeStart? rangeStart.toDateString() : 'Pick Start'} onPress={()=>beginPickDate('start')} variant='secondary' fullWidth />
                  )}
                </View>
                <View style={{ flex:1, marginLeft:8 }}>
                  <Text style={styles.subLabel}>End Date</Text>
                  {Platform.OS === 'ios' ? (
                    <DateTimePicker mode='date' display='inline' value={rangeEnd || new Date()} onChange={(e, d)=>{ if(d){ setRangeEnd(new Date(d.getFullYear(), d.getMonth(), d.getDate())); } }} />
                  ) : (
                    <PrimaryButton title={rangeEnd? rangeEnd.toDateString() : 'Pick End'} onPress={()=>beginPickDate('end')} variant='secondary' fullWidth />
                  )}
                </View>
              </View>
              {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker mode='date' display='calendar' value={new Date()} onChange={onDatePicked} />
              )}
              <View style={{ height:8 }} />
              <View style={styles.rowBetween}>
                <PrimaryButton title='Export JSON' onPress={()=>doRangeExport('json')} disabled={rangeExporting || !rangeStart || !rangeEnd} fullWidth />
              </View>
              <View style={{ height:8 }} />
              <View style={styles.rowBetween}>
                <PrimaryButton title='Export CSV' onPress={()=>doRangeExport('csv')} disabled={rangeExporting || !rangeStart || !rangeEnd} fullWidth variant='secondary' />
              </View>
              <View style={{ height:8 }} />
              <View style={styles.rowBetween}>
                <PrimaryButton title='Export Markdown' onPress={()=>doRangeExport('md')} disabled={rangeExporting || !rangeStart || !rangeEnd} fullWidth variant='secondary' />
              </View>
            </View>
          )}
          {item.expanded && item.content === 'deleteAcct' && (
            <View style={styles.boxInner}>
              {canEmailPassword() && (
                <>
                  <Text style={styles.subLabel}>Password (for confirmation)</Text>
                  <Input value={delPass} onChangeText={setDelPass} secureTextEntry />
                </>
              )}
              <PrimaryButton title={deletingAcct? 'Deleting...' : 'Confirm Delete'} disabled={deletingAcct} onPress={handleDeleteAccount} fullWidth variant='danger' />
            </View>
          )}
          {item.expanded && item.content === 'escrow' && (
            <View style={styles.boxInner}>
              <Text style={styles.subLabel}>Create / Update Escrow</Text>
              <View style={styles.passwordRow}>
                <Input value={passphrase} onChangeText={setPassphrase} placeholder='New passphrase' secureTextEntry={!showPassphrase} style={{ paddingRight:44 }} />
                <TouchableOpacity accessibilityLabel={(showPassphrase? 'Hide':'Show')+ ' passphrase'} onPress={()=>setShowPassphrase(p=>!p)} style={styles.visToggle}>
                  <Text style={styles.visIcon}>{showPassphrase? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.passwordRow}>
                <Input value={confirmPassphrase} onChangeText={setConfirmPassphrase} placeholder='Confirm passphrase' secureTextEntry={!showConfirmPassphrase} style={{ paddingRight:44 }} />
                <TouchableOpacity accessibilityLabel={(showConfirmPassphrase? 'Hide':'Show')+ ' confirm passphrase'} onPress={()=>setShowConfirmPassphrase(p=>!p)} style={styles.visToggle}>
                  <Text style={styles.visIcon}>{showConfirmPassphrase? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
                <PrimaryButton accessibilityLabel='Store key escrow passphrase' title={escrowing? 'Saving...' : 'Store Escrow'} onPress={handleCreateEscrow} disabled={escrowing} fullWidth />
                <View style={{ height:8 }} />
                <PrimaryButton accessibilityLabel='Export key escrow JSON' title='Export Escrow JSON' variant='secondary' onPress={handleExportEscrow} fullWidth />
                <View style={{ height:16 }} />
                <Text style={styles.subLabel}>Import Escrow</Text>
                <Input value={importData} onChangeText={setImportData} placeholder='Paste escrow JSON here' multiline style={{ height:100, textAlignVertical:'top' }} />
                <View style={styles.passwordRow}>
                  <Input value={importPassphrase} onChangeText={setImportPassphrase} placeholder='Passphrase' secureTextEntry={!showImportPassphrase} style={{ paddingRight:44 }} />
                  <TouchableOpacity accessibilityLabel={(showImportPassphrase? 'Hide':'Show')+ ' import passphrase'} onPress={()=>setShowImportPassphrase(p=>!p)} style={styles.visToggle}>
                    <Text style={styles.visIcon}>{showImportPassphrase? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
                <PrimaryButton accessibilityLabel='Test import key escrow JSON' title={importing? 'Importing...' : 'Test Import'} onPress={handleImportEscrow} disabled={importing} fullWidth />
            </View>
          )}
          {item.expanded && item.content === 'encryption' && (
            <View style={styles.boxInner}>
              {!encStatus.passphraseProtected ? (
                <>
                  <Text style={styles.subLabel}>Enable Passphrase Protection</Text>
                  <View style={styles.passwordRow}>
                    <Input value={encPass} onChangeText={setEncPass} placeholder='Passphrase (min 6 chars)' secureTextEntry={!showEncPass} style={{ paddingRight:44 }} />
                    <TouchableOpacity accessibilityLabel={(showEncPass? 'Hide':'Show')+ ' passphrase'} onPress={()=>setShowEncPass(p=>!p)} style={styles.visToggle}>
                      <Text style={styles.visIcon}>{showEncPass? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.passwordRow}>
                    <Input value={encPass2} onChangeText={setEncPass2} placeholder='Confirm passphrase' secureTextEntry={!showEncPass2} style={{ paddingRight:44 }} />
                    <TouchableOpacity accessibilityLabel={(showEncPass2? 'Hide':'Show')+ ' confirm passphrase'} onPress={()=>setShowEncPass2(p=>!p)} style={styles.visToggle}>
                      <Text style={styles.visIcon}>{showEncPass2? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                  <PrimaryButton title={busyEnc? 'Enabling...' : 'Enable Passphrase Protection'} disabled={busyEnc} onPress={async()=>{
                    if(busyEnc) return; if(!encPass || encPass!==encPass2){ Alert.alert('Encryption','Enter matching passphrases.'); return; }
                    if(encPass.length < 6){ Alert.alert('Encryption','Passphrase must be at least 6 characters.'); return; }
                    try { setBusyEnc(true); await enablePassphraseProtection(encPass); setEncPass(''); setEncPass2(''); const st = await getEncryptionStatus(); setEncStatus(st); Alert.alert('Encryption','Passphrase protection enabled. Keep your passphrase safe.'); } catch(e){ Alert.alert('Enable Failed', e.message); } finally { setBusyEnc(false); }
                  }} fullWidth />
                </>
              ) : (
                <>
                  <Text style={styles.subLabel}>Unlock for This Session</Text>
                  <View style={styles.passwordRow}>
                    <Input value={unlockPass} onChangeText={setUnlockPass} placeholder='Passphrase' secureTextEntry={!showUnlockPass} style={{ paddingRight:44 }} />
                    <TouchableOpacity accessibilityLabel={(showUnlockPass? 'Hide':'Show')+ ' unlock passphrase'} onPress={()=>setShowUnlockPass(p=>!p)} style={styles.visToggle}>
                      <Text style={styles.visIcon}>{showUnlockPass? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                  <PrimaryButton title={busyEnc? 'Unlocking...' : 'Unlock'} disabled={busyEnc} onPress={async()=>{
                    if(busyEnc) return; if(!unlockPass){ Alert.alert('Encryption','Enter your passphrase.'); return; }
                    try { setBusyEnc(true); await unlockWithPassphrase(unlockPass); setUnlockPass(''); Alert.alert('Unlocked','Encryption key unlocked for this session.'); } catch(e){ Alert.alert('Unlock Failed', e.message); } finally { setBusyEnc(false); }
                  }} fullWidth variant='secondary' />
                  <View style={{ height:8 }} />
                  <PrimaryButton title={busyEnc? 'Disabling...' : 'Disable Passphrase Protection'} disabled={busyEnc} onPress={async()=>{
                    if(busyEnc) return; try { setBusyEnc(true); await disablePassphraseProtection(); const st = await getEncryptionStatus(); setEncStatus(st); Alert.alert('Encryption','Passphrase protection disabled.'); } catch(e){ Alert.alert('Disable Failed', e.message); } finally { setBusyEnc(false); }
                  }} fullWidth variant='danger' />
                  <View style={{ height:8 }} />
                  <PrimaryButton title='Lock Now' onPress={()=>{ try { lockEncryptionKey(); Alert.alert('Locked','Key cleared from memory.'); } catch{} }} fullWidth variant='secondary' />
                </>
              )}
              <View style={{ height:16 }} />
              <Text style={styles.subLabel}>Legacy Migration</Text>
              {migrateResult && (
                <Text style={styles.noteText}>{`Total:${migrateResult.total} Legacy:${migrateResult.legacyFound} Migrated:${migrateResult.migrated} Failed:${migrateResult.failed} ${migrateResult.dryRun? '(dry run)':''}`}</Text>
              )}
              <View style={{ height:8 }} />
              <PrimaryButton title='Dry Run: Detect Legacy' variant='secondary' onPress={async()=>{ try { const res = await migrateLegacyToV2({ dryRun:true }); setMigrateResult(res); Alert.alert('Dry Run Complete', `Found ${res.legacyFound} legacy entries.`); } catch(e){ Alert.alert('Migration Error', e.message); } }} fullWidth />
              <View style={{ height:8 }} />
              <PrimaryButton title='Run Migration' onPress={async()=>{ try { const res = await migrateLegacyToV2({ dryRun:false }); setMigrateResult(res); Alert.alert('Migration Complete', `Migrated ${res.migrated} entries (${res.failed} failed).`); } catch(e){ Alert.alert('Migration Error', e.message); } }} fullWidth />
            </View>
          )}
        </View>
      );
    }
    return null;
  };

  useEffect(()=>{
    const t = setTimeout(()=>{
      InteractionManager.runAfterInteractions(()=>{
        AccessibilityInfo.isScreenReaderEnabled().then((enabled)=>{
          if(!enabled) return;
          try {
            const tag = findNodeHandle(titleRef.current);
            if(tag) AccessibilityInfo.setAccessibilityFocus?.(tag);
          } catch {}
          AccessibilityInfo.announceForAccessibility('Settings. Manage account, privacy, and encryption.');
        }).catch(()=>{});
      });
    }, 400);
    return ()=> clearTimeout(t);
  },[]);

  return (
    <SafeAreaView style={styles.container}>
      <Text ref={titleRef} style={styles.title} accessibilityRole='header' accessibilityLabel='Settings'>Settings</Text>
      <SectionList
        sections={sections}
        keyExtractor={(item)=> item.key}
        renderItem={renderItem}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.stickyHeader}><Text accessibilityRole='header' style={styles.sectionHeading}>{title}</Text></View>
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={()=> <View style={styles.itemSeparator} />}
        SectionSeparatorComponent={()=> <View style={{ height: spacing.sm }} />}
        ListFooterComponent={<View style={{ height: 80 }} />}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex:1, backgroundColor: colors.bg },
  scrollContent:{ padding: spacing.lg, paddingBottom: spacing.lg },
  listContent:{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  title:{ fontSize:28, fontWeight:'800', color: colors.text, marginBottom: spacing.md, textAlign:'center' },
  sectionBox:{ backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadow.card },
  stickyHeader:{ backgroundColor: colors.bg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  itemRow:{ backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.card },
  itemSeparator:{ height: spacing.xs },
  sectionHeading:{ fontSize:16, fontWeight:'700', color: colors.text, marginBottom: spacing.sm },
  subLabel:{ fontSize:12, fontWeight:'600', color: colors.textMuted, marginBottom:4 },
  boxInner:{ marginTop: spacing.sm },
  noteText:{ fontSize:12, color: colors.textMuted, marginTop:4 },
  rowBetween:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop: spacing.xs },
  rowBetweenMul:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop: spacing.sm },
  label:{ fontSize:14, fontWeight:'600', color: colors.text },
  inlineOptions:{ flexDirection:'row', flexWrap:'wrap', justifyContent:'flex-end', maxWidth:'60%' },
  intervalChip:{ paddingHorizontal:10, paddingVertical:6, borderRadius:20, backgroundColor: colors.bg === '#0B1722' ? '#182635' : '#eef2f5', marginLeft:6, marginTop:4 },
  intervalChipActive:{ backgroundColor: colors.primary },
  intervalChipText:{ fontSize:12, fontWeight:'600', color: colors.text },
  intervalChipTextActive:{ color: colors.primaryContrast },
  avatar:{ width:72, height:72, borderRadius:36, backgroundColor:'#90CAF9', borderWidth:2, borderColor: colors.card },
  avatarPlaceholder:{ alignItems:'center', justifyContent:'center' },
  avatarPlaceholderTxt:{ fontSize:28, fontWeight:'700', color: colors.primaryContrast },
  avatarRow:{ flexDirection:'row', alignItems:'center', marginBottom: spacing.sm },
  pwMeterWrapper:{ marginBottom: spacing.sm },
  pwBarRow:{ flexDirection:'row', height:8, marginTop:4, marginBottom:6 },
  pwSeg:{ flex:1, marginRight:4, backgroundColor: colors.bg === '#0B1722' ? '#1f3347' : '#ECEFF1', borderRadius:4 },
  pwFeedback:{ fontSize:11, fontWeight:'600', color:'#388E3C' },
  _pwColors:['#D32F2F','#F57C00','#FBC02D','#7CB342','#2E7D32'],
  passwordRow:{ position:'relative', marginBottom:8 },
  visToggle:{ position:'absolute', right:10, top:10, padding:4 },
  visIcon:{ fontSize:18, color: colors.textMuted }
});

// Simple inline Input component to avoid extra imports
import { TextInput } from 'react-native';
const Input = (props) => (<TextInput {...props} style={[{ width:'100%', borderWidth:1, borderColor:'#90CAF9', borderRadius:12, paddingHorizontal:10, height:44, marginBottom:8, backgroundColor:'#ffffffCC' }, props.style]} />);
