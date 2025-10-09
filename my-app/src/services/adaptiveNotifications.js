// Adaptive notifications: schedules local reminders based on engagement and preferences.
// Works with expo-notifications in a development build (Expo Go Android has limitations).

import AsyncStorage from '@react-native-async-storage/async-storage';

const NS = 'notif_';
const K = {
  enabled: NS + 'adaptive_enabled_v1',
  baseHour: NS + 'base_hour_v1',
  baseMinute: NS + 'base_minute_v1',
  quietStart: NS + 'quiet_start_v1', // HH:mm (24h)
  quietEnd: NS + 'quiet_end_v1',     // HH:mm
  cooldownMin: NS + 'cooldown_min_v1',
  lastCompletedTs: NS + 'last_completed_ts_v1',
  lastSentTs: NS + 'last_sent_ts_v1',
  snoozeMin: NS + 'snooze_min_v1',
  backupEnabled: NS + 'backup_enabled_v1',
  backupHour: NS + 'backup_hour_v1',
  backupMinute: NS + 'backup_minute_v1',
};

function parseHHMM(s){
  if(!s || typeof s !== 'string') return { h: 22, m: 0 };
  const [hh, mm] = s.split(':').map(n=>parseInt(n,10));
  const h = Number.isFinite(hh)? ((hh%24)+24)%24 : 22;
  const m = Number.isFinite(mm)? ((mm%60)+60)%60 : 0;
  return { h, m };
}

export async function getAdaptiveSettings(){
  const [enabled, baseHour, baseMinute, quietStart, quietEnd, cooldownMin, snoozeMin, backupEnabled, backupHour, backupMinute] = await Promise.all([
    AsyncStorage.getItem(K.enabled),
    AsyncStorage.getItem(K.baseHour),
    AsyncStorage.getItem(K.baseMinute),
    AsyncStorage.getItem(K.quietStart),
    AsyncStorage.getItem(K.quietEnd),
    AsyncStorage.getItem(K.cooldownMin),
    AsyncStorage.getItem(K.snoozeMin),
    AsyncStorage.getItem(K.backupEnabled),
    AsyncStorage.getItem(K.backupHour),
    AsyncStorage.getItem(K.backupMinute),
  ]);
  return {
    enabled: enabled !== '0',
    baseHour: Number(baseHour ?? 8),
    baseMinute: Number(baseMinute ?? 0),
    quietStart: quietStart || '22:00',
    quietEnd: quietEnd || '07:00',
    cooldownMin: Number(cooldownMin ?? 120),
    snoozeMin: Number(snoozeMin ?? 60),
    backupEnabled: backupEnabled !== '0',
    backupHour: Number(backupHour ?? 15),
    backupMinute: Number(backupMinute ?? 0),
  };
}

export async function setAdaptiveSettings(patch){
  const entries = [];
  if('enabled' in patch) entries.push([K.enabled, patch.enabled ? '1' : '0']);
  if('baseHour' in patch) entries.push([K.baseHour, String(patch.baseHour)]);
  if('baseMinute' in patch) entries.push([K.baseMinute, String(patch.baseMinute)]);
  if('quietStart' in patch) entries.push([K.quietStart, String(patch.quietStart)]);
  if('quietEnd' in patch) entries.push([K.quietEnd, String(patch.quietEnd)]);
  if('cooldownMin' in patch) entries.push([K.cooldownMin, String(patch.cooldownMin)]);
  if('snoozeMin' in patch) entries.push([K.snoozeMin, String(patch.snoozeMin)]);
  if('backupEnabled' in patch) entries.push([K.backupEnabled, patch.backupEnabled ? '1' : '0']);
  if('backupHour' in patch) entries.push([K.backupHour, String(patch.backupHour)]);
  if('backupMinute' in patch) entries.push([K.backupMinute, String(patch.backupMinute)]);
  await AsyncStorage.multiSet(entries);
}

function isWithinQuietHours(now, startHHMM, endHHMM){
  const { h: sh, m: sm } = parseHHMM(startHHMM);
  const { h: eh, m: em } = parseHHMM(endHHMM);
  const n = now.getHours()*60 + now.getMinutes();
  const s = sh*60 + sm;
  const e = eh*60 + em;
  if(s === e) return false; // disabled
  if(s < e) return n >= s && n < e; // same-day window
  // overnight window e.g. 22:00-07:00
  return n >= s || n < e;
}

export async function markSessionCompleted(){
  await AsyncStorage.setItem(K.lastCompletedTs, String(Date.now()));
}

export async function registerNotificationActions(){
  try {
  const { Platform } = await import('react-native');
  const Constants = (await import('expo-constants')).default;
  const isExpoGoAndroid = Platform.OS === 'android' && Constants?.appOwnership === 'expo';
  if (isExpoGoAndroid) return; // skip in Expo Go Android
  const Notifications = await import('expo-notifications');
    await Notifications.setNotificationCategoryAsync('med-reminder', [
      { identifier: 'SNOOZE_30', buttonTitle: 'Snooze 30m', options: { opensAppToForeground: false } },
      { identifier: 'SNOOZE_60', buttonTitle: 'Snooze 1h', options: { opensAppToForeground: false } },
      { identifier: 'TONIGHT', buttonTitle: 'Tonight', options: { opensAppToForeground: false } },
    ]);
  } catch {}
}

export async function handleNotificationResponse(response){
  try {
    const id = response?.actionIdentifier;
    if(!id) return;
    const now = Date.now();
    if(id === 'SNOOZE_30'){
      await AsyncStorage.setItem(K.lastSentTs, String(now));
      await scheduleOneOffInMinutes(30);
    } else if(id === 'SNOOZE_60'){
      await AsyncStorage.setItem(K.lastSentTs, String(now));
      await scheduleOneOffInMinutes(60);
    } else if(id === 'TONIGHT'){
      const settings = await getAdaptiveSettings();
      const { h } = parseHHMM(settings.quietStart);
      await scheduleTodayAt(Math.max(h-1, 17), 0); // schedule for evening before quiet hours
    }
  } catch {}
}

async function scheduleOneOffInMinutes(min){
  const { Platform } = await import('react-native');
  const Constants = (await import('expo-constants')).default;
  const isExpoGoAndroid = Platform.OS === 'android' && Constants?.appOwnership === 'expo';
  if (isExpoGoAndroid) return; // skip
  const Notifications = await import('expo-notifications');
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Take a mindful break', body: 'We will remind you again soon.' },
    trigger: { seconds: Math.max(1, min*60) }
  });
}

async function scheduleTodayAt(hour, minute, { title = 'Time to meditate', body = 'Just 10 minutes to reset your day.' } = {}){
  const { Platform } = await import('react-native');
  const Constants = (await import('expo-constants')).default;
  const isExpoGoAndroid = Platform.OS === 'android' && Constants?.appOwnership === 'expo';
  if (isExpoGoAndroid) return; // skip
  const Notifications = await import('expo-notifications');
  const now = new Date();
  const when = new Date(now);
  when.setHours(hour, minute, 0, 0);
  if(when.getTime() <= now.getTime()) when.setDate(when.getDate()+1);
  await Notifications.scheduleNotificationAsync({
    content: { title, body, categoryIdentifier: 'med-reminder' },
    trigger: { date: when }
  });
}

async function computeStreakDays(){
  try {
    const { auth, db } = await import('../../firebase/firebaseConfig');
    const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
    const user = auth.currentUser; if(!user) return 0;
    const ref = collection(db, 'users', user.uid, 'sessions');
    const q = query(ref, orderBy('endedAt','desc'), limit(200));
    const snap = await getDocs(q);
    const days = new Set();
    const today = new Date(); today.setHours(0,0,0,0);
    for(const d of snap.docs){
      const end = d.data()?.endedAt?.toDate ? d.data().endedAt.toDate() : null;
      if(!end) continue;
      const key = new Date(end.getFullYear(), end.getMonth(), end.getDate()).toISOString().slice(0,10);
      days.add(key);
    }
    let streak = 0;
    for(let i=0;i<30;i++){
      const dt = new Date(today); dt.setDate(today.getDate()-i);
      const key = dt.toISOString().slice(0,10);
      const m = days.has(key);
      if(m) streak++; else break;
    }
    return streak;
  } catch { return 0; }
}

async function getMoodTrend(){
  try {
    const { getChartDataSince } = await import('./moodEntries');
    const rows = await getChartDataSince({ days: 7, ttlMs: 60*1000 });
    const vals = rows.map(r => Number(r.moodScore)).filter(n => Number.isFinite(n));
    if(!vals.length) return { level: 'unknown', avg: null };
    const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
    if(avg <= 5) return { level: 'low', avg };
    if(avg >= 7.5) return { level: 'high', avg };
    return { level: 'mid', avg };
  } catch { return { level: 'unknown', avg: null }; }
}

export async function runAdaptiveScheduler(){
  const { Platform } = await import('react-native');
  const Constants = (await import('expo-constants')).default;
  const isExpoGoAndroid = Platform.OS === 'android' && Constants?.appOwnership === 'expo';
  if (isExpoGoAndroid) return { scheduled:false, reason:'expo-go-android' };
  const Notifications = await import('expo-notifications');
  const settings = await getAdaptiveSettings();
  if(!settings.enabled) return { scheduled: false, reason: 'disabled' };

  const now = new Date();
  // Suppress during quiet hours
  if(isWithinQuietHours(now, settings.quietStart, settings.quietEnd)){
    return { scheduled: false, reason: 'quiet-hours' };
  }

  // Suppress if session completed recently (cooldown)
  const [lastCompletedTs, lastSentTs] = await Promise.all([
    AsyncStorage.getItem(K.lastCompletedTs),
    AsyncStorage.getItem(K.lastSentTs),
  ]);
  const cooldownMs = Math.max(10, settings.cooldownMin) * 60 * 1000;
  const nowMs = Date.now();
  if(lastCompletedTs && nowMs - Number(lastCompletedTs) < cooldownMs){
    return { scheduled: false, reason: 'recent-completion' };
  }
  if(lastSentTs && nowMs - Number(lastSentTs) < cooldownMs){
    return { scheduled: false, reason: 'recent-nudge' };
  }

  // Adaptive time: missed days shift later; good streak nudges a bit earlier
  const missBiasMin = await getMissBiasMinutes(30); // +15..30 if missed last 3 days
  const streak = await computeStreakDays(); // consecutive recent days with minutes > 0
  let delta = missBiasMin;
  if(streak >= 5) delta -= 10; // nudge slightly earlier on a good streak

  // Mood-aware tone: gentle copy for low mood
  const mood = await getMoodTrend();
  const copy = mood.level === 'low'
    ? { title: 'A gentle pause', body: 'Be kind to yourself—let’s take 5–10 minutes together.' }
    : { title: 'Time to meditate', body: 'Just 10 minutes to reset your day.' };

  const hour = settings.baseHour;
  const minuteTotal = Math.max(0, settings.baseMinute + delta);
  const adjHour = (hour + Math.floor(minuteTotal/60)) % 24;
  const adjMinute = minuteTotal % 60;

  await Notifications.cancelAllScheduledNotificationsAsync();
  await scheduleTodayAt(adjHour, adjMinute, copy);
  await AsyncStorage.setItem(K.lastSentTs, String(Date.now()));
  let backup = null;
  if(settings.backupEnabled){
    // backup in afternoon/evening; ensure not within quiet hours
    let bh = settings.backupHour, bm = settings.backupMinute;
    const now = new Date();
    const isQuiet = isWithinQuietHours(new Date(now.getFullYear(), now.getMonth(), now.getDate(), bh, bm), settings.quietStart, settings.quietEnd);
    if(!isQuiet){
      await scheduleTodayAt(bh, bm, { title: copy.title, body: 'Missed earlier? No worries—try a quick mindful break.' });
      backup = { hour: bh, minute: bm };
    }
  }
  return { scheduled: true, reason: 'scheduled', hour: adjHour, minute: adjMinute, backup, mood: mood.level, streak };
}

async function getMissBiasMinutes(maxShift = 30){
  // Look at last 3 days; if there were no sessions, shift later by 15-30m as friendlier
  // If there were sessions, keep original time.
  try {
    const { auth, db } = await import('../../firebase/firebaseConfig');
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    const user = auth.currentUser;
    if(!user) return 0;
    const now = Date.now();
    const threeDaysAgo = now - 3*24*60*60*1000;
    const q = query(collection(db, 'users', user.uid, 'sessions'), where('endedAt', '>=', new Date(threeDaysAgo)));
    const snap = await getDocs(q);
    const count = snap.size || 0;
    if(count === 0) return Math.min(maxShift, 30); // shift later by up to 30m
    return 0;
  } catch { return 0; }
}
